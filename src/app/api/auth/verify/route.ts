import { AuthError } from 'next-auth';
import { NextResponse } from 'next/server';
import { signIn } from '@/lib/auth/auth';
import { verifyMagicLinkToken } from '@/lib/auth/magic-link';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/registro/invalido', request.url));
  }

  const payload = await verifyMagicLinkToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/registro/invalido', request.url));
  }

  try {
    await signIn('magic-link', { token, redirectTo: '/bienvenida' });
  } catch (error) {
    // NEXT_REDIRECT no es un error real: signIn lo usa para redirigir en éxito.
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL('/registro/invalido', request.url));
    }
    throw error;
  }

  return NextResponse.redirect(new URL('/bienvenida', request.url));
}
