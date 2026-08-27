import { prisma } from '@/lib/db/prisma';
import type { DimensionCode, Intervention } from '@prisma/client';
import { buildFacts } from './diagnostic';
import { computePriority, worstDimensionBySeverity } from './priority';
import { computeEligibility, type EligibilityResult } from './eligibility';

// spec-v2.md §28: FRICTION → TECHNIQUE, nunca al revés (regla CORE #19).
// Este motor elige QUÉ intervención mostrarle al empleado: primero limita
// el catálogo a la dimensión prioritaria (Priority engine) y al estado
// actual de esa dimensión, luego descarta lo que su Readiness todavía no
// le permite, y solo entre lo que queda intenta emparejar por la fricción
// conductual real que respondió (BEH_FRICTION) — nunca elige una técnica
// primero y le busca una fricción después.
//
// Actionability (spec §26, paso 6): la dimensión de Root Cause es la causa
// REAL del problema, pero puede estar en estado MET hoy (ej. "Control"
// explica por qué falla Ahorro, aunque Control mismo ya esté saludable) —
// y el catálogo de intervenciones solo tiene contenido para dimensiones
// que necesitan mejorar. Si la dimensión que Priority señaló no tiene
// ninguna intervención elegible, se cae a la dimensión con peor severidad
// (la que sí tiene algo accionable) en vez de no mostrar nada.
//
// Mantenimiento: si NINGUNA dimensión evaluable tiene una brecha real
// (todas MET o NA), no hay ninguna causa raíz que atender — mostrar "sin
// recomendación" ahí se siente como una limitación del producto en vez de
// reconocer que a la persona le está yendo bien. En ese caso (y solo en
// ese caso; si sí hay una brecha real pero falta contenido cargado para
// ella, se sigue devolviendo NONE en vez de tapar el hueco) se ofrece
// contenido de tipo COURSE sin importar a qué dimensión esté asociado en
// el catálogo — es refuerzo general, no responde a una fricción concreta.
//
// Todas las consultas de Intervention exigen catalog.status = 'ACTIVE':
// el contenido nace en DRAFT (seed.ts) hasta que Reynoso revisa el copy
// real que verá el empleado; sin este filtro cualquier borrador cargado
// ya sería elegible en producción.

const FIN_READINESS_ORDER: Record<string, number> = { NOT_ELIGIBLE: 0, CONSTRAINED: 1, ELIGIBLE: 2, STRONG: 3 };
const BEH_READINESS_ORDER: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

export type NextBestActionResult = {
  intervention: Intervention | null;
  method: 'FRICTION_MATCH' | 'FALLBACK' | 'MAINTENANCE' | 'NONE';
  explanation: string;
};

const GAP_STATES = ['CRITICAL', 'UNMET', 'PARTIAL'];

// Compartida entre la ruta de mantenimiento (sin brecha real) y la ruta
// normal por dimensión: una intervención nunca se ofrece si exige más
// disposición financiera o conductual de la que el empleado tiene hoy.
// finRank/behRank en -1 (readiness todavía desconocida) bloquea cualquier
// intervención que declare un requisito — regla CORE #13: no exigir más
// certeza de la que hay.
export function meetsReadinessGate(
  intervention: Pick<Intervention, 'financialReadinessRequired' | 'behavioralReadinessRequired'>,
  finRank: number,
  behRank: number
): boolean {
  if (
    intervention.financialReadinessRequired &&
    finRank < (FIN_READINESS_ORDER[intervention.financialReadinessRequired] ?? 0)
  ) {
    return false;
  }
  if (
    intervention.behavioralReadinessRequired &&
    behRank < (BEH_READINESS_ORDER[intervention.behavioralReadinessRequired] ?? 0)
  ) {
    return false;
  }
  return true;
}

export async function hasNoRealGap(employeeId: string): Promise<boolean> {
  const scores = await prisma.dimensionScore.findMany({ where: { employeeId, state: { not: 'NA' } } });
  return scores.length > 0 && scores.every((s) => !GAP_STATES.includes(s.state));
}

