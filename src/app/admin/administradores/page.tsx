import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { CreateAdminForm } from './create-admin-form';
import { AdminRow } from './admin-row';

const PROFILE_LABEL_KEY: Record<string, string> = {
  ADM: 'profileTypeAdm',
  EMPRESA: 'profileTypeEmpresa',
  FUNCIONAL: 'profileTypeFuncional'
};

const FUNCTIONAL_ROLE_LABEL_KEY: Record<string, string> = {
  METHODOLOGIST: 'functionalRoleMethodologist',
  PRODUCT_ADMIN: 'functionalRoleProductAdmin',
  ANALYST: 'functionalRoleAnalyst',
  VIEWER: 'functionalRoleViewer'
};

export default async function AdministradoresPage() {
  const admin = await requireAdm();

  // ADM ve administradores de TODOS los tenants a propósito — es su
  // alcance (control total de la plataforma), de ahí platform-admin.
  const [admins, tenants] = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    Promise.all([
      prisma.adminUser.findMany({ include: { tenant: true }, orderBy: { createdAt: 'desc' } }),
      prisma.tenant.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
    ])
  );

  const t = await getTranslations('admin.administradores');

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-4xl (no max-w-sm): mismo criterio que Configuración/RRHH/
          Empresas — el sidebar ya deja mucho más ancho disponible. */}
      <div className="w-full max-w-4xl">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        {/* El formulario se queda en su propio ancho (max-w-md): nunca
            tiene más de 3 campos visibles a la vez (email + tipo de
            perfil + UNO de empresa/rol funcional), no se beneficia de
            más ancho. */}
        <div className="max-w-md mb-8">
          <CreateAdminForm
            tenants={tenants}
            labels={{
              emailLabel: t('emailLabel'),
              emailPlaceholder: t('emailPlaceholder'),
              profileTypeLabel: t('profileTypeLabel'),
              profileTypeAdm: t('profileTypeAdm'),
              profileTypeEmpresa: t('profileTypeEmpresa'),
              profileTypeFuncional: t('profileTypeFuncional'),
              tenantLabel: t('tenantLabel'),
              tenantPlaceholder: t('tenantPlaceholder'),
              functionalRoleLabel: t('functionalRoleLabel'),
              functionalRoleMethodologist: t('functionalRoleMethodologist'),
              functionalRoleProductAdmin: t('functionalRoleProductAdmin'),
              functionalRoleAnalyst: t('functionalRoleAnalyst'),
              functionalRoleViewer: t('functionalRoleViewer'),
              cta: t('cta'),
              creating: t('creating'),
              success: t('success')
            }}
          />
        </div>

        <h2 className="text-sm font-medium text-quartz mb-2">{t('existingTitle')}</h2>
        <div className="space-y-2">
          {admins.map((a) => (
            <AdminRow
              key={a.id}
              admin={{
                id: a.id,
                email: a.email,
                profileType: a.profileType,
                functionalRole: a.functionalRole,
                tenantId: a.tenantId,
                active: a.active,
                tenantName: a.tenant?.name ?? null,
                profileLabel:
                  t(PROFILE_LABEL_KEY[a.profileType]) +
                  (a.functionalRole ? ` · ${t(FUNCTIONAL_ROLE_LABEL_KEY[a.functionalRole])}` : '')
              }}
              tenants={tenants}
              isSelf={a.id === admin.id}
              labels={{
                profileTypeAdm: t('profileTypeAdm'),
                profileTypeEmpresa: t('profileTypeEmpresa'),
                profileTypeFuncional: t('profileTypeFuncional'),
                tenantPlaceholder: t('tenantPlaceholder'),
                functionalRoleMethodologist: t('functionalRoleMethodologist'),
                functionalRoleProductAdmin: t('functionalRoleProductAdmin'),
                functionalRoleAnalyst: t('functionalRoleAnalyst'),
                functionalRoleViewer: t('functionalRoleViewer'),
                editCta: t('editCta'),
                saveCta: t('saveCta'),
                saving: t('creating'),
                cancelCta: t('cancelCta'),
                deactivateCta: t('deactivateCta'),
                activateCta: t('activateCta'),
                inactiveBadge: t('inactiveBadge')
              }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
