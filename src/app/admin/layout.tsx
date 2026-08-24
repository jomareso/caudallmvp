import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { LogoutButton } from './logout-button';

// Decisión 7: admin es desktop-only, así que este layout no necesita
// adaptarse a mobile — a diferencia del resto de la app.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;

  const admin =
    sessionUser?.role === 'admin' && sessionUser.id
      ? await prisma.adminUser.findUnique({ where: { id: sessionUser.id } })
      : null;

  // Sin sesión de admin (ej. la pantalla de login) no hay nada que
  // envolver: se muestra la página tal cual, sin encabezado ni navegación.
  if (!admin) return <>{children}</>;

  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const hasLogo = Boolean(settings?.logoData);
  const t = await getTranslations('admin.nav');

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
