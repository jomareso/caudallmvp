import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { AdminLoginForm } from './login-form';

export default async function AdminLoginPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role === 'admin' && sessionUser.id) {
    // Esta página, a diferencia del resto de /admin, NO redirige si el
    // lookup falla (cae al formulario de login) — no puede usar
    // requireAdmin() de admin-context.ts, que sí redirige.
    const admin = await runWithTenantContext(
      { kind: 'session-subject', sessionSubjectId: sessionUser.id },
      () => prisma.adminUser.findUnique({ where: { id: sessionUser.id! } })
    );
    // Cada perfil aterriza en su propia área — ADM controla la plataforma,
    // EMPRESA (RRHH) solo ve agregados de su propio tenant, FUNCIONAL
    // todavía no tiene herramientas propias.
    if (admin?.profileType === 'ADM') redirect('/admin/configuracion');
    if (admin?.profileType === 'EMPRESA') redirect('/admin/empresa');
    if (admin?.profileType === 'FUNCIONAL') redirect('/admin/funcional');
  }

  // Mismo logo que ve el admin ya logueado (AdminLayout) — sin esto, esta
  // pantalla mostraba siempre el texto genérico "caudall" aunque Reynoso
  // ya hubiera subido el logo real desde /admin/configuracion.
  // platform_settings es un singleton sin RLS (ver AdminLayout), no
  // necesita contexto de tenant para leerse.
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const hasLogo = Boolean(settings?.logoData);

  return <AdminLoginForm hasLogo={hasLogo} />;
}
