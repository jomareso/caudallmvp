'use server';

import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { recomputeCfhi, recomputeConstructScore, recomputeDimensionScore, type EvidencePayload } from '@/lib/engines/cfhi';
import { recomputeBehavioralBiasState } from '@/lib/engines/behavioral-state';
import { getNextQuestion, buildFacts } from '@/lib/engines/diagnostic';
import { evaluateSafety } from '@/lib/engines/safety';
import { materializeInferences } from '@/lib/engines/inference-substitution';
import { finalizeDiagnostic } from '@/lib/engines/diagnostic-completion';

export async function submitDiagnosticAnswer(input: {
  questionId: string;
  answerOptionId: string;
}): Promise<{ ok: true; done: boolean } | { ok: false; message: string }> {
  const baseEmployee = await requireEmployee();
  const employeeId = baseEmployee.id;
  const t = await getTranslations('diagnostic.errors');

  return runWithTenantContext(employeeTenantContext(baseEmployee), async () => {
    const answerOption = await prisma.answerOption.findUnique({
      where: { id: input.answerOptionId }
    });

    if (!answerOption || answerOption.questionId !== input.questionId) {
      return { ok: false, message: t('optionUnavailable') };
    }

    // diagnosticStartedAt se fija una sola vez, en la primerísima
    // respuesta (financiera o de contexto, lo que llegue primero — en la
    // práctica siempre financiera, ya que el bloque de contexto solo se
    // ofrece después) — mide cuánto toma la parte financiera del
    // diagnóstico (ver diagnostic-completion.ts y diagnostic-stats.ts).
    const financialStateExists = await prisma.financialState.findUnique({
      where: { employeeId },
      select: { employeeId: true }
    });
    if (!financialStateExists) {
      await prisma.financialState.create({
        data: { employeeId, cfhiScore: 0, cfhiConfidence: 0, diagnosticStartedAt: new Date() }
      });
    }

    const evidenceValue = answerOption.evidenceProduced as EvidencePayload;

    const [variable, employee, activeMethodology] = await Promise.all([
      prisma.variable.findUnique({ where: { code: evidenceValue.variableCode } }),
      prisma.employee.findUnique({ where: { id: employeeId } }),
      prisma.methodology.findFirst({ where: { status: 'ACTIVE' } })
    ]);

    if (!variable || !employee || !activeMethodology) {
      return { ok: false, message: t('loadError') };
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

    // Variables *_RESPONSE de sesgos conductuales: recalcula el *_STATE
    // derivado (ver behavioral-state.ts) que el motor de reglas usa para
    // decidir si hace falta un ítem de confirmación.
    if (variable.code.endsWith('_RESPONSE')) {
      await recomputeBehavioralBiasState(employeeId, variable.code);
    }

    await recomputeCfhi(employeeId);
    await evaluateSafety(employeeId);

    // Regla CORE #15: una inferencia fuerte puede sustituir una pregunta.
    // Corre después de guardar la respuesta directa (para ver los hechos
    // más recientes) y antes de pedir la siguiente pregunta (para que
    // isApplicable() ya vea cualquier variable recién inferida y salte la
    // pregunta correspondiente en esta misma vuelta, no en la próxima).
    const facts = await buildFacts(employeeId);
    await materializeInferences(employeeId, facts);
    await recomputeCfhi(employeeId);

    const nextQuestion = await getNextQuestion(employeeId);
    const done = !nextQuestion;

    if (done) {
      await finalizeDiagnostic(employeeId);
    }

    return { ok: true, done };
  });
}
