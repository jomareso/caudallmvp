import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { CreateTenantForm } from './create-tenant-form';

export default async function EmpresasPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');

  const t = await getTranslations('admin.empresas');

  const tenants = await prisma.tenant.findMany({
    include: { licenses: { select: { status: true } } },
    orderBy: { createdAt: 'desc' }
  });

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
            errorGeneric: t('errorGeneric')
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
                <p className="text-quartz font-medium">{tenant.name}</p>
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
