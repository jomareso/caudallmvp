import { prisma } from '@/lib/db/prisma';
import { evaluateRule, type Facts } from './rules';
import { extractSourceVariables } from './root-cause';
import { recomputeConstructScore, recomputeDimensionScore, type EvidencePayload } from './cfhi';
import type { InferenceRule } from '@prisma/client';

// Regla CORE #15: "Una inferencia fuerte puede sustituir una pregunta; una
// débil solo orienta routing." El banco maestro y el schema ya tenían todo
// lo necesario para esto (InferenceRule.canSubstituteQuestion,
// Question.skipIfRule = "<var> confidence >= 0.80",
// EvidenceSource.INFERENCE, Reliability.STRONG_INFERENCE/WEAK_INFERENCE) —
// nada lo materializaba en runtime: computeRootCause() evalúa las mismas 15
// reglas pero solo en memoria, para explicar causa raíz, y nunca escribe de
// vuelta un VariableState. Este motor sí lo hace, y solo para las reglas
// marcadas canSubstituteQuestion=true (las WEAK del banco real declaran
// explícitamente false — "usar para routing, no para saltar pregunta").
//
// Nunca pisa una variable que ya tiene CUALQUIER hecho conocido (respuesta
// directa o inferencia previa) — inferir es válido para llenar un vacío,
// nunca para corregir o reforzar algo que el empleado ya contestó.
export async function materializeInferences(employeeId: string, facts: Facts): Promise<void> {
  const rules = await prisma.inferenceRule.findMany({ where: { canSubstituteQuestion: true } });
  if (rules.length === 0) return;

  const [employee, activeMethodology] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    prisma.methodology.findFirst({ where: { status: 'ACTIVE' } })
  ]);
  if (!activeMethodology) return;

  // Hasta 5 vueltas: cubre el caso (hoy raro, con solo 15 reglas activas)
  // de que el TARGET de una regla sea el SOURCE de otra — sin esto, esa
  // segunda regla solo se materializaría al responder la próxima pregunta,
  // no en esta misma vuelta.
  for (let pass = 0; pass < 5; pass++) {
    const pending = rules.filter((r) => !facts.has(r.targetVariableCode) && evaluateRule(r.sourceConditionRaw, facts));
    if (pending.length === 0) return;

    for (const rule of pending) {
      // Pudo haberse materializado en esta misma vuelta por otra regla
      // (dos reglas distintas con el mismo target, ej. INF-001/INF-003 →
      // SAV_CAPACITY) — la primera que corre gana, no se pisan entre sí.
      if (facts.has(rule.targetVariableCode)) continue;
      await materializeOne(employeeId, employee.tenantId, activeMethodology.version, rule, facts);
    }
  }
}

async function materializeOne(
  employeeId: string,
  tenantId: string,
  methodologyVersionId: string,
  rule: InferenceRule,
  facts: Facts
): Promise<void> {
  const variable = await prisma.variable.findUnique({ where: { code: rule.targetVariableCode } });
  // canSubstituteQuestion=true siempre apunta a una variable real de banco
  // (es el variableTarget de la pregunta que reemplaza) — si no existe, es
  // un dato de banco inconsistente; no se inventa nada, se omite.
  if (!variable) return;

  const sourceVariableCodes = extractSourceVariables(rule.sourceConditionRaw);
  const sourceVariables = sourceVariableCodes.length
    ? await prisma.variable.findMany({ where: { code: { in: sourceVariableCodes } } })
    : [];
  const sourceEvidence = sourceVariables.length
    ? await prisma.evidence.findMany({
        where: { employeeId, variableId: { in: sourceVariables.map((v) => v.id) } },
        orderBy: { timestamp: 'desc' }
      })
    : [];
  const latestEvidenceIdByVariable = new Map<string, string>();
  for (const e of sourceEvidence) {
    if (!latestEvidenceIdByVariable.has(e.variableId)) latestEvidenceIdByVariable.set(e.variableId, e.id);
  }

  // Si alguna pregunta del banco ya produce este mismo (variable, estado)
  // con un score real, se reusa — mismo estado, misma señal de salud, sin
  // importar si se conoció por respuesta directa o por inferencia. Las
  // variables de gating/derivadas (ej. SAV_CAPACITY, DEBT_STATE) no tienen
  // score en ningún lado del banco — quedan sin score acá también, igual
  // que cuando se responden directamente (ver EvidencePayload.score).
  const candidateOptions = await prisma.answerOption.findMany({
    where: { question: { variableTargetId: variable.id } }
  });
  const scoreDonor = candidateOptions.find((o) => {
    const payload = o.evidenceProduced as EvidencePayload;
    return payload.state === rule.targetValue && typeof payload.score === 'number';
  });
  const score = scoreDonor ? (scoreDonor.evidenceProduced as EvidencePayload).score : undefined;

  const confidence = Math.round(rule.confidence * 100);
  const value: EvidencePayload = {
    variableCode: rule.targetVariableCode,
    state: rule.targetValue,
    ...(score !== undefined ? { score } : {})
  };

  const evidence = await prisma.evidence.create({
    data: {
      tenantId,
      employeeId,
      source: 'INFERENCE',
      variableId: variable.id,
      value,
      reliability: rule.type === 'STRONG' ? 'STRONG_INFERENCE' : 'WEAK_INFERENCE',
      confidence,
      primaryOwnerConstructId: variable.primaryOwnerConstructId,
      methodologyVersionId
    }
  });

  const derivedFromEvidenceIds = [...latestEvidenceIdByVariable.values(), evidence.id];

  await prisma.variableState.upsert({
    where: { employeeId_variableId: { employeeId, variableId: variable.id } },
    update: { value, confidence, state: rule.targetValue, derivedFromEvidenceIds },
    create: { employeeId, variableId: variable.id, value, confidence, state: rule.targetValue, derivedFromEvidenceIds }
  });

  facts.set(rule.targetVariableCode, { state: rule.targetValue, confidenceRatio: rule.confidence });

  if (variable.primaryOwnerConstructId) {
    const construct = await prisma.construct.findUnique({ where: { id: variable.primaryOwnerConstructId } });
    await recomputeConstructScore(employeeId, variable.primaryOwnerConstructId);
    if (construct?.dimensionId) await recomputeDimensionScore(employeeId, construct.dimensionId);
  } else if (variable.dimensionId) {
    await recomputeDimensionScore(employeeId, variable.dimensionId);
  }
}
