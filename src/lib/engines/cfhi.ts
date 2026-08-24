import { prisma } from '@/lib/db/prisma';
import { scoreToDimensionState, weightedAverageExcludingNA, type WeightedScore } from './scoring';

// Forma que guardamos en AnswerOption.evidenceProduced / Evidence.value /
// VariableState.value. El score vive en la respuesta (no en una tabla aparte
// de "estado → score"): cada opción declara qué tan sano es elegirla.
export type EvidencePayload = {
  variableCode: string;
  state: string;
  /** Ausente para variables de contexto/gating (ej. DEBT_APPLICABILITY). */
  score?: number;
};

// El código de Dimension (CONTROL/RESILIENCE/DEBT/SAVING/PLANNING) no es el
// mismo prefijo que usan sus variables en el Banco Maestro (CTRL/RES/DEBT/
// SAV/PLAN) — confirmado contra las 174 variables reales.
export const DIMENSION_VARIABLE_PREFIX: Record<string, string> = {
  CONTROL: 'CTRL',
  RESILIENCE: 'RES',
  DEBT: 'DEBT',
  SAVING: 'SAV',
  PLANNING: 'PLAN'
};

// Publica el estado/confianza ya calculados de una dimensión como hechos
// consultables por el motor de reglas (src/lib/engines/rules.ts) bajo las
// variables {DIM}_STATE y {DIM}_CONFIDENCE del Banco Maestro — spec §10-14
// las declara, pero no define su fórmula; la fórmula real es este mismo
// weightedAverageExcludingNA que ya usa el resto del CFHI. {DIM}_STATE es
// categórico (MET/PARTIAL/UNMET/CRITICAL/NA); {DIM}_CONFIDENCE es la misma
// confianza pero expresada como el valor numérico "0..1" que esa variable
// declara en el banco, para que "SAV_CONFIDENCE >= 0.80" se pueda evaluar.
async function syncDimensionStateFacts(
  employeeId: string,
  dimensionCode: string,
  state: string,
  confidence: number
): Promise<void> {
  const prefix = DIMENSION_VARIABLE_PREFIX[dimensionCode];
  if (!prefix) return;

  const [stateVariable, confidenceVariable] = await Promise.all([
    prisma.variable.findUnique({ where: { code: `${prefix}_STATE` } }),
    prisma.variable.findUnique({ where: { code: `${prefix}_CONFIDENCE` } })
  ]);

  if (stateVariable) {
    await prisma.variableState.upsert({
      where: { employeeId_variableId: { employeeId, variableId: stateVariable.id } },
      update: { value: { variableCode: stateVariable.code, state }, confidence, state, derivedFromEvidenceIds: [] },
      create: {
        employeeId,
        variableId: stateVariable.id,
        value: { variableCode: stateVariable.code, state },
        confidence,
        state,
        derivedFromEvidenceIds: []
      }
    });
  }

  if (confidenceVariable) {
    const confidenceState = (confidence / 100).toFixed(2);
    await prisma.variableState.upsert({
      where: { employeeId_variableId: { employeeId, variableId: confidenceVariable.id } },
      update: {
        value: { variableCode: confidenceVariable.code, state: confidenceState },
        confidence: 100,
        state: confidenceState,
        derivedFromEvidenceIds: []
      },
      create: {
        employeeId,
        variableId: confidenceVariable.id,
        value: { variableCode: confidenceVariable.code, state: confidenceState },
        confidence: 100,
        state: confidenceState,
        derivedFromEvidenceIds: []
      }
    });
  }
}

async function isDebtNotApplicable(employeeId: string): Promise<boolean> {
  const variable = await prisma.variable.findUnique({ where: { code: 'DEBT_APPLICABILITY' } });
  if (!variable) return false;

  const state = await prisma.variableState.findUnique({
    where: { employeeId_variableId: { employeeId, variableId: variable.id } }
  });
  if (!state) return false;

  const value = state.value as EvidencePayload;
  return value.state === 'NONE';
}

