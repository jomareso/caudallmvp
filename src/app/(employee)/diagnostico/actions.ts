'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { recomputeCfhi, recomputeConstructScore, recomputeDimensionScore, type EvidencePayload } from '@/lib/engines/cfhi';
import { getNextQuestion } from '@/lib/engines/diagnostic';
import { evaluateSafety } from '@/lib/engines/safety';
import { computeRootCause } from '@/lib/engines/root-cause';
import { computePriority } from '@/lib/engines/priority';

async function requireEmployeeId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  return session.user.id;
}

export async function submitDiagnosticAnswer(input: {
  questionId: string;
  answerOptionId: string;
}): Promise<{ ok: true; done: boolean } | { ok: false; message: string }> {
  const employeeId = await requireEmployeeId();

  const answerOption = await prisma.answerOption.findUnique({
    where: { id: input.answerOptionId }
  });

  if (!answerOption || answerOption.questionId !== input.questionId) {
    return { ok: false, message: 'Esa opción ya no está disponible. Recarga la página.' };
  }

  const evidenceValue = answerOption.evidenceProduced as EvidencePayload;

  const [variable, employee, activeMethodology] = await Promise.all([
    prisma.variable.findUnique({ where: { code: evidenceValue.variableCode } }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
    prisma.methodology.findFirst({ where: { status: 'ACTIVE' } })
  ]);

  if (!variable || !employee || !activeMethodology) {
    return { ok: false, message: 'Hubo un problema cargando la pregunta. Intenta de nuevo.' };
  }

  await prisma.evidence.create({
    data: {
      tenantId: employee.tenantId,
      employeeId,
      source: 'QUESTION',
      questionId: input.questionId,
      answerOptionId: input.answerOptionId,
      variableId: variable.id,
      value: evidenceValue,
      reliability: 'DIRECT',
      confidence: 100,
      primaryOwnerConstructId: variable.primaryOwnerConstructId,
      methodologyVersionId: activeMethodology.version
    }
  });

  await prisma.variableState.upsert({
    where: { employeeId_variableId: { employeeId, variableId: variable.id } },
    update: { value: evidenceValue, confidence: 100, state: evidenceValue.state, derivedFromEvidenceIds: [] },
    create: {
      employeeId,
      variableId: variable.id,
      value: evidenceValue,
      confidence: 100,
      state: evidenceValue.state,
      derivedFromEvidenceIds: []
    }
  });

  if (variable.primaryOwnerConstructId) {
    const construct = await prisma.construct.findUnique({ where: { id: variable.primaryOwnerConstructId } });
    await recomputeConstructScore(employeeId, variable.primaryOwnerConstructId);
    // Los constructos conductuales (BEH_*) no pertenecen a ninguna
    // dimensión del CFHI (dimensionId null) — no hay nada que recalcular
    // ahí (spec: "Behavioral NO es una sexta dimensión").
    if (construct?.dimensionId) await recomputeDimensionScore(employeeId, construct.dimensionId);
  } else if (variable.dimensionId) {
    // Variables de contexto/gating (ej. DEBT_APPLICABILITY) no tienen
    // constructo propio, pero igual pueden definir el estado N/A de su
    // dimensión (regla CORE #7 / #21).
    await recomputeDimensionScore(employeeId, variable.dimensionId);
  }

  await recomputeCfhi(employeeId);
  await evaluateSafety(employeeId);

  const nextQuestion = await getNextQuestion(employeeId);
  const done = !nextQuestion;

  if (done) {
    // Causa raíz (spec §25) y Prioridad (spec §26) requieren el panorama
    // completo de dimensiones, así que se calculan una sola vez al
    // terminar, no en cada respuesta. Priority reutiliza Root Cause
    // internamente, así que se computa aparte para no duplicar el cálculo.
    const rootCauseResult = await computeRootCause(employeeId);
    const priorityResult = await computePriority(employeeId);
    const rootCause = JSON.stringify(rootCauseResult);
    const systemPriority = JSON.stringify(priorityResult);
    await prisma.financialState.upsert({
      where: { employeeId },
      update: { lastDiagnosticCompletedAt: new Date(), rootCause, systemPriority },
      create: {
        employeeId,
        cfhiScore: 0,
        cfhiConfidence: 0,
        lastDiagnosticCompletedAt: new Date(),
        rootCause,
        systemPriority
      }
    });
  }

  return { ok: true, done };
}
