'use server';

import type { EmployeeInterventionStatus, InterventionOutcome } from '@prisma/client';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { computeNextBestAction, hasNoRealGap } from '@/lib/engines/next-best-action';
import { logLearningEvent, reportInterventionOutcome } from '@/lib/engines/learning';
import { isCommitmentTrigger, type CommitmentTrigger } from '@/lib/engines/commitment-triggers';

export type CommitmentData = { triggerCode: CommitmentTrigger; targetDate: string };

export type ActionSuggestion = {
  employeeInterventionId: string;
  status: EmployeeInterventionStatus;
  dimensionCode: string;
  titleI18nKey: string;
  descriptionI18nKey: string;
  actionTextI18nKey: string | null;
  whyThisStepI18nKey: string | null;
  videoUrl: string | null;
  commitmentData: CommitmentData | null;
};

// Distingue dos motivos muy distintos de no mostrar ninguna tarjeta: que el
// empleado de verdad no tenga ninguna brecha real (HEALTHY — "vas bien"),
// contra que el motor todavía no tenga certeza suficiente para recomendar
// algo (PENDING — ej. una pregunta condicional de la que depende la
// elegibilidad, como SAV_CAPACITY, nunca se disparó con sus respuestas). Antes
// se mostraba el mismo mensaje de "vas bien" para ambos casos, lo cual es
// engañoso cuando en realidad falta información, no que todo esté resuelto.
export type ActionResult =
  | { kind: 'suggestion'; suggestion: ActionSuggestion }
  | { kind: 'none'; reason: 'HEALTHY' | 'PENDING' };

export async function getActionSuggestion(): Promise<ActionResult> {
  const baseEmployee = await requireEmployee();
  const employeeId = baseEmployee.id;

  return runWithTenantContext(employeeTenantContext(baseEmployee), async () => {
    const existing = await prisma.employeeIntervention.findFirst({
      where: { employeeId, status: { in: ['SUGGESTED', 'COMMITTED', 'IN_PROGRESS'] } },
      include: { intervention: { include: { dimension: true } } },
      orderBy: { assignedAt: 'desc' }
    });

    if (existing) {
      // commitmentData nace null (ver Prisma schema) y solo tiene forma
      // conocida una vez que commitToAction la escribe — de ahí el cast acá
      // en vez de tipar la columna Json en el schema.
      const commitmentData = existing.commitmentData as CommitmentData | null;
      return {
        kind: 'suggestion' as const,
        suggestion: {
          employeeInterventionId: existing.id,
          status: existing.status,
          dimensionCode: existing.intervention.dimension.code,
          titleI18nKey: existing.intervention.titleI18nKey,
          descriptionI18nKey: existing.intervention.descriptionI18nKey,
          actionTextI18nKey: existing.intervention.actionTextI18nKey,
          whyThisStepI18nKey: existing.intervention.whyThisStepI18nKey,
          videoUrl: existing.intervention.videoUrl,
          commitmentData
        }
      };
    }

    const nba = await computeNextBestAction(employeeId);
    if (!nba.intervention) {
      const healthy = await hasNoRealGap(employeeId);
      return { kind: 'none' as const, reason: healthy ? ('HEALTHY' as const) : ('PENDING' as const) };
    }

    // computeNextBestAction ya excluye internamente cualquier intervención
    // que el empleado haya descartado o completado (ver excludeAlreadyResolved
    // en next-best-action.ts) — nba.intervention nunca llega acá siendo una
    // ya resuelta, así que no hace falta repetir ese filtro.
    const [employee, dimension] = await Promise.all([
      prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
      prisma.dimension.findUniqueOrThrow({ where: { id: nba.intervention.dimensionId } })
    ]);
    const created = await prisma.employeeIntervention.create({
      data: { employeeId, interventionId: nba.intervention.id, status: 'SUGGESTED' }
    });
    await logLearningEvent({
      eventType: 'INTERVENTION_SUGGESTED',
      tenantId: employee.tenantId,
      employeeId,
      context: { employeeInterventionId: created.id, method: nba.method, explanation: nba.explanation }
    });

    return {
      kind: 'suggestion' as const,
      suggestion: {
        employeeInterventionId: created.id,
        status: 'SUGGESTED' as const,
        dimensionCode: dimension.code,
        titleI18nKey: nba.intervention.titleI18nKey,
        descriptionI18nKey: nba.intervention.descriptionI18nKey,
        actionTextI18nKey: nba.intervention.actionTextI18nKey,
        whyThisStepI18nKey: nba.intervention.whyThisStepI18nKey,
        videoUrl: nba.intervention.videoUrl,
        commitmentData: null
      }
    };
  });
}

