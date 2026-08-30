import { prisma } from '@/lib/db/prisma';
import { scoreToProgressTier } from './scoring';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { CTX_VARIABLE_CODES, type CtxKey } from './social-comparison';
import type { DimensionAggregate, CfhiTierDistribution } from './tenant-aggregates';

// Segmentación del dashboard de RRHH por las mismas 5 variables
// contextuales del Motor de Comparación Social (spec §16: "permitir
// filtrar/analizar por las mismas 5 variables"). Distinto de
// tenant-aggregates.ts (agregado de TODO el tenant, umbral
// Tenant.aggregationMinSegmentSize): acá el umbral es
// PlatformSettings.socialComparisonMinNRRHH — deliberadamente separado y
// más estricto, porque un segmento (ej. "mujeres, 25-34, ingreso bajo")
// tiene mucho más riesgo de identificar a alguien que el tenant completo.
//
// Mitigación de reconstrucción de identidad por filtros sucesivos (spec:
// "guardar contra reconstrucción de identidad por filtros sucesivos"): la
// única defensa que el MVP implementa — y la que de verdad cierra el
// vector de ataque — es que CADA combinación de filtros, sin excepción,
// pasa por el mismo umbral mínimo antes de devolver cualquier agregado. Un
// admin no puede "acorralar" a una persona estrechando filtros
// progresivamente porque el momento en que el segmento cae por debajo del
// umbral, deja de devolver cualquier dato — no hay forma de ver "falta 1
// persona para completar el grupo". No se agrega historial de consultas ni
// rate-limiting por sesión: es más superficie para el MVP sin cerrar nada
// que este control no cierre ya.
export type SegmentFilters = Partial<Record<CtxKey, string>>;

export type TenantSegmentAggregatesResult =
  | { status: 'NO_FILTER' }
  | { status: 'INSUFFICIENT_ANONYMITY'; employeeCount: number; minRequired: number }
  | {
      status: 'OK';
      employeeCount: number;
      averageCfhi: number;
      cfhiTierDistribution: CfhiTierDistribution;
      dimensions: DimensionAggregate[];
    };

async function intersectEmployeeIdsInTenant(
  tenantId: string,
  filters: [CtxKey, string][],
  varIdByKey: Map<CtxKey, string>
): Promise<Set<string>> {
  let result: Set<string> | null = null;

  for (const [key, targetState] of filters) {
    const variableId = varIdByKey.get(key);
    if (!variableId) return new Set();

    const rows = await prisma.variableState.findMany({
      where: { variableId, state: targetState, employee: { tenantId } },
      select: { employeeId: true }
    });
    const ids = new Set(rows.map((r) => r.employeeId));

    if (result === null) {
      result = ids;
    } else {
      const next = new Set<string>();
      result.forEach((id) => {
        if (ids.has(id)) next.add(id);
      });
      result = next;
    }
    if (result.size === 0) return result;
  }

  return result ?? new Set();
}

export async function getTenantSegmentAggregates(
  tenantId: string,
  filters: SegmentFilters
): Promise<TenantSegmentAggregatesResult> {
  const activeFilters = (Object.entries(filters) as [CtxKey, string | undefined][]).filter(
    (entry): entry is [CtxKey, string] => Boolean(entry[1])
  );
  if (activeFilters.length === 0) return { status: 'NO_FILTER' };

  const settings = await getPlatformSettings();

  const variables = await prisma.variable.findMany({
    where: { code: { in: activeFilters.map(([key]) => CTX_VARIABLE_CODES[key]) } },
    select: { id: true, code: true }
  });
  const varIdByKey = new Map<CtxKey, string>();
  for (const [key, code] of Object.entries(CTX_VARIABLE_CODES) as [CtxKey, string][]) {
    const found = variables.find((v) => v.code === code);
    if (found) varIdByKey.set(key, found.id);
  }

  const candidateIds = await intersectEmployeeIdsInTenant(tenantId, activeFilters, varIdByKey);

  const financialStates =
    candidateIds.size > 0
      ? await prisma.financialState.findMany({
          where: { employeeId: { in: [...candidateIds] }, lastDiagnosticCompletedAt: { not: null } },
          select: { cfhiScore: true, employeeId: true }
        })
      : [];

  const employeeCount = financialStates.length;
  if (employeeCount < settings.socialComparisonMinNRRHH) {
    return { status: 'INSUFFICIENT_ANONYMITY', employeeCount, minRequired: settings.socialComparisonMinNRRHH };
  }

  const averageCfhi = financialStates.reduce((sum, fs) => sum + fs.cfhiScore, 0) / employeeCount;
  const qualifyingEmployeeIds = financialStates.map((fs) => fs.employeeId);

  const tierCutoffs = { mid: settings.progressTierMidCutoff, high: settings.progressTierHighCutoff };
  const cfhiTierDistribution: CfhiTierDistribution = { LOW: 0, MID: 0, HIGH: 0 };
  for (const fs of financialStates) {
    cfhiTierDistribution[scoreToProgressTier(fs.cfhiScore, tierCutoffs)] += 1;
  }

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

    const averageScore = nonNaScores.length > 0 ? nonNaScores.reduce((sum, v) => sum + v, 0) / nonNaScores.length : null;

    return { code: dimension.code, averageScore, stateDistribution: distribution };
  });

  return { status: 'OK', employeeCount, averageCfhi, cfhiTierDistribution, dimensions };
}
