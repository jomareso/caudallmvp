import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth/auth.config';

// Usa authConfig directamente (no @/lib/auth/auth) a propósito: ese
// archivo importa Prisma para el provider de magic-link, y Prisma no
// puede cargarse en Edge Runtime (donde corre este middleware por
// defecto) — ver el comentario en auth.config.ts. Este middleware solo
// necesita decodificar el JWT de la cookie de sesión, nunca llama a
// authorize(), así que no necesita el provider en absoluto.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin')) {
    // Ver src/lib/auth/auth.ts sobre por qué el cast local: el module
    // augmentation de next-auth (beta) no siempre se fusiona a través del
    // reexport de @auth/core.
    const role = (req.auth?.user as { role?: 'employee' | 'admin' } | undefined)?.role;
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return;
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL('/acceso', req.url));
  }
});

export const config = {
  // /admin/:path+ (no /admin/:path*) a propósito: la pantalla de login
  // vive en /admin mismo — con :path* también matchearía ahí y crearía
  // un bucle (sin sesión de admin -> redirige a /admin -> se vuelve a
  // proteger -> redirige...).
  matcher: ['/bienvenida', '/inicio', '/diagnostico/:path*', '/admin/:path+']
};
