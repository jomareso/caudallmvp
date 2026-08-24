import { prisma } from '@/lib/db/prisma';
import { evaluateRule, type Facts } from './rules';
import { buildFacts } from './diagnostic';

// spec-v2.md §25: Root Cause NO es "la dimensión con el score más bajo".
// Ejemplo del spec: Income gap → Cashflow deficit → No saving → Low reserve
// — aunque Ahorro tenga el score menor, la causa raíz real está en Control.
//
// Las 15 reglas del Banco Maestro (InferenceRule) ya expresan exactamente
// esa forma causal: SOURCE_CONDITION → TARGET_VARIABLE=TARGET_VALUE, con
// STRENGTH (STRONG/WEAK) y CONFIDENCE (spec: "Formalizar SOURCE_VARIABLE /
// TARGET_VARIABLE / RELATION / STRENGTH / CONDITIONS / CONFIDENCE"). Este
// motor arma con ellas un grafo dirigido usando la evidencia real del
// empleado, y busca el nodo más "arriba" (fuente que no es, a su vez,
// consecuencia de otra regla activa) — regla CORE #9: no tratar un síntoma
// downstream como causa raíz automáticamente.
//
// Nota de datos: el banco define variables dedicadas de causa raíz por
// dimensión (CTRL_DRIVER, RES_DRIVER, DEBT_DRIVER — rawType "ROOT_CAUSE"),
// pero ninguna de las 94 preguntas cargadas hoy las responde directamente
// (ver prisma/seed-data/README.md sobre las 220 preguntas pendientes). Sin
// esas respuestas, la cadena causal solo puede construirse con las demás
// reglas activas; si ninguna aplica, se usa un fallback explícito de baja
// confianza (la dimensión con score más bajo) en vez de fallar o inventar.

export type RootCauseResult = {
  method: 'CAUSAL_CHAIN' | 'LOWEST_SCORE_FALLBACK' | 'NONE';
  driverVariableCode: string | null;
  driverValue: string | null;
  dimensionCode: string | null;
  confidence: number;
  ruleCode: string | null;
  explanation: string;
};

export type ActiveEdge = {
  ruleCode: string;
  sourceVariables: string[];
  targetVariableCode: string;
  targetValue: string;
  confidence: number;
  type: 'STRONG' | 'WEAK';
};

export function extractSourceVariables(conditionRaw: string): string[] {
  const matches = conditionRaw.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|!=|\bIN\b)/g);
  const codes = [...matches].map((m) => m[1]).filter((code) => code.toUpperCase() !== 'CONFIDENCE');
  return [...new Set(codes)];
}

async function buildActiveEdges(facts: Facts): Promise<ActiveEdge[]> {
  const rules = await prisma.inferenceRule.findMany();

  return rules
    .filter((rule) => evaluateRule(rule.sourceConditionRaw, facts))
    .map((rule) => ({
      ruleCode: rule.code,
      sourceVariables: extractSourceVariables(rule.sourceConditionRaw),
      targetVariableCode: rule.targetVariableCode,
      targetValue: rule.targetValue,
      confidence: rule.confidence,
      type: rule.type
    }));
}

async function dimensionCodeForVariable(variableCode: string): Promise<string | null> {
  const variable = await prisma.variable.findUnique({ where: { code: variableCode }, include: { dimension: true } });
  return variable?.dimension?.code ?? null;
}

async function lowestScoreFallback(employeeId: string): Promise<RootCauseResult> {
  const scores = await prisma.dimensionScore.findMany({ where: { employeeId, state: { not: 'NA' } } });
  if (scores.length === 0) {
    return {
      method: 'NONE',
      driverVariableCode: null,
      driverValue: null,
      dimensionCode: null,
      confidence: 0,
      ruleCode: null,
      explanation: 'Sin dimensiones evaluables todavía.'
    };
  }

  const worst = [...scores].sort((a, b) => a.score - b.score)[0];
  const dimension = await prisma.dimension.findUnique({ where: { id: worst.dimensionId } });

  return {
    method: 'LOWEST_SCORE_FALLBACK',
    driverVariableCode: null,
    driverValue: null,
    dimensionCode: dimension?.code ?? null,
    // Confianza baja a propósito: esto NO es una cadena causal evidenciada,
    // es la mejor aproximación disponible mientras el banco no tenga las
    // preguntas de causa raíz por dimensión (regla CORE #9).
    confidence: 0.3,
    ruleCode: null,
    explanation: 'Sin cadena causal activa en la evidencia del empleado; se usó la dimensión con score más bajo como aproximación provisional.'
  };
}

