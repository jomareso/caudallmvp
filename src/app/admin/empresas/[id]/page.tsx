import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { GenerateLicensesForm } from './generate-licenses-form';
import { TenantNameForm } from './tenant-name-form';
import { TenantBrandingForm } from './tenant-branding-form';
import { SuspendTenantButton } from './suspend-tenant-button';

const STATUS_LABEL_KEY: Record<string, string> = {
  UNUSED: 'statusUnused',
  ACTIVE: 'statusActive',
  EXPIRED: 'statusExpired'
};

export default async function EmpresaDetallePage({ params }: { params: { id: string } }) {
  await requireAdm();

  const t = await getTranslations('admin.empresas');
  const dateFormat = new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeZone: 'America/Santo_Domingo'
  });
  const settings = await getPlatformSettings();
  const durationOptions = settings.licenseDurationsMonths.map((months) => ({
    value: months,
    label: t('durationValue', { months })
  }));

  // ADM ve el detalle de CUALQUIER tenant a propósito, de ahí platform-admin.
  const tenant = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    prisma.tenant.findUnique({
      where: { id: params.id },
      include: { licenses: { orderBy: { createdAt: 'desc' }, include: { employee: true } } }
    })
  );
  if (!tenant) notFound();

  const suspended = tenant.status === 'SUSPENDED';

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-medium text-quartz">{tenant.name}</h1>
          <SuspendTenantButton
            tenantId={tenant.id}
            suspended={suspended}
            labels={{
              suspendCta: t('suspendCta'),
              reactivateCta: t('reactivateCta'),
              confirmSuspend: t('confirmSuspend')
            }}
          />
        </div>
        {suspended ? <p className="text-xs text-bad mb-4">{t('suspendedNotice')}</p> : null}

        <Link
          href={`/admin/empresas/${tenant.id}/dashboard`}
          className="inline-block text-xs text-yale font-medium mb-6 hover:underline"
        >
          {t('viewDashboardCta')}
        </Link>

        <div className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
          <TenantNameForm
            tenantId={tenant.id}
            initialName={tenant.name}
            labels={{
              nameLabel: t('nameLabel'),
              cta: t('saveCta'),
              saving: t('saving'),
              errorGeneric: t('errorGeneric')
            }}
          />
        </div>

        <TenantBrandingForm
          tenantId={tenant.id}
          initialPrimaryColor={tenant.primaryColor}
          initialLogoUrl={tenant.logoUrl}
          labels={{
            title: t('brandingTitle'),
            colorLabel: t('brandingColorLabel'),
            logoLabel: t('brandingLogoLabel'),
            logoPlaceholder: t('brandingLogoPlaceholder'),
            cta: t('saveCta'),
            saving: t('saving'),
            errorGeneric: t('errorGeneric')
          }}
        />

        <GenerateLicensesForm
          tenantId={tenant.id}
          durationOptions={durationOptions}
          labels={{
            title: t('generateTitle'),
            licenseCountLabel: t('licenseCountLabel'),
            durationLabel: t('durationLabel'),
            cta: t('generateCta'),
            creating: t('creating'),
            errorGeneric: t('errorGeneric'),
            success: t('generateSuccess')
          }}
        />

        <h2 className="text-sm font-medium text-quartz mt-6 mb-2">
          {t('licensesTitle', { count: tenant.licenses.length })}
        </h2>
        <div className="space-y-2">
          {tenant.licenses.map((license) => (
            <div key={license.id} className="bg-white border border-silver/60 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-quartz">{license.code}</span>
                <span
                  className={
                    license.status === 'ACTIVE'
                      ? 'bg-ok/10 text-ok rounded px-1.5 py-0.5'
                      : license.status === 'EXPIRED'
                        ? 'bg-bad/10 text-bad rounded px-1.5 py-0.5'
                        : 'bg-silver/40 text-nickel rounded px-1.5 py-0.5'
                  }
                >
                  {t(STATUS_LABEL_KEY[license.status])}
                </span>
              </div>
              <p className="text-nickel mt-1">
                {t('durationValue', { months: license.durationMonths })}
                {license.employee ? ` · ${license.employee.personalEmail}` : ''}
                {license.expiresAt ? ` · ${t('expiresAt')}: ${dateFormat.format(license.expiresAt)}` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
