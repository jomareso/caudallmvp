import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { LandingForm } from './landing-form';

export default async function LandingPage() {
  // Si ya hay una sesión activa (magic link vigente), no tiene sentido
  // volver a pedir el código de empresa — eso es solo para el primer
  // registro (Decisión 6: sin SSO/HRIS, es la única forma de saber a qué
  // empresa perteneces la primera vez).
  //
  // No basta con que exista la sesión: si el empleado fue borrado (ej.
  // limpieza de datos de prueba) pero el navegador todavía tiene la
  // cookie, /bienvenida no lo encuentra y redirige de vuelta acá — sin
  // esta verificación eso es un bucle infinito entre / y /bienvenida.
  const session = await auth();
  if (session?.user?.id) {
    const employee = await prisma.employee.findUnique({ where: { id: session.user.id } });
    if (employee) redirect('/bienvenida');
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const hasLogo = Boolean(settings?.logoData);

  return <LandingForm hasLogo={hasLogo} />;
}
