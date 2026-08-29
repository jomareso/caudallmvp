import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { getVisibleBlockContent } from '@/lib/landing/get-landing-content';
import { getEmployeePostLoginDestination } from '@/lib/auth/post-login-destination';
import { LandingForm } from './landing-form';
import { BrandPanel } from './brand-panel';

export default async function LandingPage() {
  // Si ya hay una sesión activa (magic link vigente), no tiene sentido
  // volver a pedir el código de empresa — eso es solo para el primer
  // registro (Decisión 6: sin SSO/HRIS, es la única forma de saber a qué
  // empresa perteneces la primera vez).
  //
  // No basta con que exista la sesión: si el empleado fue borrado (ej.
  // limpieza de datos de prueba) pero el navegador todavía tiene la
  // cookie, la pantalla de destino no lo encuentra y redirige de vuelta
  // acá — sin esta verificación eso es un bucle infinito.
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as
    | { id?: string; tenantId?: string; role?: 'employee' | 'admin' }
    | undefined;
  if (sessionUser?.role === 'employee' && sessionUser.id && sessionUser.tenantId) {
    const employee = await runWithTenantContext(
      { kind: 'tenant', tenantId: sessionUser.tenantId },
      () => prisma.employee.findUnique({ where: { id: sessionUser.id! } })
    );
    if (employee) {
      redirect(await getEmployeePostLoginDestination(employee.id, employee.tenantId));
    }
  }

  const [hero, formIntro, trust] = await Promise.all([
    getVisibleBlockContent('COLABORADOR', 'colaborador_hero'),
    getVisibleBlockContent('COLABORADOR', 'colaborador_form_intro'),
    getVisibleBlockContent('COLABORADOR', 'colaborador_trust')
  ]);
  const formContent =
    formIntro && trust
      ? { formTitle: formIntro.formTitle, formSubtitle: formIntro.formSubtitle, timeEstimate: formIntro.timeEstimate, privacyGuarantee: trust.privacyGuarantee }
      : null;
  // El titular de marca (BrandPanel) vive oculto bajo `lg` — en mobile
  // nunca se veía ningún titular, solo el formulario, directo. Reusa el
  // mismo contenido de colaborador_hero en vez de pedir un texto nuevo en
  // el CMS. Dos líneas separadas (no un string concatenado) — cada
  // componente de la promesa de valor debe quedar en su propia línea,
  // igual que ya hace BrandPanel en escritorio; concatenarlas en un solo
  // <p> las dejaba a merced de dónde el navegador decidiera cortar el
  // texto envuelto.
  const mobileHook = hero ? { line1: hero.titleLine1, line2: hero.titleLine2 } : null;

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />
      <LandingForm content={formContent} mobileHook={mobileHook} />
    </main>
  );
}
