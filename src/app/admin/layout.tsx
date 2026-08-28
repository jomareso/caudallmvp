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
  const tVersion = await getTranslations('admin.version');

  // COMMIT_REF/CONTEXT son variables de build de Netlify, horneadas en
  // process.env vía `env` en next.config.js (no están disponibles tal
  // cual en runtime) — sirve para no confundir un deploy preview de un
  // PR con producción, algo que pasó de verdad revisando el sitio hoy.
  const commitSha = process.env.APP_COMMIT_SHA ?? 'local';
  const deployContext = process.env.APP_DEPLOY_CONTEXT ?? 'local';
  const shortSha = commitSha === 'local' ? commitSha : commitSha.slice(0, 7);
  const CONTEXT_KEY: Record<string, 'production' | 'deployPreview' | 'branchDeploy' | 'local'> = {
    production: 'production',
    'deploy-preview': 'deployPreview',
    'branch-deploy': 'branchDeploy',
    local: 'local'
  };
  const contextLabel = tVersion(`context.${CONTEXT_KEY[deployContext] ?? 'local'}`);

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
                <Link href="/admin/contenido" className="hover:text-yale">
                  {t('content')}
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
                <Link href="/admin/notificaciones" className="hover:text-yale">
                  {t('notifications')}
                </Link>
              </>
            ) : null}
            <LogoutButton label={t('logout')} />
          </nav>
        </div>
      </header>

      <div className="flex-1 flex flex-col">{children}</div>

      <footer className="border-t border-silver/40 shrink-0 py-2 text-center">
        <p className="text-[10px] text-silver">
          {tVersion('label', { sha: shortSha })} · {contextLabel}
        </p>
      </footer>
    </div>
  );
}
