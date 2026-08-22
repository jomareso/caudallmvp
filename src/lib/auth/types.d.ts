import type { DefaultSession } from '@auth/core/types';

// `next-auth` re-exporta estos tipos desde @auth/core (vía `export type {...} from`),
// así que la extensión de tipos tiene que apuntar al módulo original: un
// `declare module 'next-auth'` no se fusiona con un `export *`.
declare module '@auth/core/types' {
  interface User {
    tenantId: string;
    role: 'employee';
  }

  interface Session {
    user: {
      tenantId: string;
      role: 'employee';
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/types.js' {
  interface User {
    tenantId: string;
    role: 'employee';
  }
}