export async function recomputeConstructScore(
  employeeId: string,
  constructId: string
): Promise<number | null> {
  const construct = await prisma.construct.findUniqueOrThrow({
    where: { id: constructId },
    include: { variablesOwned: true }
  });

  const variableStates = await prisma.variableState.findMany({
    where: { employeeId, variableId: { in: construct.variablesOwned.map((v) => v.id) } }
  });

  if (variableStates.length === 0) return null;

  const items: WeightedScore[] = variableStates.map((vs) => {
    const value = vs.value as EvidencePayload;
    return { key: vs.variableId, score: typeof value.score === 'number' ? value.score : null, weight: 1 };
  });

  const result = weightedAverageExcludingNA(items);
  if (result.score === null) return null;

  const confidence = Math.round(
    variableStates.reduce((sum, vs) => sum + vs.confidence, 0) / variableStates.length
  );

  await prisma.constructScore.upsert({
    where: { employeeId_constructId: { employeeId, constructId } },
    update: { score: result.score, confidence },
    create: { employeeId, constructId, score: result.score, confidence }
  });

  return result.score;
}

export async function recomputeDimensionScore(
  employeeId: string,
  dimensionId: string
): Promise<{ score: number | null; state: 'NA' | ReturnType<typeof scoreToDimensionState> | null }> {
  const dimension = await prisma.dimension.findUniqueOrThrow({
    where: { id: dimensionId },
    include: { constructs: true }
  });

  // Regla CORE #7 / #21: si el empleado no tiene deudas, Deuda queda N/A —
  // nunca en 100 — y se excluye del CFHI (ver recomputeCfhi).
  if (dimension.code === 'DEBT' && (await isDebtNotApplicable(employeeId))) {
    await prisma.dimensionScore.upsert({
      where: { employeeId_dimensionId: { employeeId, dimensionId } },
      update: { score: 0, state: 'NA', confidence: 100, driverVariableId: null },
      create: { employeeId, dimensionId, score: 0, state: 'NA', confidence: 100 }
    });
    await syncDimensionStateFacts(employeeId, dimension.code, 'NA', 100);
    return { score: null, state: 'NA' };
  }

  const constructScores = await prisma.constructScore.findMany({
    where: { employeeId, constructId: { in: dimension.constructs.map((c) => c.id) } }
  });

  if (constructScores.length === 0) return { score: null, state: null };

  const scoreByConstructId = new Map(constructScores.map((cs) => [cs.constructId, cs]));

  const items: WeightedScore[] = dimension.constructs.map((c) => {
    const cs = scoreByConstructId.get(c.id);
    return { key: c.id, score: cs ? cs.score : null, weight: c.weightWithinDimension };
  });

  const result = weightedAverageExcludingNA(items);
  if (result.score === null) return { score: null, state: null };

  const state = scoreToDimensionState(result.score);
  const confidence = Math.round(
    constructScores.reduce((sum, cs) => sum + cs.confidence, 0) / constructScores.length
  );

  await prisma.dimensionScore.upsert({
    where: { employeeId_dimensionId: { employeeId, dimensionId } },
    update: { score: result.score, state, confidence },
    create: { employeeId, dimensionId, score: result.score, state, confidence }
  });
  await syncDimensionStateFacts(employeeId, dimension.code, state, confidence);

  return { score: result.score, state };
}

export async function recomputeCfhi(employeeId: string): Promise<number | null> {
  const methodology = await prisma.methodology.findFirst({
    where: { status: 'ACTIVE' },
    include: { dimensions: true }
  });
  if (!methodology) return null;

  const dimensionScores = await prisma.dimensionScore.findMany({
    where: { employeeId, dimensionId: { in: methodology.dimensions.map((d) => d.id) } }
  });
  const scoreByDimensionId = new Map(dimensionScores.map((ds) => [ds.dimensionId, ds]));

  const items: WeightedScore[] = methodology.dimensions.map((d) => {
    const ds = scoreByDimensionId.get(d.id);
    if (!ds || ds.state === 'NA') return { key: d.code, score: null, weight: d.weight };
    return { key: d.code, score: ds.score, weight: d.weight };
  });

  const result = weightedAverageExcludingNA(items);
  if (result.score === null) return null;

  await prisma.financialState.upsert({
    where: { employeeId },
    // Confidence real (motor de confianza completo) queda para una fase
    // posterior; por ahora es un valor fijo mientras el diagnóstico es corto.
    update: { cfhiScore: result.score, cfhiConfidence: 80 },
    create: { employeeId, cfhiScore: result.score, cfhiConfidence: 80 }
  });

  return result.score;
}
