import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { cookies } from 'next/headers';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { verifyMagicLinkToken } from './magic-link';
import { authConfig } from './auth.config';
import { ENROLLMENT_CODE_COOKIE } from './google-cookie';
import { GoogleEnrollmentError, resolveOrCreateEmployeeForGoogle } from './google-employee';
import type {} from './types';

// Mismas claves que ya usa employee.access.errors (requestMagicLink en
// (employee)/actions.ts) para las mismas 4 reglas de negocio — un solo
// texto por caso, sin importar si el empleado entra por link mágico o por
// Google. 'NO_CODE' no viene de GoogleEnrollmentError (nunca se
// construye con ese código, ver google-employee.ts): se maneja aparte,
// directo en el callback signIn() de abajo.
const GOOGLE_ERROR_QUERY_PARAM: Record<Exclude<import('./google-employee').GoogleEnrollmentErrorCode, 'NO_CODE'>, string> = {
  CODE_INVALID: 'invalidCode',
  LICENSE_EXPIRED: 'licenseExpired',
  LICENSE_TAKEN: 'codeAlreadyAssigned',
  CORPORATE_EMAIL: 'useCorporateEmail'
};

type EmployeeAuthUser = {
  id: string;
  email: string;
  tenantId: string;
  role: 'employee';
};

type AdminAuthUser = {
  id: string;
  email: string;
  role: 'admin';
  profileType: string;
};

