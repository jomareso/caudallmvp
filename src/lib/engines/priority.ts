import { prisma } from '@/lib/db/prisma';
import { getActiveSafetyFlags, SAFETY_FLAG_DIMENSION } from './safety';
import { computeRootCause } from './root-cause';

// spec-v2.md §26: "No congelar todavía coeficientes matemáticos
// definitivos" — el orden conceptual (Safety > Root Cause > Severity >
// Dependency > User Goal > Actionability) es una cascada de desempate, NO
// una fórmula ponderada. Este motor implementa las primeras tres capas con
// datos reales que ya existen (SafetyFlag, InferenceRule, DimensionScore).
//
// Dependency y User Goal quedan sin implementar a propósito: no hay
// todavía un grafo de dependencia entre dimensiones, ni ninguna pantalla
// que capture el objetivo real del empleado (FinancialState.userGoal
// sigue null). Añadir lógica ahí sin esos datos sería inventar, no inferir
// (regla CORE #9).
//
// Actionability sí se aplica, pero en next-best-action.ts, no aquí: este
// motor devuelve la causa raíz REAL sin importar si hoy existe contenido
// cargado para esa dimensión (eso sería mezclar "cuál es el problema" con
// "qué tenemos para ofrecer", justo lo que la spec separa). Es Next Best
// Action quien, al no encontrar ninguna intervención elegible para la
// dimensión que Priority señaló, cae a worstDimensionBySeverity — por eso
// se exporta.

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  UNMET: 1,
  PARTIAL: 2,
  MET: 3
};

export type PriorityResult = {
  dimensionCode: string | null;
  reason: 'SAFETY_OVERRIDE' | 'ROOT_CAUSE' | 'SEVERITY' | 'NONE';
  explanation: string;
};

export type SeverityCandidate = { state: string; score: number };

// Primero por severidad del estado (CRITICAL peor que UNMET peor que
// PARTIAL peor que MET); a igual estado, desempata por score más bajo
// dentro de esa misma banda.
export function pickMostSevere<T extends SeverityCandidate>(candidates: T[]): T {
  return [...candidates].sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.state] ?? 9) - (SEVERITY_ORDER[b.state] ?? 9);
    if (severityDiff !== 0) return severityDiff;
    return a.score - b.score;
  })[0];
}

export async function worstDimensionBySeverity(employeeId: string): Promise<PriorityResult> {
  const scores = await prisma.dimensionScore.findMany({ where: { employeeId, state: { not: 'NA' } } });

  if (scores.length === 0) {
    return { dimensionCode: null, reason: 'NONE', explanation: 'Sin dimensiones evaluables todavía.' };
  }

  const worst = pickMostSevere(scores);

  const dimension = await prisma.dimension.findUnique({ where: { id: worst.dimensionId } });

  return {
    dimensionCode: dimension?.code ?? null,
    reason: 'SEVERITY',
    explanation: `${dimension?.code ?? worst.dimensionId} tiene el estado más severo (${worst.state}, score ${Math.round(worst.score)}).`
  };
}

export async function computePriority(employeeId: string): Promise<PriorityResult> {
  // 1. Safety puede hacer override temporal sobre Priority (spec §19/§26),
  // sin importar el score ni la causa raíz.
  const activeFlags = await getActiveSafetyFlags(employeeId);
  if (activeFlags.length > 0) {
    const dimensionCode = SAFETY_FLAG_DIMENSION[activeFlags[0].flagCode] ?? null;
    return {
      dimensionCode,
      reason: 'SAFETY_OVERRIDE',
      explanation: `Alerta de seguridad activa (${activeFlags.map((f) => f.flagCode).join(', ')}) — prioridad forzada sobre ${dimensionCode}.`
    };
  }

  // 2. Root Cause ≠ Priority necesariamente, pero cuando hay una cadena
  // causal real evidenciada (no el fallback de score más bajo), es más
  // informativa que la severidad cruda — es la dimensión que explica el
  // problema, no solo la que se ve peor en el score.
  const rootCause = await computeRootCause(employeeId);
  if (rootCause.method === 'CAUSAL_CHAIN' && rootCause.dimensionCode) {
    return {
      dimensionCode: rootCause.dimensionCode,
      reason: 'ROOT_CAUSE',
      explanation: `Causa raíz evidenciada (${rootCause.ruleCode}): ${rootCause.explanation}`
    };
  }

  // 3. Sin safety activo ni causa raíz evidenciada, se prioriza por
  // severidad: la dimensión con el estado peor.
  return worstDimensionBySeverity(employeeId);
}
