import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

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
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  // /admin/:path+ (no /admin/:path*) a propósito: la pantalla de login
  // vive en /admin mismo — con :path* también matchearía ahí y crearía
  // un bucle (sin sesión de admin -> redirige a /admin -> se vuelve a
  // proteger -> redirige...).
  matcher: ['/bienvenida', '/diagnostico/:path*', '/admin/:path+']
};
