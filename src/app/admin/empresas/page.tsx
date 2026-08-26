import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { CreateTenantForm } from './create-tenant-form';

export default async function EmpresasPage() {
  await requireAdm();

  const t = await getTranslations('admin.empresas');

  // ADM ve licencias de TODOS los tenants a propósito (control total de la
  // plataforma), de ahí platform-admin.
  const tenants = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    prisma.tenant.findMany({
      include: { licenses: { select: { status: true } } },
      orderBy: { createdAt: 'desc' }
    })
  );
  const tSuspended = t('suspendedBadge');

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        <CreateTenantForm
          labels={{
            nameLabel: t('nameLabel'),
            namePlaceholder: t('namePlaceholder'),
            licenseCountLabel: t('licenseCountLabel'),
            durationLabel: t('durationLabel'),
            duration3: t('duration3'),
            duration6: t('duration6'),
            duration12: t('duration12'),
            cta: t('createCta'),
            creating: t('creating'),
            errorGeneric: t('errorGeneric'),
            adminEmailsLabel: t('adminEmailsLabel'),
            adminEmailsPlaceholder: t('adminEmailsPlaceholder'),
            adminEmailsHelp: t('adminEmailsHelp'),
            adminResultsTitle: t('adminResultsTitle'),
            adminCreated: t('adminCreated'),
            adminWelcomeEmailFailed: t('adminWelcomeEmailFailed'),
            adminDuplicate: t('adminDuplicate'),
            adminInvalidFormat: t('adminInvalidFormat'),
            continueCta: t('continueCta')
          }}
        />

        <h2 className="text-sm font-medium text-quartz mt-6 mb-2">{t('existingTitle')}</h2>
        <div className="space-y-2">
          {tenants.map((tenant) => {
            const unused = tenant.licenses.filter((l) => l.status === 'UNUSED').length;
            const active = tenant.licenses.filter((l) => l.status === 'ACTIVE').length;
            const expired = tenant.licenses.filter((l) => l.status === 'EXPIRED').length;
            return (
              <Link
                key={tenant.id}
                href={`/admin/empresas/${tenant.id}`}
                className="block bg-white border border-silver/60 rounded-lg p-3 text-xs hover:border-cola"
              >
                <p className="text-quartz font-medium">
                  {tenant.name}
                  {tenant.status === 'SUSPENDED' ? (
                    <span className="ml-2 text-[10px] bg-bad/10 text-bad rounded px-1.5 py-0.5 align-middle">
                      {tSuspended}
                    </span>
                  ) : null}
                </p>
                <p className="text-nickel">
                  {t('licenseSummary', { active, unused, expired, total: tenant.licenses.length })}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