export function pickBest(edges: ActiveEdge[]): ActiveEdge {
  return [...edges].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'STRONG' ? -1 : 1;
    return b.confidence - a.confidence;
  })[0];
}

export async function computeRootCause(employeeId: string): Promise<RootCauseResult> {
  const facts = await buildFacts(employeeId);
  const activeEdges = await buildActiveEdges(facts);

  if (activeEdges.length === 0) {
    return lowestScoreFallback(employeeId);
  }

  // INF-013 y similares apuntan directo a ROOT_CAUSE_CANDIDATE: es la propia
  // metodología declarando la causa raíz explícitamente, no una inferencia
  // genérica que este motor tenga que reconstruir — tiene prioridad absoluta.
  const explicitRootCauseEdges = activeEdges.filter((e) => e.targetVariableCode === 'ROOT_CAUSE_CANDIDATE');
  if (explicitRootCauseEdges.length > 0) {
    const best = pickBest(explicitRootCauseEdges);
    const driverVariableCode = best.sourceVariables[0] ?? null;
    return {
      method: 'CAUSAL_CHAIN',
      driverVariableCode,
      driverValue: driverVariableCode ? (facts.get(driverVariableCode)?.state ?? null) : null,
      dimensionCode: best.targetValue,
      confidence: best.confidence,
      ruleCode: best.ruleCode,
      explanation: `${best.ruleCode}: ${best.sourceVariables.join(' Y ')} → ROOT_CAUSE_CANDIDATE=${best.targetValue}`
    };
  }

  // Variables *_STATE / *_CONFIDENCE son bookkeeping derivado (ej.
  // DEBT_STATE=N/A cuando DEBT_APPLICABILITY=NONE) — describen que una
  // dimensión quedó excluida, no la causa de ningún problema. Sin
  // filtrarlas, "no tener deuda" ganaría como "causa raíz" solo por tener
  // confidence=1.0, violando la regla CORE #9.
  const meaningfulEdges = activeEdges.filter((e) => !/_STATE$|_CONFIDENCE$/.test(e.targetVariableCode));
  if (meaningfulEdges.length === 0) {
    return lowestScoreFallback(employeeId);
  }

  const targetedCodes = new Set(meaningfulEdges.map((e) => e.targetVariableCode));

  // Candidato a causa raíz = variable fuente de un edge activo que nadie más
  // "explica" en el grafo actual (no es target de ninguna otra regla activa).
  const rootCandidates = meaningfulEdges.filter((e) => e.sourceVariables.some((sv) => !targetedCodes.has(sv)));
  const pool = rootCandidates.length > 0 ? rootCandidates : meaningfulEdges;

  const best = pickBest(pool);
  const driverVariableCode = best.sourceVariables.find((sv) => !targetedCodes.has(sv)) ?? best.sourceVariables[0] ?? null;
  const driverValue = driverVariableCode ? (facts.get(driverVariableCode)?.state ?? null) : null;
  const dimensionCode = driverVariableCode ? await dimensionCodeForVariable(driverVariableCode) : null;

  return {
    method: 'CAUSAL_CHAIN',
    driverVariableCode,
    driverValue,
    dimensionCode,
    confidence: best.confidence,
    ruleCode: best.ruleCode,
    explanation: `${best.ruleCode}: ${best.sourceVariables.join(' Y ')} → ${best.targetVariableCode}=${best.targetValue}`
  };
}
