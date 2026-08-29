import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { cookies } from 'next/headers';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { verifyMagicLinkToken } from './magic-link';
import { authConfig } from './auth.config';
import { ENROLLMENT_CODE_COOKIE } from './google-cookie';
import { resolveOrCreateEmployeeForGoogle } from './google-employee';
import type {} from './types';

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
    // magic link — no lo reemplaza. profile() (no signIn/jwt) es donde
    // corre la resolución de Employee: es el único callback de un
    // provider OAuth que puede devolver directamente el shape de `user`
    // que después usa el callback jwt() compartido (ver auth.config.ts) —
    // así ese callback no necesita saber que existe Google, solo ve un
    // EmployeeAuthUser igual que si hubiera entrado por magic link.
    Google({
      // Explícitos, no la convención AUTH_GOOGLE_ID/SECRET de Auth.js v5:
      // .env.example ya documentaba GOOGLE_CLIENT_ID/SECRET desde antes
      // (comentario "OAuth con Google — ADR-008"), y no vale la pena
      // pedirle a Reynoso que renombre variables de entorno en Netlify
      // por una convención que el resto del proyecto no sigue.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      async profile(profile) {
        const enrollmentCode = cookies().get(ENROLLMENT_CODE_COOKIE)?.value;
        if (!enrollmentCode) {
          throw new Error('NO_CODE');
        }
        return resolveOrCreateEmployeeForGoogle({ enrollmentCode, email: profile.email });
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
  ]
});
