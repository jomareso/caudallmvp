import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { getTenantAggregates } from '@/lib/engines/tenant-aggregates';
import { scoreToDimensionState } from '@/lib/engines/scoring';

const BAND_CLASS: Record<string, string> = {
  CRITICAL: 'bg-bad/10 text-bad',
  UNMET: 'bg-warn/10 text-warn',
  PARTIAL: 'bg-warn/10 text-warn',
  MET: 'bg-ok/10 text-ok',
  NA: 'bg-silver/20 text-nickel'
};

export default async function AdminEmpresaPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id }, include: { tenant: true } });
  if (!admin || admin.profileType !== 'EMPRESA' || !admin.tenant) redirect('/admin');

  const t = await getTranslations('admin.empresa');
  const tDim = await getTranslations('diagnostic.dimensions');
  const tBand = await getTranslations('diagnostic.result.bands');

  const [aggregates, licenseCounts] = await Promise.all([
    getTenantAggregates(admin.tenant.id),
    prisma.license.groupBy({ by: ['status'], where: { tenantId: admin.tenant.id }, _count: true })
  ]);

  const countByStatus = Object.fromEntries(licenseCounts.map((c) => [c.status, c._count])) as Record<
    'UNUSED' | 'ACTIVE' | 'EXPIRED',
    number
  >;
  const licenseSummary = {
    total: licenseCounts.reduce((sum, c) => sum + c._count, 0),
    unused: countByStatus.UNUSED ?? 0,
    active: countByStatus.ACTIVE ?? 0,
    expired: countByStatus.EXPIRED ?? 0
  };

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiringSoon = await prisma.license.count({
    where: {
      tenantId: admin.tenant.id,
      status: 'ACTIVE',
      expiresAt: { gte: new Date(), lte: thirtyDaysFromNow }
    }
  });

  // La tasa de finalización es participación (cuántos se registraron,
  // cuántos terminaron), no resultado del diagnóstico — se muestra igual
  // que las licencias, sin esperar al umbral de anonimato.
  const completionCard = (
    <div className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
      <p className="text-xs text-nickel mb-1">{t('completionTitle')}</p>
      <p className="text-2xl font-medium text-quartz leading-none mb-1">
        {Math.round(aggregates.completionRate * 100)}%
      </p>
      <p className="text-[11px] text-nickel">
        {t('completionDetail', { completed: aggregates.employeeCount, registered: aggregates.registeredCount })}
      </p>
    </div>
  );

  // Las licencias son visibles aunque todavía no haya suficientes
  // empleados con diagnóstico completo para el umbral de anonimato — no
  // son datos de un empleado en particular (Decisión 1), y RRHH necesita
  // saber cuántas le quedan disponibles desde el primer día.
  const licenseCard = (
    <div className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
      <p className="text-xs text-nickel mb-2">{t('licensesTitle')}</p>
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div>
          <p className="text-xl font-medium text-quartz">{licenseSummary.unused}</p>
          <p className="text-[11px] text-nickel">{t('licensesUnused')}</p>
        </div>
        <div>
          <p className="text-xl font-medium text-quartz">{licenseSummary.active}</p>
          <p className="text-[11px] text-nickel">{t('licensesActive')}</p>
        </div>
        <div>
          <p className="text-xl font-medium text-quartz">{licenseSummary.expired}</p>
          <p className="text-[11px] text-nickel">{t('licensesExpired')}</p>
        </div>
      </div>
      <p className="text-[11px] text-nickel text-center">{t('licensesTotal', { total: licenseSummary.total })}</p>
      {expiringSoon > 0 ? (
        <p className="text-[11px] text-warn text-center mt-1">{t('licensesExpiringSoon', { count: expiringSoon })}</p>
      ) : null}
    </div>
  );

  if (aggregates.status === 'INSUFFICIENT_ANONYMITY') {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-lg font-medium text-quartz mb-6">{t('title', { tenantName: admin.tenant.name })}</h1>
          {completionCard}
          {licenseCard}
          <h2 className="text-base font-medium text-quartz mb-2">{t('insufficientTitle')}</h2>
          <p className="text-sm text-nickel">
            {t('insufficientBody', { minRequired: aggregates.minRequired, count: aggregates.employeeCount })}
          </p>
        </div>
      </main>
    );
  }

  const cfhiRounded = Math.round(aggregates.averageCfhi);
  const cfhiBand = scoreToDimensionState(cfhiRounded);

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-1 text-center">
          {t('title', { tenantName: admin.tenant.name })}
        </h1>
        <p className="text-xs text-nickel mb-6 text-center">{t('employeeCount', { count: aggregates.employeeCount })}</p>

        {completionCard}
        {licenseCard}

        <div className="text-center mb-4">
          <p className="text-xs text-nickel mb-1">{t('averageCfhiLabel')}</p>
          <p className="text-5xl font-medium text-yale leading-none mb-1">{cfhiRounded}</p>
          <span className={`inline-block text-[11px] px-2.5 py-1 rounded-lg ${BAND_CLASS[cfhiBand]}`}>
            {tBand(cfhiBand)}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center mb-6">
          {(['CRITICAL', 'UNMET', 'PARTIAL', 'MET'] as const).map((band) => (
            <div key={band} className="border border-silver/50 rounded-lg py-2 bg-white">
              <p className="text-base font-medium text-quartz leading-none mb-1">
                {aggregates.cfhiBandDistribution[band]}
              </p>
              <p className="text-[10px] text-nickel">{tBand(band)}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
          <p className="text-xs text-nickel mb-1">{t('actionCommitmentTitle')}</p>
          <p className="text-2xl font-medium text-quartz leading-none mb-1">
            {Math.round(aggregates.actionCommitmentRate * 100)}%
          </p>
          <p className="text-[11px] text-nickel">{t('actionCommitmentDetail')}</p>
        </div>

        <p className="text-xs text-nickel mb-2">{t('dimensionsTitle')}</p>
        <div className="space-y-2 mb-6">
          {aggregates.dimensions.map((dimension) => {
            const score = dimension.averageScore !== null ? Math.round(dimension.averageScore) : null;
            const band = score !== null ? scoreToDimensionState(score) : 'NA';
            return (
              <div key={dimension.code} className="border border-silver/50 rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-quartz">{tDim(dimension.code)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg ${BAND_CLASS[band]}`}>
                    {score !== null ? `${score} · ${tBand(band)}` : tBand('NA')}
                  </span>
                </div>
                {score !== null ? (
                  <div className="h-1.5 bg-silver/30 rounded-full overflow-hidden">
                    <div className="h-full bg-cola" style={{ width: `${score}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-nickel text-center">{t('privacyNote')}</p>
      </div>
    </main>
  );
}
