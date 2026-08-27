import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { scoreToDimensionState, scoreToProgressTier } from '@/lib/engines/scoring';

const BAND_CLASS: Record<string, string> = {
  CRITICAL: 'bg-bad/10 text-bad',
  UNMET: 'bg-warn/10 text-warn',
  PARTIAL: 'bg-warn/10 text-warn',
  MET: 'bg-ok/10 text-ok',
  NA: 'bg-silver/20 text-nickel'
};

export default async function ResultadoPage() {
  const employee = await requireEmployee();
  const employeeId = employee.id;

  return runWithTenantContext(employeeTenantContext(employee), async () => {
    const financialState = await prisma.financialState.findUnique({ where: { employeeId } });
    if (!financialState) {
      // Diagnóstico incompleto: manda de vuelta a responder.
      redirect('/diagnostico');
    }

    const methodology = await prisma.methodology.findFirst({
      where: { status: 'ACTIVE' },
      include: { dimensions: { orderBy: { code: 'asc' } } }
    });
    const dimensionScores = await prisma.dimensionScore.findMany({
      where: { employeeId }
    });
    const scoreByDimensionId = new Map(dimensionScores.map((ds) => [ds.dimensionId, ds]));

    const t = await getTranslations('diagnostic.result');
    const tDim = await getTranslations('diagnostic.dimensions');
    const tBand = await getTranslations('diagnostic.result.bands');
    const tLevel = await getTranslations('diagnostic.result.levels');

    const cfhiRounded = Math.round(financialState.cfhiScore);
    const cfhiBand = scoreToDimensionState(cfhiRounded);
    const cfhiLevel = scoreToProgressTier(cfhiRounded);

    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-xs text-nickel mb-1">{t('title')}</p>
          <p className="text-5xl font-medium text-yale leading-none mb-1">{cfhiRounded}</p>
          <p className="text-[11px] text-nickel mb-2">{t('outOf100')}</p>
          <span className={`inline-block text-[11px] px-2.5 py-1 rounded-lg mr-1.5 ${BAND_CLASS[cfhiBand]}`}>
            {tBand(cfhiBand)}
          </span>
          <span className="inline-block text-[11px] px-2.5 py-1 rounded-lg bg-picton/10 text-yale">
            {tLevel('prefix')}: {tLevel(cfhiLevel)}
          </span>

          <p className="text-xs text-nickel text-left mt-8 mb-2">{t('dimensionsTitle')}</p>
          <div className="space-y-2 text-left">
            {methodology?.dimensions.map((dimension) => {
              const ds = scoreByDimensionId.get(dimension.id);
              const isNA = ds?.state === 'NA';
              const score = ds && !isNA ? Math.round(ds.score) : null;
              const band = isNA ? 'NA' : score !== null ? scoreToDimensionState(score) : null;
              const level = !isNA && score !== null ? scoreToProgressTier(score) : null;

              return (
                <div key={dimension.id} className="border border-silver/50 rounded-lg p-3 bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-quartz">{tDim(dimension.code)}</span>
                    <div className="flex items-center gap-1">
                      {level ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-picton/10 text-yale">
                          {tLevel(level)}
                        </span>
                      ) : null}
                      {band ? (
                        <span className={`text-[10px] px-2 py-0.5 rounded-lg ${BAND_CLASS[band]}`}>
                          {isNA ? t('debtNotApplicable') : `${score} · ${tBand(band)}`}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!isNA && score !== null ? (
                    <div className="h-1.5 bg-silver/30 rounded-full overflow-hidden">
                      <div className="h-full bg-cola" style={{ width: `${score}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <Link
            href="/diagnostico/accion"
            className="block mt-6 text-center bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
          >
            {t('ctaNextStep')}
          </Link>
        </div>
      </main>
    );
  });
}
