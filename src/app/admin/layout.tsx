import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { LogoutButton } from './logout-button';
import { runWithTenantContext } from '@/lib/db/prisma';

// Decisión 7: admin es desktop-only, así que este layout no necesita
// adaptarse a mobile — a diferencia del resto de la app.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;

  const admin =
    sessionUser?.role === 'admin' && sessionUser.id
      ? await runWithTenantContext({ kind: 'session-subject', sessionSubjectId: sessionUser.id }, () =>
          prisma.adminUser.findUnique({ where: { id: sessionUser.id! }, include: { tenant: true } })
        )
      : null;

  // Sin sesión de admin (ej. la pantalla de login) no hay nada que
  // envolver: se muestra la página tal cual, sin encabezado ni navegación.
  if (!admin) return <>{children}</>;

  // Un admin desactivado (ej. desde /admin/administradores) o cuya empresa
  // fue suspendida puede seguir teniendo un JWT válido — este chequeo corta
  // el acceso en cada carga de página admin, igual que la licencia vencida
  // corta al empleado.
  if (!admin.active || admin.tenant?.status === 'SUSPENDED') redirect('/admin');

  // platform_settings es un singleton global sin tenantId — no lleva RLS,
  // así que no necesita ningún contexto fijado para leerse.
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const hasLogo = Boolean(settings?.logoData);
  const t = await getTranslations('admin.nav');

  // Nota: este layout NO envuelve `children` en runWithTenantContext — ese
  // contexto no se propaga a la Page anidada en Next.js App Router (cada
  // segmento de ruta corre en su propio tramo async). Cada page.tsx/
  // actions.ts bajo /admin resuelve su propio contexto vía
  // src/lib/auth/admin-context.ts (requireAdmin/requireAdminWithContext).
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-silver/60 shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href={
              admin.profileType === 'ADM'
                ? '/admin/configuracion'
                : admin.profileType === 'EMPRESA'
                  ? '/admin/empresa'
                  : '/admin/funcional'
            }
            className="flex items-center"
          >
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
              <img
                src="/api/branding/logo"
                alt="Caudall"
                className="h-20 mix-blend-multiply"
              />
            ) : (
              <span className="text-2xl font-medium text-yale">caudall</span>
            )}
          </Link>

          <nav className="flex items-center gap-5 text-xs text-nickel">
            {admin.profileType === 'ADM' ? (
              <>
                <Link href="/admin/configuracion" className="hover:text-yale">
                  {t('settings')}
                </Link>
                <Link href="/admin/metodologia" className="hover:text-yale">
                  {t('methodology')}
                </Link>
                <Link href="/admin/empresas" className="hover:text-yale">
                  {t('companies')}
                </Link>
                <Link href="/admin/administradores" className="hover:text-yale">
                  {t('admins')}
                </Link>
              </>
            ) : null}
            <LogoutButton label={t('logout')} />
          </nav>
        </div>
      </header>

      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
