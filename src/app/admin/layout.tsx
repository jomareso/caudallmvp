import type { ReactNode } from 'react';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { runWithTenantContext } from '@/lib/db/prisma';
import { AdminSidebar, type AdminNavGroup } from './admin-sidebar';
import { AdminMobileNav } from './admin-mobile-nav';

// ADR-007 (actualizado): admin es desktop-first, pero funcional en
// móvil, no bloqueado — por eso este layout arma AMBOS: AdminSidebar
// para escritorio (lg y más ancho) y AdminMobileNav para el resto,
// mutuamente excluyentes por Tailwind (hidden lg:flex / lg:hidden), no
// una sola versión encogida a la fuerza para la otra.
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

  const homeHref: Route =
    admin.profileType === 'ADM'
      ? '/admin/configuracion'
      : admin.profileType === 'EMPRESA'
        ? '/admin/empresa'
        : '/admin/funcional';

  // Solo ADM tiene más de una página bajo su rol — EMPRESA (RRHH) y
  // FUNCIONAL hoy son cada uno una sola pantalla (ver admin/empresa y
  // admin/funcional), así que no hay nada real que listar en su nav
  // todavía. Grupos (no una lista plana) porque 7 links de ADM en una
  // sola columna sin separación es difícil de escanear — mismo criterio
  // del mockup de rediseño (task #47).
  const navGroups: AdminNavGroup[] =
    admin.profileType === 'ADM'
      ? [
          {
            label: t('groupPlatform'),
            items: [
              { href: '/admin/configuracion', label: t('settings'), icon: '⚙️' },
              { href: '/admin/contenido', label: t('content'), icon: '📄' },
              { href: '/admin/metodologia', label: t('methodology'), icon: '🧭' }
            ]
          },
          {
            label: t('groupAccounts'),
            items: [
              { href: '/admin/empresas', label: t('companies'), icon: '🏢' },
              { href: '/admin/administradores', label: t('admins'), icon: '🛡️' },
              { href: '/admin/empleados', label: t('employees'), icon: '👤' },
              { href: '/admin/notificaciones', label: t('notifications'), icon: '🔔' }
            ]
          }
        ]
      : [];

  const roleLabel =
    admin.profileType === 'ADM' ? t('platformRole') : admin.profileType === 'EMPRESA' ? t('tenantRole') : t('functionalRole');
  const tenantLabel = admin.profileType === 'EMPRESA' ? (admin.tenant?.name ?? '') : t('platformTenantLabel');

  // Nota: este layout NO envuelve `children` en runWithTenantContext — ese
  // contexto no se propaga a la Page anidada en Next.js App Router (cada
  // segmento de ruta corre en su propio tramo async). Cada page.tsx/
  // actions.ts bajo /admin resuelve su propio contexto vía
  // src/lib/auth/admin-context.ts (requireAdmin/requireAdminWithContext).
  return (
    <div className="min-h-screen lg:flex">
      <AdminSidebar
        hasLogo={hasLogo}
        homeHref={homeHref}
        roleLabel={roleLabel}
        tenantLabel={tenantLabel}
        navGroups={navGroups}
        logoutLabel={t('logout')}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AdminMobileNav
          hasLogo={hasLogo}
          homeHref={homeHref}
          navGroups={navGroups}
          logoutLabel={t('logout')}
          openLabel={t('openMenu')}
          closeLabel={t('closeMenu')}
        />

        <div className="flex-1 flex flex-col">{children}</div>

        <footer className="border-t border-silver/40 shrink-0 py-2 text-center">
          <p className="text-[10px] text-silver">
            {tVersion('label', { sha: shortSha })} · {contextLabel}
          </p>
        </footer>
      </div>
    </div>
  );
}
