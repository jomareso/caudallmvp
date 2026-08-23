import { prisma } from '@/lib/db/prisma';

// spec (docs/data-model.md, Bloque 7) + Decisión 1: la empresa nunca ve
// datos individuales de empleados, solo agregados anonimizados con un
// umbral mínimo por segmento. Si el tenant todavía no tiene suficientes
// empleados con diagnóstico completo, este motor devuelve
// INSUFFICIENT_ANONYMITY en vez de cualquier número real — no hay forma
// de que quien llame a este motor obtenga un score individual: solo
// promedios y conteos por estado, nunca una fila de VariableState/
// DimensionScore/FinancialState por empleado.

export type DimensionAggregate = {
  code: string;
  averageScore: number | null;
  stateDistribution: Record<'CRITICAL' | 'UNMET' | 'PARTIAL' | 'MET' | 'NA', number>;
};

export type TenantAggregatesResult =
  | { status: 'INSUFFICIENT_ANONYMITY'; employeeCount: number; minRequired: number }
  | { status: 'OK'; employeeCount: number; averageCfhi: number; dimensions: DimensionAggregate[] };

export async function getTenantAggregates(tenantId: string): Promise<TenantAggregatesResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const financialStates = await prisma.financialState.findMany({
    where: { employee: { tenantId } },
    select: { cfhiScore: true, employeeId: true }
  });

  const employeeCount = financialStates.length;
  if (employeeCount < tenant.aggregationMinSegmentSize) {
    return { status: 'INSUFFICIENT_ANONYMITY', employeeCount, minRequired: tenant.aggregationMinSegmentSize };
  }

  const averageCfhi = financialStates.reduce((sum, fs) => sum + fs.cfhiScore, 0) / employeeCount;
  const qualifyingEmployeeIds = financialStates.map((fs) => fs.employeeId);

  const methodology = await prisma.methodology.findFirst({
    where: { status: 'ACTIVE' },
    include: { dimensions: { orderBy: { code: 'asc' } } }
  });

  const dimensionScores = methodology
    ? await prisma.dimensionScore.findMany({
        where: { employeeId: { in: qualifyingEmployeeIds }, dimensionId: { in: methodology.dimensions.map((d) => d.id) } }
      })
    : [];

  const scoresByDimensionId = new Map<string, typeof dimensionScores>();
  for (const ds of dimensionScores) {
    const list = scoresByDimensionId.get(ds.dimensionId) ?? [];
    list.push(ds);
    scoresByDimensionId.set(ds.dimensionId, list);
  }

  const dimensions: DimensionAggregate[] = (methodology?.dimensions ?? []).map((dimension) => {
    const scores = scoresByDimensionId.get(dimension.id) ?? [];
    const distribution: DimensionAggregate['stateDistribution'] = {
      CRITICAL: 0,
      UNMET: 0,
      PARTIAL: 0,
      MET: 0,
      NA: 0
    };
    const nonNaScores: number[] = [];

    for (const s of scores) {
      distribution[s.state] += 1;
      if (s.state !== 'NA') nonNaScores.push(s.score);
    }

    const averageScore =
      nonNaScores.length > 0 ? nonNaScores.reduce((sum, v) => sum + v, 0) / nonNaScores.length : null;

    return { code: dimension.code, averageScore, stateDistribution: distribution };
  });

  return { status: 'OK', employeeCount, averageCfhi, dimensions };
}
