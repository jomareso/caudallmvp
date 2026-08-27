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
    _avg: { overallScore: true, controlScore: true, savingScore: true, debtScore: true, planningScore: true },
    _count: true
  });

  if (selectComparisonScope(cohortAgg._count) === 'COHORT') {
    return toComparison('COHORT', cohortAgg._count, cohortAgg._avg);
  }

  const nationalAgg = await prisma.nationalBenchmarkRecord.aggregate({
    where: { version: latest.version },
    _avg: { overallScore: true, controlScore: true, savingScore: true, debtScore: true, planningScore: true },
    _count: true
  });

  return toComparison('NATIONAL', nationalAgg._count, nationalAgg._avg);
}
