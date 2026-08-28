'use server';

import { cookies } from 'next/headers';
import { signIn } from '@/lib/auth/auth';
import { ENROLLMENT_CODE_COOKIE } from '@/lib/auth/google-cookie';

// El round-trip de OAuth (a Google y de vuelta) no deja pasar datos
// propios nuestros — por eso el código de licencia/enrollment, ya
// validado en esta misma pantalla, se guarda en una cookie corta que
// GoogleProvider.profile() lee del lado del servidor (ver auth.ts) al
// volver. httpOnly: el cliente no necesita ni debe leerla.
export async function beginGoogleSignIn(enrollmentCode: string): Promise<void> {
  cookies().set(ENROLLMENT_CODE_COOKIE, enrollmentCode, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/'
  });
  await signIn('google', { redirectTo: '/bienvenida' });
}