async function requireOwnEmployeeIntervention(employeeInterventionId: string) {
  const baseEmployee = await requireEmployee();
  return runWithTenantContext(employeeTenantContext(baseEmployee), async () => {
    const ei = await prisma.employeeIntervention.findUnique({ where: { id: employeeInterventionId } });
    if (!ei || ei.employeeId !== baseEmployee.id) return null;
    return { employeeId: baseEmployee.id, tenantContext: employeeTenantContext(baseEmployee), ei };
  });
}

// spec-v2.md §30: TRIGGER + DATE son los dos parámetros del compromiso que
// se capturan (ver comentario en commitment-triggers.ts sobre por qué no
// AMOUNT/FREQUENCY/DURATION). Ambos se validan acá, no solo en el cliente
// — el <input type="date"> del navegador no impide un valor manipulado.
export async function commitToAction(
  employeeInterventionId: string,
  triggerCode: string,
  targetDate: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isCommitmentTrigger(triggerCode)) {
    return { ok: false, message: 'Elige con qué vas a cumplir este compromiso.' };
  }
  const parsedDate = new Date(`${targetDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate < today) {
    return { ok: false, message: 'Elige una fecha válida, hoy o más adelante.' };
  }

  const found = await requireOwnEmployeeIntervention(employeeInterventionId);
  if (!found) return { ok: false, message: 'No encontramos esa recomendación.' };

  return runWithTenantContext(found.tenantContext, async () => {
    const commitmentData: CommitmentData = { triggerCode, targetDate };
    await prisma.employeeIntervention.update({
      where: { id: employeeInterventionId },
      data: { status: 'COMMITTED', commitmentData }
    });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: found.employeeId } });
    await logLearningEvent({
      eventType: 'INTERVENTION_COMMITTED',
      tenantId: employee.tenantId,
      employeeId: found.employeeId,
      context: { employeeInterventionId, triggerCode, targetDate }
    });
    return { ok: true };
  });
}

export async function dismissAction(employeeInterventionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await requireOwnEmployeeIntervention(employeeInterventionId);
  if (!found) return { ok: false, message: 'No encontramos esa recomendación.' };

  return runWithTenantContext(found.tenantContext, async () => {
    await prisma.employeeIntervention.update({ where: { id: employeeInterventionId }, data: { status: 'DISMISSED' } });
    return { ok: true };
  });
}

export async function reportOutcome(
  employeeInterventionId: string,
  outcome: InterventionOutcome
): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await requireOwnEmployeeIntervention(employeeInterventionId);
  if (!found) return { ok: false, message: 'No encontramos esa recomendación.' };

  return runWithTenantContext(found.tenantContext, async () => {
    // "No todavía" no cierra el ciclo — el empleado sigue comprometido, solo
    // no lo ha hecho *aún*. Si se marcara como COMPLETED igual que "lo hice"
    // o "en parte", quedaría excluida para siempre de futuras sugerencias
    // (ver alreadyResolved en getActionSuggestion) y el empleado se quedaría
    // sin nada que ver la próxima vez, en vez de que se le siga preguntando.
    if (outcome === 'NOT_ACHIEVED') {
      const employee = await prisma.employee.findUniqueOrThrow({ where: { id: found.employeeId } });
      await logLearningEvent({
        eventType: 'OUTCOME_REPORTED',
        tenantId: employee.tenantId,
        employeeId: found.employeeId,
        context: { employeeInterventionId, outcome }
      });
      return { ok: true };
    }

    await reportInterventionOutcome(employeeInterventionId, outcome);
    return { ok: true };
  });
}
