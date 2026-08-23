import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import { verifyMagicLinkToken } from './magic-link';
import type {} from './types';

// Forma real de "user" que devuelve authorize() más abajo. La declaración de
// tipos de next-auth (beta) re-exporta User/Session/JWT desde @auth/core vía
// `export * from`, y el module augmentation en ./types.d.ts no siempre se
// fusiona a través de ese reexport. Para no depender de `any`, casteamos
// puntualmente a este tipo local en los callbacks, en vez de pelear con los
// tipos internos de una librería en beta.
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

type AppJwt = {
  employeeId?: string;
  tenantId?: string;
  adminUserId?: string;
  profileType?: string;
  role?: 'employee' | 'admin';
};

// Sesión por JWT, sin adapter de base de datos: la identidad real vive en
// Employee o AdminUser (ver docs/data-model.md), no en un modelo genérico
// de NextAuth. El provider "magic-link" no hace login/password: solo
// valida un token de un solo uso emitido por src/lib/auth/magic-link.ts —
// el mismo mecanismo sirve tanto para empleados como para admins, el
// `type` dentro del token (spec: MagicLinkPayload) decide cuál.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  // NextAuth v5 solo confía en el header Host de la petición automáticamente
  // en Vercel. En cualquier otro host (Netlify incluido) hay que decirlo
  // explícito, si no falla con "There was a problem with the server
  // configuration" aunque todo lo demás esté bien configurado. Hoy esto se
  // cubre con la variable de entorno AUTH_TRUST_HOST=true en Netlify; fijarlo
  // aquí evita depender de que alguien la recuerde en el próximo entorno.
  trustHost: true,
  pages: {
    signIn: '/'
  },
  providers: [
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

        if (payload.type === 'admin') {
          const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminUserId } });
          if (!admin || admin.email !== payload.email) return null;

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
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      const appToken = token as typeof token & AppJwt;
      if (user) {
        const authUser = user as EmployeeAuthUser | AdminAuthUser;
        if (authUser.role === 'admin') {
          const adminUser = authUser;
          appToken.adminUserId = adminUser.id;
          appToken.profileType = adminUser.profileType;
          appToken.role = 'admin';
        } else {
          const employeeUser = authUser;
          appToken.employeeId = employeeUser.id;
          appToken.tenantId = employeeUser.tenantId;
          appToken.role = 'employee';
        }
      }
      return appToken;
    },
    async session({ session, token }) {
      const appToken = token as typeof token & AppJwt;
      const sessionUser = session.user as typeof session.user & {
        id?: string;
        tenantId?: string;
        role?: 'employee' | 'admin';
        profileType?: string;
      };

      if (appToken.role === 'admin' && appToken.adminUserId) {
        sessionUser.id = appToken.adminUserId;
        sessionUser.role = 'admin';
        sessionUser.profileType = appToken.profileType;
      } else if (appToken.employeeId) {
        sessionUser.id = appToken.employeeId;
        sessionUser.tenantId = appToken.tenantId;
        sessionUser.role = 'employee';
      }
      return session;
    }
  }
});
