'use server';

import { redirect } from 'next/navigation';
import type { EmployeeInterventionStatus, InterventionOutcome } from '@prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { computeNextBestAction } from '@/lib/engines/next-best-action';
import { logLearningEvent, reportInterventionOutcome } from '@/lib/engines/learning';

async function requireEmployeeId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect('/');
  return session.user.id;
}

export type ActionSuggestion = {
  employeeInterventionId: string;
  status: EmployeeInterventionStatus;
  titleI18nKey: string;
  descriptionI18nKey: string;
  actionTextI18nKey: string | null;
  whyThisStepI18nKey: string | null;
};

export async function getActionSuggestion(): Promise<ActionSuggestion | null> {
  const employeeId = await requireEmployeeId();

  const existing = await prisma.employeeIntervention.findFirst({
    where: { employeeId, status: { in: ['SUGGESTED', 'COMMITTED', 'IN_PROGRESS'] } },
    include: { intervention: true },
    orderBy: { assignedAt: 'desc' }
  });

  if (existing) {
    return {
      employeeInterventionId: existing.id,
      status: existing.status,
      titleI18nKey: existing.intervention.titleI18nKey,
      descriptionI18nKey: existing.intervention.descriptionI18nKey,
      actionTextI18nKey: existing.intervention.actionTextI18nKey,
      whyThisStepI18nKey: existing.intervention.whyThisStepI18nKey
    };
  }

  const nba = await computeNextBestAction(employeeId);
  if (!nba.intervention) return null;

  // No volver a ofrecer algo que el empleado ya descartó explícitamente —
  // el motor todavía no busca "la siguiente mejor opción tras un descarte",
  // así que por ahora se prefiere no sugerir nada antes que repetir la
  // misma tarjeta que el empleado ya dijo "ahora no".
  const alreadyDismissed = await prisma.employeeIntervention.findFirst({
    where: { employeeId, interventionId: nba.intervention.id, status: 'DISMISSED' }
  });
  if (alreadyDismissed) return null;

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
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
    employeeInterventionId: created.id,
    status: 'SUGGESTED',
    titleI18nKey: nba.intervention.titleI18nKey,
    descriptionI18nKey: nba.intervention.descriptionI18nKey,
    actionTextI18nKey: nba.intervention.actionTextI18nKey,
    whyThisStepI18nKey: nba.intervention.whyThisStepI18nKey
  };
}

async function requireOwnEmployeeIntervention(employeeInterventionId: string) {
  const employeeId = await requireEmployeeId();
  const ei = await prisma.employeeIntervention.findUnique({ where: { id: employeeInterventionId } });
  if (!ei || ei.employeeId !== employeeId) return null;
  return { employeeId, ei };
}

export async function commitToAction(employeeInterventionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await requireOwnEmployeeIntervention(employeeInterventionId);
  if (!found) return { ok: false, message: 'No encontramos esa recomendación.' };

  await prisma.employeeIntervention.update({ where: { id: employeeInterventionId }, data: { status: 'COMMITTED' } });
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: found.employeeId } });
  await logLearningEvent({
    eventType: 'INTERVENTION_COMMITTED',
    tenantId: employee.tenantId,
    employeeId: found.employeeId,
    context: { employeeInterventionId }
  });
  return { ok: true };
}

export async function dismissAction(employeeInterventionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await requireOwnEmployeeIntervention(employeeInterventionId);
  if (!found) return { ok: false, message: 'No encontramos esa recomendación.' };

  await prisma.employeeIntervention.update({ where: { id: employeeInterventionId }, data: { status: 'DISMISSED' } });
  return { ok: true };
}

export async function reportOutcome(
  employeeInterventionId: string,
  outcome: InterventionOutcome
): Promise<{ ok: true } | { ok: false; message: string }> {
  const found = await requireOwnEmployeeIntervention(employeeInterventionId);
  if (!found) return { ok: false, message: 'No encontramos esa recomendación.' };

  await reportInterventionOutcome(employeeInterventionId, outcome);
  return { ok: true };
}
