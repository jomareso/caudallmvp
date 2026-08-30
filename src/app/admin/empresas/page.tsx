import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { CreateTenantForm } from './create-tenant-form';

export default async function EmpresasPage() {
  await requireAdm();

  const t = await getTranslations('admin.empresas');
  const settings = await getPlatformSettings();
  const durationOptions = settings.licenseDurationsMonths.map((months) => ({
    value: months,
    label: t('durationValue', { months })
  }));

  // ADM ve licencias de TODOS los tenants a propósito (control total de la
  // plataforma), de ahí platform-admin.
  const tenants = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    prisma.tenant.findMany({
      include: { licenses: { select: { status: true } } },
      orderBy: { createdAt: 'desc' }
    })
  );
  const tSuspended = t('suspendedBadge');
  const dateFormat = new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeZone: 'America/Santo_Domingo'
  });

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-6xl (no max-w-sm): la tabla de escritorio de abajo necesita
          más ancho que el resto de las páginas de admin ya migradas
          (Configuración usa 4xl) — 5 columnas con nombre+badges no caben
          cómodas en menos. */}
      <div className="w-full max-w-6xl">
        <header className="mb-6">
          <h1 className="text-lg font-medium text-quartz mb-1">{t('title')}</h1>
          <p className="text-xs text-nickel">{t('companyCount', { count: tenants.length })}</p>
        </header>

        {/* El formulario se queda en su propio ancho (max-w-md), no el 6xl
            de la página — sus campos no se benefician de más ancho, y
            estirarlo solo dejaría espacio vacío dentro de la tarjeta
            (mismo criterio que ya se aplicó en RRHH y Configuración). */}
        <div className="max-w-md mb-8">
          <CreateTenantForm
            durationOptions={durationOptions}
            labels={{
              nameLabel: t('nameLabel'),
              namePlaceholder: t('namePlaceholder'),
              employeeCountLabel: t('employeeCountLabel'),
              employeeCountPlaceholder: t('employeeCountPlaceholder'),
              employeeCountHelp: t('employeeCountHelp'),
              licenseCountLabel: t('licenseCountLabel'),
              durationLabel: t('durationLabel'),
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
        </div>

        <h2 className="text-sm font-medium text-quartz mb-2">{t('existingTitle')}</h2>

        {/* Tabla de verdad en escritorio (lg+) — antes era la misma lista
            vertical de tarjetitas que en móvil, sin usar el ancho
            disponible (mockup de rediseño, task #47). En móvil se queda
            la lista de tarjetas de siempre, sin tocar. */}
        <div className="hidden lg:block bg-white border border-silver/60 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-silver/60 text-left text-[11px] uppercase tracking-wide text-nickel">
                <th className="px-4 py-3 font-semibold">{t('tableEmpresaHeader')}</th>
                <th className="px-4 py-3 font-semibold">{t('tableEstadoHeader')}</th>
                <th className="px-4 py-3 font-semibold">{t('tableLicenciasHeader')}</th>
                <th className="px-4 py-3 font-semibold">{t('tableCreadaHeader')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const unused = tenant.licenses.filter((l) => l.status === 'UNUSED').length;
                const active = tenant.licenses.filter((l) => l.status === 'ACTIVE').length;
                const expired = tenant.licenses.filter((l) => l.status === 'EXPIRED').length;
                const initials = tenant.name
                  .split(/\s+/)
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <tr key={tenant.id} className="border-b border-silver/30 last:border-b-0 hover:bg-silver/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-yale/10 text-yale flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials}
                        </span>
                        <span className="text-quartz font-medium">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-lg ${
                          tenant.status === 'SUSPENDED' ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok'
                        }`}
                      >
                        {tenant.status === 'SUSPENDED' ? tSuspended : t('activeBadge')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-[12px] tabular-nums">
                        <span className="text-ok font-medium">
                          {active} {t('licenseActiveShort')}
                        </span>
                        <span className="text-nickel">
                          {unused} {t('licenseUnusedShort')}
                        </span>
                        <span className="text-bad">
                          {expired} {t('licenseExpiredShort')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-nickel">{dateFormat.format(tenant.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/empresas/${tenant.id}`} className="text-yale font-medium hover:underline">
                        {t('viewCta')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-2">
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
