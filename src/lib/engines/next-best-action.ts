import { prisma } from '@/lib/db/prisma';
import type { DimensionCode, DimensionScore, Intervention } from '@prisma/client';
import { buildFacts } from './diagnostic';
import { computePriority, pickMostSevere } from './priority';
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
// ninguna intervención elegible (sin contenido cargado, o todo lo que
// tenía ya fue descartado/completado), se prueba la siguiente dimensión
// con brecha real en orden de severidad, y así sucesivamente, en vez de
// rendirse en el primer intento — una dimensión agotada de contenido no
// significa que las demás también lo estén.
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

// Todas las dimensiones con brecha real (CRITICAL/UNMET/PARTIAL) del
// empleado, ordenadas de peor a mejor severidad — mismo criterio que usa
// Priority para elegir la peor (pickMostSevere), aplicado repetidamente
// para obtener el orden completo en vez de solo la primera.
async function gapDimensionsBySeverity(employeeId: string): Promise<string[]> {
  const scores = await prisma.dimensionScore.findMany({ where: { employeeId, state: { not: 'NA' } } });
  let remaining = scores.filter((s) => GAP_STATES.includes(s.state));
  const ordered: DimensionScore[] = [];
  while (remaining.length > 0) {
    const worst = pickMostSevere(remaining);
    ordered.push(worst);
    remaining = remaining.filter((s) => s.dimensionId !== worst.dimensionId);
  }

  if (ordered.length === 0) return [];
  const dimensions = await prisma.dimension.findMany({ where: { id: { in: ordered.map((s) => s.dimensionId) } } });
  const codeById = new Map(dimensions.map((d) => [d.id, d.code as string]));
  return ordered.map((s) => codeById.get(s.dimensionId)).filter((code): code is string => Boolean(code));
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

  const readinessEligible = courses.filter((c) => meetsReadinessGate(c, finRank, behRank));
  const eligible = await excludeAlreadyResolved(employeeId, readinessEligible);

  return eligible[0] ?? null;
}

// Una intervención que el empleado ya descartó o ya completó nunca vuelve a
// ofrecerse (ver nota en actions.ts) — pero eso no significa que ya no
// tenga ninguna brecha en esta dimensión, solo que ESA sugerencia puntual
// ya se resolvió. Antes esto se filtraba recién en actions.ts, después de
// que este motor ya había elegido su única candidata: si esa candidata
// resultaba ser justo la ya resuelta, el motor se rendía (NONE) aunque
// hubiera otra intervención elegible sin probar, y actions.ts terminaba
// mostrando "vas bien" con una dimensión todavía en UNMET/PARTIAL. Filtrar
// acá, antes de elegir, deja que cualquier otra candidata elegible se
// ofrezca en su lugar.
async function excludeAlreadyResolved(employeeId: string, candidates: Intervention[]): Promise<Intervention[]> {
  if (candidates.length === 0) return candidates;
  const resolved = await prisma.employeeIntervention.findMany({
    where: { employeeId, status: { in: ['DISMISSED', 'COMPLETED'] }, interventionId: { in: candidates.map((c) => c.id) } },
    select: { interventionId: true }
  });
  const resolvedIds = new Set(resolved.map((r) => r.interventionId));
  return candidates.filter((c) => !resolvedIds.has(c.id));
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

  const eligible = candidates.filter((c) => meetsReadinessGate(c, finRank, behRank));
  return excludeAlreadyResolved(employeeId, eligible);
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
    const orderedGapDimensions = await gapDimensionsBySeverity(employeeId);
    for (const candidateDimension of orderedGapDimensions) {
      if (candidateDimension === priority.dimensionCode) continue;
      const fallbackCandidates = await eligibleCandidatesForDimension(employeeId, candidateDimension, eligibility);
      if (fallbackCandidates.length > 0) {
        dimensionCode = candidateDimension;
        eligibleCandidates = fallbackCandidates;
        usedActionabilityFallback = true;
        break;
      }
    }
  }

  if (eligibleCandidates.length === 0) {
    return {
      intervention: null,
      method: 'NONE',
      explanation: `Sin intervención elegible en ${priority.dimensionCode} ni en ninguna otra dimensión con brecha real, con la disposición financiera/conductual actual del empleado.`
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
