import { prisma } from '@/lib/db/prisma';
import type { Question, AnswerOption } from '@prisma/client';
import { evaluateRule, type Facts } from './rules';

// NOTA: la spec (docs/spec-v2.md §22) dice que el banco adaptativo "ya
// existe y ya fue auditado" y que no debe rehacerse desde cero — y ahora sí
// lo tenemos (prisma/seed-data/banco-maestro-v3.json, 94 de 314 preguntas
// cargadas). Lo que hay aquí es un selector por basePriority + el
// intérprete real de ASK_IF/SKIP_IF (src/lib/engines/rules.ts), NO el
// algoritmo NBQ completo (Information Value + Decision Impact +
// Uncertainty Reduction − Redundancy − Burden) de la spec. Portar ese
// scoring de selección queda para una sesión aparte.

export type QuestionWithOptions = Question & { answerOptions: AnswerOption[] };

export async function buildFacts(employeeId: string): Promise<Facts> {
  const states = await prisma.variableState.findMany({
    where: { employeeId },
    include: { variable: true }
  });

  const facts: Facts = new Map();
  for (const s of states) {
    const value = s.value as { state?: string } | null;
    if (value?.state) {
      facts.set(s.variable.code, { state: value.state, confidenceRatio: s.confidence / 100 });
    }
  }
  return facts;
}

function isApplicable(question: Question, facts: Facts, debtDimensionId: string | null): boolean {
  // Regla CORE #21: si ya sabemos que no tiene deudas, ninguna pregunta de
  // la dimensión Deuda se vuelve a hacer, sin importar lo que diga su propio
  // ASK_IF — algunas preguntas del banco solo miran "confidence < umbral" en
  // una variable de deuda, y esa confianza es 0 (desconocida) tanto si
  // nunca se preguntó por N/A como si simplemente no se ha llegado ahí
  // todavía. Sin este corte, esas preguntas se "colarían" igual.
  if (debtDimensionId && question.dimensionId === debtDimensionId && facts.get('DEBT_APPLICABILITY')?.state === 'NONE') {
    return false;
  }

  const askIf = question.askIfRule as { raw?: string } | null;
  if (askIf?.raw && !evaluateRule(askIf.raw, facts)) return false;

  const skipIf = question.skipIfRule as { raw?: string } | null;
  if (skipIf?.raw && evaluateRule(skipIf.raw, facts)) return false;

  return true;
}

// GATE (ej. "¿tienes deudas?") siempre debe resolverse antes que preguntas
// ADAPTIVE que dependan de esa respuesta, aunque compartan basePriority —
// vimos en pruebas reales que si no se fuerza este orden, una pregunta de
// deuda podía dispararse antes de saber si la deuda aplica.
const ROLE_ORDER: Record<string, number> = {
  GATE: 0,
  ANCHOR: 1,
  ADAPTIVE: 2,
  CONTEXT: 3,
  FOLLOWUP: 4,
  BEHAVIORAL: 5
};

async function loadBankAndState(employeeId: string) {
  const [bank, facts, answeredVariables, debtDimension] = await Promise.all([
    prisma.questionBank.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        questions: {
          where: { status: 'ACTIVE' },
          include: { answerOptions: true }
        }
      }
    }),
    buildFacts(employeeId),
    prisma.variableState.findMany({ where: { employeeId }, select: { variableId: true } }),
    prisma.dimension.findFirst({ where: { code: 'DEBT' } })
  ]);

  if (bank) {
    bank.questions.sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
      if (roleDiff !== 0) return roleDiff;
      return b.basePriority - a.basePriority;
    });
  }

  return {
    bank,
    facts,
    answeredSet: new Set(answeredVariables.map((v) => v.variableId)),
    debtDimensionId: debtDimension?.id ?? null
  };
}

export async function getNextQuestion(employeeId: string): Promise<QuestionWithOptions | null> {
  const { bank, facts, answeredSet, debtDimensionId } = await loadBankAndState(employeeId);
  if (!bank) return null;

  for (const question of bank.questions) {
    if (answeredSet.has(question.variableTargetId)) continue;
    if (!isApplicable(question, facts, debtDimensionId)) continue;
    return question;
  }

  return null;
}

export async function countAnsweredAndTotal(
  employeeId: string
): Promise<{ answered: number; total: number }> {
  const { bank, facts, answeredSet, debtDimensionId } = await loadBankAndState(employeeId);
  if (!bank) return { answered: 0, total: 0 };

  let answered = 0;
  let total = 0;

  for (const question of bank.questions) {
    const wasAnswered = answeredSet.has(question.variableTargetId);
    // Una pregunta ya respondida cuenta siempre, aunque una respuesta
    // posterior haya cambiado su ASK_IF/SKIP_IF — fue alcanzable cuando se
    // contestó. Una sin responder solo cuenta si hoy es aplicable.
    if (!wasAnswered && !isApplicable(question, facts, debtDimensionId)) continue;
    total += 1;
    if (wasAnswered) answered += 1;
  }

  return { answered, total };
}
