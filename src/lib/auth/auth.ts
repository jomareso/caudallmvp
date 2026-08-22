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

// Mismo problema de reexport que EmployeeAuthUser, pero para el JWT: casteamos
// puntualmente en vez de depender del module augmentation de @auth/core/jwt.
type EmployeeJwt = {
  employeeId?: string;
  tenantId?: string;
  role?: 'employee';
};

// Sesión por JWT, sin adapter de base de datos: la identidad real vive en
// Employee (ver docs/data-model.md), no en un modelo genérico de NextAuth.
// El provider "magic-link" no hace login/password: solo valida un token
// de un solo uso emitido por src/lib/auth/magic-link.ts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
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
      const employeeToken = token as typeof token & EmployeeJwt;
      if (user) {
        const employeeUser = user as EmployeeAuthUser;
        employeeToken.employeeId = employeeUser.id;
        employeeToken.tenantId = employeeUser.tenantId;
        employeeToken.role = employeeUser.role;
      }
      return employeeToken;
    },
    async session({ session, token }) {
      const employeeToken = token as typeof token & EmployeeJwt;
      const sessionUser = session.user as typeof session.user & Partial<EmployeeAuthUser>;
      if (employeeToken.employeeId) sessionUser.id = employeeToken.employeeId;
      if (employeeToken.tenantId) sessionUser.tenantId = employeeToken.tenantId;
      if (employeeToken.role) sessionUser.role = employeeToken.role;
      return session;
    }
  }
});
