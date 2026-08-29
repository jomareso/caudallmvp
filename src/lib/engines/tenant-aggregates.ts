import { prisma } from '@/lib/db/prisma';
import { scoreToProgressTier } from './scoring';
import { getPlatformSettings } from '@/lib/settings/platform-settings';

// spec (docs/data-model.md, Bloque 7) + Decisión 1: la empresa nunca ve
// datos individuales de empleados, solo agregados anonimizados con un
// umbral mínimo por segmento. Si el tenant todavía no tiene suficientes
// empleados con diagnóstico completo, este motor devuelve
// INSUFFICIENT_ANONYMITY en vez de cualquier número real — no hay forma
// de que quien llame a este motor obtenga un score individual: solo
// promedios y conteos por estado, nunca una fila de VariableState/
// DimensionScore/FinancialState por empleado.
//
// registeredCount/completionRate son la excepción: son conteos de
// participación (cuántos se registraron, cuántos terminaron), no
// resultado de diagnóstico — igual que el conteo de licencias, se
// muestran aunque no se alcance el umbral de anonimato.

export type DimensionAggregate = {
  code: string;
  averageScore: number | null;
  stateDistribution: Record<'CRITICAL' | 'UNMET' | 'PARTIAL' | 'MET' | 'NA', number>;
};

// Metodología v1.5 §6: en el dashboard de RRHH, la condición general se
// resume con Vulnerables/Sobreviviendo/Saludables (3 niveles) — distinto
// de las 4 bandas CRITICAL/UNMET/PARTIAL/MET que usa el detalle por
// dimensión, mismos cortes que el nivel de progreso del empleado
// (scoreToProgressTier).
export type CfhiTierDistribution = Record<'LOW' | 'MID' | 'HIGH', number>;

export type TenantAggregatesResult =
  | {
      status: 'INSUFFICIENT_ANONYMITY';
      employeeCount: number;
      minRequired: number;
      registeredCount: number;
      completionRate: number;
    }
  | {
      status: 'OK';
      employeeCount: number;
      registeredCount: number;
      completionRate: number;
      averageCfhi: number;
      cfhiTierDistribution: CfhiTierDistribution;
      actionCommitmentRate: number;
      dimensions: DimensionAggregate[];
    };

export async function getTenantAggregates(tenantId: string): Promise<TenantAggregatesResult> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const [registeredCount, financialStates] = await Promise.all([
    prisma.employee.count({ where: { tenantId } }),
    prisma.financialState.findMany({
      where: { employee: { tenantId } },
      select: { cfhiScore: true, employeeId: true }
    })
  ]);

  const employeeCount = financialStates.length;
  const completionRate = registeredCount > 0 ? employeeCount / registeredCount : 0;

  if (employeeCount < tenant.aggregationMinSegmentSize) {
    return {
      status: 'INSUFFICIENT_ANONYMITY',
      employeeCount,
      minRequired: tenant.aggregationMinSegmentSize,
      registeredCount,
      completionRate
    };
  }

  const averageCfhi = financialStates.reduce((sum, fs) => sum + fs.cfhiScore, 0) / employeeCount;
  const qualifyingEmployeeIds = financialStates.map((fs) => fs.employeeId);

  const settings = await getPlatformSettings();
  const tierCutoffs = { mid: settings.progressTierMidCutoff, high: settings.progressTierHighCutoff };
  const cfhiTierDistribution: CfhiTierDistribution = { LOW: 0, MID: 0, HIGH: 0 };
  for (const fs of financialStates) {
    cfhiTierDistribution[scoreToProgressTier(fs.cfhiScore, tierCutoffs)] += 1;
  }

  const committedEmployeeIds = await prisma.employeeIntervention.findMany({
    where: {
      employeeId: { in: qualifyingEmployeeIds },
      status: { in: ['COMMITTED', 'IN_PROGRESS', 'COMPLETED'] }
    },
    select: { employeeId: true },
    distinct: ['employeeId']
  });
  const actionCommitmentRate = committedEmployeeIds.length / employeeCount;

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

  return {
    status: 'OK',
    employeeCount,
    registeredCount,
    completionRate,
    averageCfhi,
    cfhiTierDistribution,
    actionCommitmentRate,
    dimensions
  };
}
