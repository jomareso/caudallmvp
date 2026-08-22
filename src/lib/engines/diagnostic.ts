import { prisma } from '@/lib/db/prisma';
import type { Question, AnswerOption } from '@prisma/client';

// NOTA: la spec (docs/spec-v2.md §22) dice explícitamente que el banco
// adaptativo "ya existe y ya fue auditado" y que no debe rehacerse desde
// cero. Lo que hay aquí es un selector simple (orden por basePriority +
// askIfRule de una sola condición) para esta primera versión angosta del
// motor, NO el algoritmo NBQ completo (Information Value + Decision Impact
// + Uncertainty Reduction - Redundancy - Burden). Portar el banco real y el
// NBQ completo queda pendiente de que ese banco auditado se incorpore aquí.

export type AskIfRule = {
  variableCode: string;
  equals: string;
};

export type QuestionWithOptions = Question & { answerOptions: AnswerOption[] };

async function isQuestionApplicable(employeeId: string, question: Question): Promise<boolean> {
  if (!question.askIfRule) return true;

  const rule = question.askIfRule as AskIfRule;
  const variable = await prisma.variable.findUnique({ where: { code: rule.variableCode } });
  if (!variable) return true;

  const state = await prisma.variableState.findUnique({
    where: { employeeId_variableId: { employeeId, variableId: variable.id } }
  });
  // El prerrequisito todavía no se conoce: no forzamos la pregunta.
  if (!state) return false;

  const value = state.value as { state?: string };
  return value.state === rule.equals;
}

export async function getNextQuestion(employeeId: string): Promise<QuestionWithOptions | null> {
  const bank = await prisma.questionBank.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      questions: {
        where: { status: 'ACTIVE' },
        orderBy: { basePriority: 'desc' },
        include: { answerOptions: true }
      }
    }
  });
  if (!bank) return null;

  for (const question of bank.questions) {
    const alreadyAnswered = await prisma.variableState.findUnique({
      where: { employeeId_variableId: { employeeId, variableId: question.variableTargetId } }
    });
    if (alreadyAnswered) continue;

    if (!(await isQuestionApplicable(employeeId, question))) continue;

    return question;
  }

  return null;
}

export async function countAnsweredAndTotal(
  employeeId: string
): Promise<{ answered: number; total: number }> {
  const bank = await prisma.questionBank.findFirst({
    where: { status: 'ACTIVE' },
    include: { questions: { where: { status: 'ACTIVE' } } }
  });
  if (!bank) return { answered: 0, total: 0 };

  let answered = 0;
  let applicableTotal = 0;

  for (const question of bank.questions) {
    if (!(await isQuestionApplicable(employeeId, question))) continue;
    applicableTotal += 1;

    const state = await prisma.variableState.findUnique({
      where: { employeeId_variableId: { employeeId, variableId: question.variableTargetId } }
    });
    if (state) answered += 1;
  }

  return { answered, total: applicableTotal };
}