async function eligibleMaintenanceCourse(
  employeeId: string,
  eligibility: EligibilityResult
): Promise<Intervention | null> {
  const courses = await prisma.intervention.findMany({
    where: { type: 'COURSE', catalog: { status: 'ACTIVE' } }
  });

  const finRank = eligibility.financialReadiness.state ? FIN_READINESS_ORDER[eligibility.financialReadiness.state] : -1;
  const behRank = eligibility.behavioralReadiness.state ? BEH_READINESS_ORDER[eligibility.behavioralReadiness.state] : -1;

  const alreadyShown = await prisma.employeeIntervention.findMany({
    where: { employeeId, status: { in: ['DISMISSED', 'COMPLETED'] } },
    select: { interventionId: true }
  });
  const shownIds = new Set(alreadyShown.map((e) => e.interventionId));

  const eligible = courses.filter((c) => !shownIds.has(c.id) && meetsReadinessGate(c, finRank, behRank));

  return eligible[0] ?? null;
}

async function eligibleCandidatesForDimension(
  employeeId: string,
  dimensionCode: string,
  eligibility: EligibilityResult
): Promise<Intervention[]> {
  const dimension = await prisma.dimension.findFirst({ where: { code: dimensionCode as DimensionCode } });
  const dimensionScore = dimension
    ? await prisma.dimensionScore.findUnique({
        where: { employeeId_dimensionId: { employeeId, dimensionId: dimension.id } }
      })
    : null;

  if (!dimension || !dimensionScore) return [];

  const candidates = await prisma.intervention.findMany({
    where: {
      dimensionId: dimension.id,
      appliesToStates: { has: dimensionScore.state },
      catalog: { status: 'ACTIVE' }
    }
  });

  const finRank = eligibility.financialReadiness.state ? FIN_READINESS_ORDER[eligibility.financialReadiness.state] : -1;
  const behRank = eligibility.behavioralReadiness.state ? BEH_READINESS_ORDER[eligibility.behavioralReadiness.state] : -1;

  return candidates.filter((c) => meetsReadinessGate(c, finRank, behRank));
}

export async function computeNextBestAction(employeeId: string): Promise<NextBestActionResult> {
  const [priority, eligibility, facts] = await Promise.all([
    computePriority(employeeId),
    computeEligibility(employeeId),
    buildFacts(employeeId)
  ]);

  if (!priority.dimensionCode) {
    return { intervention: null, method: 'NONE', explanation: 'Sin dimensión prioritaria todavía.' };
  }

  if (await hasNoRealGap(employeeId)) {
    const course = await eligibleMaintenanceCourse(employeeId, eligibility);
    if (course) {
      return {
        intervention: course,
        method: 'MAINTENANCE',
        explanation: 'Ninguna dimensión tiene una brecha real (todas MET o N/A) — se ofrece contenido de mantenimiento en vez de una acción correctiva.'
      };
    }
  }

  let dimensionCode = priority.dimensionCode;
  let eligibleCandidates = await eligibleCandidatesForDimension(employeeId, dimensionCode, eligibility);
  let usedActionabilityFallback = false;

  if (eligibleCandidates.length === 0) {
    const severityFallback = await worstDimensionBySeverity(employeeId);
    if (severityFallback.dimensionCode && severityFallback.dimensionCode !== dimensionCode) {
      const fallbackCandidates = await eligibleCandidatesForDimension(employeeId, severityFallback.dimensionCode, eligibility);
      if (fallbackCandidates.length > 0) {
        dimensionCode = severityFallback.dimensionCode;
        eligibleCandidates = fallbackCandidates;
        usedActionabilityFallback = true;
      }
    }
  }

  if (eligibleCandidates.length === 0) {
    return {
      intervention: null,
      method: 'NONE',
      explanation: `Sin intervención elegible en ${priority.dimensionCode} (ni en su alternativa por severidad) con la disposición financiera/conductual actual del empleado.`
    };
  }

  const actionabilityNote = usedActionabilityFallback
    ? ` (${priority.dimensionCode} no tenía nada accionable hoy; se usó ${dimensionCode} por severidad)`
    : '';

  const friction = facts.get('BEH_FRICTION')?.state;
  if (friction) {
    const match = eligibleCandidates.find((c) => c.behavioralTechniqueCode === friction);
    if (match) {
      return {
        intervention: match,
        method: 'FRICTION_MATCH',
        explanation: `BEH_FRICTION=${friction} coincide con la técnica de la intervención ${match.behavioralTechniqueCode}.${actionabilityNote}`
      };
    }
  }

  const fallback = eligibleCandidates[0];
  return {
    intervention: fallback,
    method: 'FALLBACK',
    explanation: (friction
      ? `BEH_FRICTION=${friction} no tiene intervención cargada todavía en ${dimensionCode}; se usó la primera elegible.`
      : `Fricción conductual todavía desconocida; se usó la primera intervención elegible en ${dimensionCode}.`) + actionabilityNote
  };
}
