// Comparación con pares — usa NationalBenchmarkRecord (Estudios de Salud
// Financiera 2021-2024, 4,748 encuestados). Regla CORE #5: no incluye
// Resiliencia porque el estudio de origen la mezcla con Ahorro (ver
// docs/decisions.md y el comentario en el modelo Prisma).
//
// Gate de consentimiento: CTX-07 (CTX_COMPARE_OPT_IN) es una pregunta
// explícita del banco — "¿Quieres comparar tus resultados...?" — que no
// afecta el score. Sin un YES explícito, no se calcula ni se muestra nada.
import { prisma } from '@/lib/db/prisma';
import { buildFacts } from './diagnostic';

export const MIN_COHORT_SIZE = 30;

export type ComparisonScope = 'COHORT' | 'NATIONAL';

export type NationalComparison = {
  scope: ComparisonScope;
  n: number;
  overall: number;
  control: number;
  saving: number;
  debt: number;
  planning: number;
};

type BenchmarkAverages = {
  overallScore: number | null;
  controlScore: number | null;
  savingScore: number | null;
  debtScore: number | null;
  planningScore: number | null;
};

// Puro — sin acceso a datos, fácil de probar. Decide si la muestra
// cruzada (sexo × banda de edad × situación laboral) alcanza para
// comparar con confianza, o si hay que caer al promedio nacional
// completo (regla CORE #13: no exigir más precisión de la necesaria).
export function selectComparisonScope(cohortCount: number, minSize: number = MIN_COHORT_SIZE): ComparisonScope {
  return cohortCount >= minSize ? 'COHORT' : 'NATIONAL';
}

// Puro — arma el filtro de cohorte a partir de los hechos ya conocidos
// del empleado (CTX-01/08/09), omitiendo lo que no respondió o declinó.
export function buildCohortWhere(facts: {
  sex?: string;
  ageBand?: string;
  employmentStatus?: string;
}): Record<string, string> {
  const where: Record<string, string> = {};
  if (facts.sex && facts.sex !== 'DECLINED') where.sex = facts.sex;
  if (facts.ageBand && facts.ageBand !== 'DECLINED') where.ageBand = facts.ageBand;
  if (facts.employmentStatus && facts.employmentStatus !== 'DECLINED') where.employmentStatus = facts.employmentStatus;
  return where;
}

function toComparison(scope: ComparisonScope, n: number, avg: BenchmarkAverages): NationalComparison {
  return {
    scope,
    n,
    overall: Math.round(avg.overallScore ?? 0),
    control: Math.round(avg.controlScore ?? 0),
    saving: Math.round(avg.savingScore ?? 0),
    debt: Math.round(avg.debtScore ?? 0),
    planning: Math.round(avg.planningScore ?? 0)
  };
}

const BENCHMARK_AVG_SELECT = {
  overallScore: true,
  controlScore: true,
  savingScore: true,
  debtScore: true,
  planningScore: true
} as const;

async function fetchNationalFallback(version: string): Promise<NationalComparison> {
  const nationalAgg = await prisma.nationalBenchmarkRecord.aggregate({
    where: { version },
    _avg: BENCHMARK_AVG_SELECT,
    _count: true
  });
  return toComparison('NATIONAL', nationalAgg._count, nationalAgg._avg);
}

