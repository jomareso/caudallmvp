import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { LandingForm } from './landing-form';

export default async function LandingPage() {
  // Si ya hay una sesión activa (magic link vigente), no tiene sentido
  // volver a pedir el código de empresa — eso es solo para el primer
  // registro (Decisión 6: sin SSO/HRIS, es la única forma de saber a qué
  // empresa perteneces la primera vez).
  const session = await auth();
  if (session?.user?.id) redirect('/bienvenida');

  return <LandingForm />;
}
