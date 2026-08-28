import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { scoreToDimensionState, scoreToProgressTier } from '@/lib/engines/scoring';
import { countContextAnsweredAndTotal } from '@/lib/engines/diagnostic';
import { getNationalComparison, getSegmentComparison, type NationalComparison } from '@/lib/engines/national-benchmark';
import { EmployeeTopBar } from '../../employee-topbar';
import { SegmentComparison, type ComparisonRow, type ComparisonTab } from './segment-comparison';
import { ScoreGauge } from './score-gauge';

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

    const { answered: ctxAnswered, total: ctxTotal } = await countContextAnsweredAndTotal(employeeId);
    const showContextBanner = ctxTotal > 0 && ctxAnswered < ctxTotal;
    const [generalComparison, ageComparison, incomeComparison, sexComparison] = await Promise.all([
      getNationalComparison(employeeId),
      getSegmentComparison(employeeId, 'AGE'),
      getSegmentComparison(employeeId, 'INCOME'),
      getSegmentComparison(employeeId, 'SEX')
    ]);

    const t = await getTranslations('diagnostic.result');
    const tDim = await getTranslations('diagnostic.dimensions');
    const tLevel = await getTranslations('diagnostic.result.levels');
    const tInterpretation = await getTranslations('diagnostic.result.interpretation');

    const cfhiRounded = Math.round(financialState.cfhiScore);
    const cfhiBand = scoreToDimensionState(cfhiRounded);
    const cfhiLevel = scoreToProgressTier(cfhiRounded);

    // Resiliencia queda fuera a propósito (regla CORE #5 — ver
    // national-benchmark.ts): el estudio de origen no la mide aparte.
    const BENCHMARK_FIELD_BY_DIMENSION: Record<string, 'control' | 'saving' | 'debt' | 'planning'> = {
      CONTROL: 'control',
      SAVING: 'saving',
      DEBT: 'debt',
      PLANNING: 'planning'
    };
    function buildComparisonRows(comparison: NationalComparison): ComparisonRow[] {
      return [
        { code: 'CFHI', label: t('title'), you: cfhiRounded, avg: comparison.overall },
        ...(methodology?.dimensions ?? [])
          .filter((d) => d.code in BENCHMARK_FIELD_BY_DIMENSION)
          .map((d): ComparisonRow | null => {
            const ds = scoreByDimensionId.get(d.id);
            const isNA = ds?.state === 'NA';
            const score = ds && !isNA ? Math.round(ds.score) : null;
            if (score === null) return null;
            return { code: d.code, label: tDim(d.code), you: score, avg: comparison[BENCHMARK_FIELD_BY_DIMENSION[d.code]] };
          })
          .filter((row): row is ComparisonRow => row !== null)
      ];
    }
    function buildSubtitle(comparison: NationalComparison): string {
      return comparison.scope === 'COHORT'
        ? t('comparison.subtitleCohort', { n: comparison.n })
        : t('comparison.subtitleNational', { n: comparison.n });
    }

    // Ítem 9 de la auditoría UX: además del comparativo general (cohorte
    // combinada sexo × edad × situación laboral, o nacional si esa
    // cohorte es muy chica), el empleado puede elegir UNA variable a la
    // vez. Una pestaña solo aparece si esa variable puntual tiene datos
    // (el empleado la respondió y no la declinó) — ver getSegmentComparison.
    const segmentDefs: { key: ComparisonTab['key']; labelKey: string; comparison: NationalComparison | null }[] = [
      { key: 'GENERAL', labelKey: 'general', comparison: generalComparison },
      { key: 'AGE', labelKey: 'age', comparison: ageComparison },
      { key: 'INCOME', labelKey: 'income', comparison: incomeComparison },
      { key: 'SEX', labelKey: 'sex', comparison: sexComparison }
    ];
    const comparisonTabs: ComparisonTab[] = segmentDefs
      .filter((def): def is typeof def & { comparison: NationalComparison } => def.comparison !== null)
      .map((def) => ({
        key: def.key,
        label: t(`comparison.tabs.${def.labelKey}`),
        subtitle: buildSubtitle(def.comparison),
        rows: buildComparisonRows(def.comparison)
      }));

    return (
      <div className="min-h-screen flex flex-col">
        <EmployeeTopBar />
        <main className="flex-1 flex flex-col items-center p-6 pt-10">
        <div className="w-full max-w-sm lg:max-w-2xl text-center">
          <div className="lg:max-w-md lg:mx-auto">
            <p className="text-xs text-nickel mb-2">{t('title')}</p>
            <ScoreGauge
              score={cfhiRounded}
              vsAverage={generalComparison ? cfhiRounded - generalComparison.overall : null}
              outOfLabel={t('outOf100')}
              vsAverageLabel={t('comparison.vsAverage')}
            />
            <span className="inline-block text-[11px] px-2.5 py-1 rounded-lg bg-picton/10 text-yale mt-2">
              {tLevel('prefix')}: {tLevel(cfhiLevel)}
            </span>

            <p className="text-xs text-nickel text-left mt-3 leading-relaxed">
              {tInterpretation(`cfhi.${cfhiBand}`)}
            </p>
          </div>

          <p className="text-xs text-nickel text-left mt-8 mb-2">{t('dimensionsTitle')}</p>
          <div className="space-y-2 text-left lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
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
                      {isNA || score !== null ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-silver/20 text-nickel">
                          {isNA ? t('debtNotApplicable') : score}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!isNA && score !== null ? (
                    <div className="h-1.5 bg-silver/30 rounded-full overflow-hidden">
                      <div className="h-full bg-cola" style={{ width: `${score}%` }} />
                    </div>
                  ) : null}
                  {!isNA && band ? (
                    <p className="text-[11px] text-nickel mt-1.5 leading-relaxed">
                      {tInterpretation(`dimensions.${dimension.code}.${band}`)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="lg:max-w-md lg:mx-auto">
            {comparisonTabs.length > 0 ? (
              <SegmentComparison
                tabs={comparisonTabs}
                labels={{
                  title: t('comparison.title'),
                  you: t('comparison.you'),
                  average: t('comparison.average'),
                  vsAverage: t('comparison.vsAverage'),
                  privacyNote: t('comparison.privacyNote')
                }}
              />
            ) : null}

            {showContextBanner ? (
              <div className="mt-6 bg-picton/10 border border-cola/30 rounded-lg p-4 text-left">
                <p className="text-xs text-nickel mb-2">{t('contextBanner.body')}</p>
                <Link href="/diagnostico/contexto" className="text-xs text-yale underline">
                  {t('contextBanner.cta')}
                </Link>
              </div>
            ) : null}

            <Link
              href="/diagnostico/accion"
              className="block mt-6 text-center bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
            >
              {t('ctaNextStep')}
            </Link>
          </div>
        </div>
        </main>
      </div>
    );
  });
}