export async function getNationalComparison(employeeId: string): Promise<NationalComparison | null> {
  const facts = await buildFacts(employeeId);
  if (facts.get('CTX_COMPARE_OPT_IN')?.state !== 'YES') return null;

  const latest = await prisma.nationalBenchmarkRecord.findFirst({
    select: { version: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!latest) return null;

  const cohortWhere = buildCohortWhere({
    sex: facts.get('CTX_SEX')?.state,
    ageBand: facts.get('CTX_AGE_BAND')?.state,
    employmentStatus: facts.get('CTX_EMPLOYMENT_STATUS')?.state
  });

  const cohortAgg = await prisma.nationalBenchmarkRecord.aggregate({
    where: { version: latest.version, ...cohortWhere },
    _avg: BENCHMARK_AVG_SELECT,
    _count: true
  });

  if (selectComparisonScope(cohortAgg._count) === 'COHORT') {
    return toComparison('COHORT', cohortAgg._count, cohortAgg._avg);
  }

  return fetchNationalFallback(latest.version);
}

export type SegmentVariable = 'AGE' | 'INCOME' | 'SEX';

// El estudio de origen (CTX_INCOME_BAND del banco de preguntas) usa
// rangos de RD$ distintos a los de este benchmark (incomeRangeRaw viene
// de encuestas de 2021-2024 con sus propios cortes) — no hay forma de
// alinearlos exacto sin el ingreso puntual de cada encuestado, que no
// existe. Cada rango de incomeRangeRaw se asigna al rango de
// CTX_INCOME_BAND que contiene su punto medio: es una aproximación
// (decisión de Reynoso, 28 ago — ver el PR), no un cruce exacto, por eso
// el comparativo de Ingresos usa scope COHORT/NATIONAL igual que los
// demás, sin pretender más precisión de la que hay.
export const INCOME_BAND_TO_RAW_RANGES: Record<string, string[]> = {
  INC_LT_25K: ['Menos de RD$ 13,500', 'RD$ 13,501 -RD$ 27,000'],
  INC_25_49K: ['RD$ 27,001 -RD$ 40,500', 'RD$ 40,501 -RD$ 54,000'],
  INC_50_74K: ['RD$ 54,001 -RD$ 81,000'],
  INC_75_99K: ['RD$ 81,001 -RD$ 108,000'],
  INC_100_149K: ['RD$ 108,001 -RD$ 135,000'],
  INC_150_199K: ['RD$ 135,001 -RD$ 202,500'],
  INC_200K_PLUS: ['Más de RD$ 202,500']
};

// A diferencia de getNationalComparison (que arma una sola cohorte
// cruzando sexo × edad × situación laboral), esto compara contra UNA sola
// variable a la vez — es lo que alimenta el selector de tabs en Resultado
// (ítem 9 de la auditoría UX). Si el empleado no respondió (o declinó)
// esa variable puntual, no hay cohorte que armar y se devuelve null: la
// pantalla simplemente no ofrece esa pestaña.
export async function getSegmentComparison(
  employeeId: string,
  variable: SegmentVariable
): Promise<NationalComparison | null> {
  const facts = await buildFacts(employeeId);
  if (facts.get('CTX_COMPARE_OPT_IN')?.state !== 'YES') return null;

  const latest = await prisma.nationalBenchmarkRecord.findFirst({
    select: { version: true },
    orderBy: { createdAt: 'desc' }
  });
  if (!latest) return null;

  let segmentWhere: Record<string, unknown>;
  if (variable === 'AGE') {
    const ageBand = facts.get('CTX_AGE_BAND')?.state;
    if (!ageBand || ageBand === 'DECLINED') return null;
    segmentWhere = { ageBand };
  } else if (variable === 'SEX') {
    const sex = facts.get('CTX_SEX')?.state;
    if (!sex || sex === 'DECLINED') return null;
    segmentWhere = { sex };
  } else {
    const incomeBand = facts.get('CTX_INCOME_BAND')?.state;
    const rawRanges = incomeBand ? INCOME_BAND_TO_RAW_RANGES[incomeBand] : undefined;
    if (!rawRanges) return null;
    segmentWhere = { incomeRangeRaw: { in: rawRanges } };
  }

  const cohortAgg = await prisma.nationalBenchmarkRecord.aggregate({
    where: { version: latest.version, ...segmentWhere },
    _avg: BENCHMARK_AVG_SELECT,
    _count: true
  });

  if (selectComparisonScope(cohortAgg._count) === 'COHORT') {
    return toComparison('COHORT', cohortAgg._count, cohortAgg._avg);
  }

  return fetchNationalFallback(latest.version);
}
