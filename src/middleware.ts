import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/bienvenida']
};
