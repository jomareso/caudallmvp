import type { NextAuthConfig } from 'next-auth';
import type {} from './types';

// Config "Edge-safe": nada de aquí importa Prisma. next-server ejecuta
// src/middleware.ts en Edge Runtime por defecto, y PrismaClient no puede
// correr ahí (ni siquiera solo construirse dentro de un $extends — ver
// src/lib/db/prisma.ts). middleware.ts usa ESTA config (sin providers,
// solo para decodificar el JWT de la cookie de sesión); auth.ts extiende
// esta misma config agregando el provider de magic-link, que sí toca
// Prisma, y esa versión completa es la que usan las rutas normales
// (Server Components, Server Actions, route handlers), todas en runtime
// de Node.
//
// AppJwt/EmployeeAuthUser/AdminAuthUser viven en auth.ts (solo se usan en
// el callback jwt(), que sí necesita el shape de "user" que devuelve
// authorize() — este archivo no lo necesita).
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/'
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      const appToken = token as typeof token & {
        employeeId?: string;
        tenantId?: string;
        adminUserId?: string;
        profileType?: string;
        role?: 'employee' | 'admin';
      };
      if (user) {
        const authUser = user as
          | { id: string; email: string; tenantId: string; role: 'employee' }
          | { id: string; email: string; role: 'admin'; profileType: string };
        if (authUser.role === 'admin') {
          appToken.adminUserId = authUser.id;
          appToken.profileType = authUser.profileType;
          appToken.role = 'admin';
        } else {
          appToken.employeeId = authUser.id;
          appToken.tenantId = authUser.tenantId;
          appToken.role = 'employee';
        }
      }
      return appToken;
    },
    async session({ session, token }) {
      const appToken = token as typeof token & {
        employeeId?: string;
        tenantId?: string;
        adminUserId?: string;
        profileType?: string;
        role?: 'employee' | 'admin';
      };
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
} satisfies NextAuthConfig;