// Sesión por JWT, sin adapter de base de datos: la identidad real vive en
// Employee o AdminUser (ver docs/data-model.md), no en un modelo genérico
// de NextAuth. El provider "magic-link" no hace login/password: solo
// valida un token de un solo uso emitido por src/lib/auth/magic-link.ts —
// el mismo mecanismo sirve tanto para empleados como para admins, el
// `type` dentro del token (spec: MagicLinkPayload) decide cuál.
//
// Los callbacks jwt/session (que no tocan Prisma) y session.strategy/pages
// viven en ./auth.config.ts — ese archivo también lo usa src/middleware.ts
// directamente, en Edge Runtime, donde Prisma no puede cargarse ni
// siquiera sin ejecutar ninguna query (ver comentario en auth.config.ts y
// en src/lib/db/prisma.ts). Este archivo (auth.ts) es la config completa,
// con el provider que sí usa Prisma, y solo se importa desde código que
// corre en runtime de Node (Server Components, Server Actions, route
// handlers) — nunca desde middleware.ts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // ADR-008: OAuth con Google, cuenta personal, como opción junto al
    // magic link — no lo reemplaza.
    //
    // La resolución de Employee (código válido, licencia no vencida/no
    // tomada, correo no corporativo) vivía antes en profile(), lanzando
    // GoogleEnrollmentError/Error('NO_CODE') directo. Eso se veía en
    // producción como la pantalla genérica de Auth.js "There is a
    // problem with the server configuration" — profile() no tiene forma
    // de redirigir a una pantalla propia, cualquier excepción ahí cae en
    // ese error opaco (encontrado por Reynoso probando "Continuar con
    // Google"). Por eso esa resolución se movió al callback signIn() de
    // abajo: es el único punto del pipeline de Auth.js donde devolver un
    // string redirige al usuario a esa URL en vez de mostrar el error
    // genérico (ver tipo de CallbacksOptions.signIn en @auth/core).
    // profile() ahora solo mapea el perfil crudo de Google — nunca falla.
    Google({
      // Explícitos, no la convención AUTH_GOOGLE_ID/SECRET de Auth.js v5:
      // .env.example ya documentaba GOOGLE_CLIENT_ID/SECRET desde antes
      // (comentario "OAuth con Google — ADR-008"), y no vale la pena
      // pedirle a Reynoso que renombre variables de entorno en Netlify
      // por una convención que el resto del proyecto no sigue.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      async profile(profile) {
        // tenantId placeholder: signIn() de abajo lo completa con el
        // Employee real (o corta el login con un redirect) antes de que
        // jwt() (ver auth.config.ts) llegue a leer este objeto — jwt()
        // recibe la MISMA referencia de `user` que devuelve/muta este
        // provider, no una copia, así que la mutación en signIn() sí le
        // llega.
        const placeholder: EmployeeAuthUser = { id: profile.sub, email: profile.email ?? '', tenantId: '', role: 'employee' };
        return placeholder;
      }
    }),
    Credentials({
      id: 'magic-link',
      name: 'Magic link',
      credentials: {
        token: { label: 'Token', type: 'text' }
      },
      async authorize(credentials) {
        const token = typeof credentials?.token === 'string' ? credentials.token : undefined;
        if (!token) return null;

        const payload = await verifyMagicLinkToken(token);
        if (!payload) return null;
        // Un token de "email-change" no es un login válido — es de un solo
        // propósito (confirmar el nuevo correo, ver post-login-destination
        // no, ver src/app/api/auth/verify-email-change/route.ts). Sin este
        // guardia, caería en la rama de employee de abajo y dejaría entrar
        // con un token que no fue emitido para eso.
        if (payload.type === 'email-change') return null;

        // Resolver "quién es este id" es, por definición, lo primero que pasa
        // en cualquier sesión — todavía no hay tenant conocido para fijar
        // como contexto de RLS. Es seguro usar el propio id como contexto de
        // "session-subject" (las políticas de employees/admin_users permiten
        // leer/actualizar la propia fila por id en cualquier contexto)
        // porque ese id viene de un token firmado por nosotros mismos
        // (verifyMagicLinkToken), no de algo que el usuario pueda escribir.
        if (payload.type === 'admin') {
          return runWithTenantContext(
            { kind: 'session-subject', sessionSubjectId: payload.adminUserId },
            async () => {
              const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminUserId } });
              // Un link emitido antes de desactivar al admin sigue siendo un
              // JWT válido dentro de su TTL (magicLinkTtlMinutes) — sin este
              // chequeo, completaría el login igual (requireAdmin() lo
              // bloquearía después en cada página, pero la sesión con
              // role:'admin' no debería llegar a crearse).
              if (!admin || admin.email !== payload.email || !admin.active) return null;

              await prisma.adminUser.update({
                where: { id: admin.id },
                data: { lastActiveAt: new Date() }
              });

              const adminUser: AdminAuthUser = {
                id: admin.id,
                email: admin.email,
                role: 'admin',
                profileType: admin.profileType
              };
              return adminUser;
            }
          );
        }

        return runWithTenantContext(
          { kind: 'session-subject', sessionSubjectId: payload.employeeId },
          async () => {
            const employee = await prisma.employee.findUnique({
              where: { id: payload.employeeId }
            });

            if (
              !employee ||
              employee.tenantId !== payload.tenantId ||
              employee.personalEmail !== payload.email
            ) {
              return null;
            }

            await prisma.employee.update({
              where: { id: employee.id },
              data: {
                status: employee.status === 'REGISTERED' ? 'ACTIVE' : employee.status,
                lastActiveAt: new Date()
              }
            });

            const employeeUser: EmployeeAuthUser = {
              id: employee.id,
              email: employee.personalEmail,
              tenantId: employee.tenantId,
              role: 'employee'
            };
            return employeeUser;
          }
        );
      }
    })
  ],
  callbacks: {
    // ...authConfig.callbacks primero: jwt()/session() (ver auth.config.ts)
    // no se tocan, solo se agrega signIn(). Spread, no reemplazo — un
    // callbacks: {} acá pisaría por completo el de authConfig en vez de
    // sumarse.
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // authorize() (Credentials/magic-link) ya resuelve todo su propio
      // caso arriba, devolviendo null si no es válido — nada que agregar
      // acá para ese provider.
      if (account?.provider !== 'google') return true;

      const enrollmentCode = cookies().get(ENROLLMENT_CODE_COOKIE)?.value;
      // Vuelve a /acceso (no /registro?code=...) porque sin cookie no hay
      // código que reusar en la URL — mismo destino que un code inválido
      // en /registro/page.tsx.
      if (!enrollmentCode) return '/acceso';

      try {
        const employee = await resolveOrCreateEmployeeForGoogle({
          enrollmentCode,
          email: (user as EmployeeAuthUser).email
        });
        // Muta el mismo objeto `user` que profile() devolvió (ver
        // comentario ahí) — jwt() lo lee después con los valores reales.
        const authUser = user as EmployeeAuthUser;
        authUser.id = employee.id;
        authUser.email = employee.email;
        authUser.tenantId = employee.tenantId;
        authUser.role = 'employee';
        return true;
      } catch (error) {
        // googleError se traduce y se muestra en el mismo formulario que
        // ya tenía el usuario — mismos 4 textos que requestMagicLink en
        // (employee)/actions.ts, para no decir cosas distintas según el
        // método de entrada.
        const reason =
          error instanceof GoogleEnrollmentError && error.code !== 'NO_CODE'
            ? GOOGLE_ERROR_QUERY_PARAM[error.code]
            : 'googleUnknown';
        return `/registro?code=${encodeURIComponent(enrollmentCode)}&googleError=${reason}`;
      }
    }
  }
});
