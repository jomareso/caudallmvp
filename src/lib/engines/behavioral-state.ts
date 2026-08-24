import { prisma } from '@/lib/db/prisma';

// Los 55 sesgos conductuales del Banco Maestro (11 sesgos × 5 dimensiones)
// declaran una variable {PREFIJO}_STATE (LOW/MODERATE/HIGH/VERY_HIGH) que
// nadie calculaba — la spec solo dice qué es cada estado, no cómo llegar a
// él desde las respuestas. Fórmula confirmada por Reynoso (24 ago 2026):
// - cada item de un sesgo se responde en una escala ordinal (4 o 5
//   niveles según la pregunta); el nivel se mapea proporcionalmente a uno
//   de los 4 baldes (mapeo directo, sin promediar entre niveles).
// - con 1 item respondido: ese balde, confianza 60%.
// - con 2 items (primario + confirmatorio) que caen en el mismo balde:
//   confianza 100%. Si no coinciden, se usa el balde del más reciente y la
//   confianza se queda en 60% — eso es lo que permite que un ítem de
//   reserva se dispare (ASK_IF de esas preguntas mira "confidence < 0.80").
const BUCKETS = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const;
type Bucket = (typeof BUCKETS)[number];

export function bucketForOrder(order: number, totalOptions: number): Bucket {
  if (totalOptions <= 1) return 'LOW';
  const normalized = (order - 1) / (totalOptions - 1);
  const index = Math.min(3, Math.max(0, Math.round(normalized * 3)));
  return BUCKETS[index];
}

// Todas las variables *_RESPONSE de sesgo comparten su *_STATE derivado
// con el mismo prefijo (ver prisma/seed-data/README.md) — confirmado
// contra las 55 variables reales del banco, no una suposición.
function stateCodeFor(responseVariableCode: string): string | null {
  if (!responseVariableCode.endsWith('_RESPONSE')) return null;
  return responseVariableCode.replace(/_RESPONSE$/, '_STATE');
}

export async function recomputeBehavioralBiasState(
  employeeId: string,
  responseVariableCode: string
): Promise<void> {
  const stateCode = stateCodeFor(responseVariableCode);
  if (!stateCode) return;

  const [responseVariable, stateVariable] = await Promise.all([
    prisma.variable.findUnique({ where: { code: responseVariableCode } }),
    prisma.variable.findUnique({ where: { code: stateCode } })
  ]);
  if (!responseVariable || !stateVariable) return;

  const evidenceRows = await prisma.evidence.findMany({
    where: { employeeId, variableId: responseVariable.id },
    include: { answerOption: { include: { question: { include: { answerOptions: true } } } } },
    orderBy: { timestamp: 'desc' }
  });

  // Primario y confirmatorio son preguntas distintas aunque compartan
  // variable; si una se respondió más de una vez (corrección), solo la
  // evidencia más reciente de esa pregunta cuenta.
  const latestByQuestion = new Map<string, (typeof evidenceRows)[number]>();
  for (const e of evidenceRows) {
    if (e.questionId && !latestByQuestion.has(e.questionId)) latestByQuestion.set(e.questionId, e);
  }
  const items = [...latestByQuestion.values()]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 2);

  if (items.length === 0) return;

  const buckets = items
    .map((e) => e.answerOption)
    .filter((opt): opt is NonNullable<typeof opt> => opt !== null)
    .map((opt) => bucketForOrder(opt.order ?? 1, opt.question.answerOptions.length));

  if (buckets.length === 0) return;

  const state = buckets[0];
  const confidence = buckets.length >= 2 && buckets[1] === buckets[0] ? 100 : 60;

  await prisma.variableState.upsert({
    where: { employeeId_variableId: { employeeId, variableId: stateVariable.id } },
    update: {
      value: { variableCode: stateCode, state },
      confidence,
      state,
      derivedFromEvidenceIds: items.map((e) => e.id)
    },
    create: {
      employeeId,
      variableId: stateVariable.id,
      value: { variableCode: stateCode, state },
      confidence,
      state,
      derivedFromEvidenceIds: items.map((e) => e.id)
    }
  });
}
