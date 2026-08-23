import { prisma } from '@/lib/db/prisma';
import type { LearningEventType, Prisma, InterventionOutcome } from '@prisma/client';

// spec-v2.md §31: el ciclo completo es Diagnóstico → Acción → Compromiso →
// Conducta observada → Aprendizaje → Nuevo estado → Next Best Action. Este
// motor cubre CAPTURAR esa conducta observada (LearningEvent +
// EmployeeIntervention.outcome/feedback) — es el prerequisito de datos.
// Lo que la spec pide después ("NOT_COMPLETED + TOO_DIFFICULT puede reducir
// preferred_action_size y actualizar self_efficacy/friction probability",
// es decir, que el aprendizaje realmente cambie la próxima selección de
// Next Best Action) es Fase 8 de la spec y queda para una sesión aparte:
// hoy no hay suficiente volumen de EmployeeIntervention por empleado para
// que ese ajuste signifique algo real, y construirlo sin datos sería
// inventar coeficientes.

export async function logLearningEvent(params: {
  eventType: LearningEventType;
  tenantId: string;
  employeeId?: string | null;
  context: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.learningEvent.create({
    data: {
      eventType: params.eventType,
      employeeId: params.employeeId ?? null,
      tenantId: params.tenantId,
      context: params.context
    }
  });
}

export async function reportInterventionOutcome(
  employeeInterventionId: string,
  outcome: InterventionOutcome,
  feedback?: Prisma.InputJsonValue
): Promise<void> {
  const employeeIntervention = await prisma.employeeIntervention.update({
    where: { id: employeeInterventionId },
    data: {
      status: 'COMPLETED',
      outcome,
      completedAt: new Date(),
      feedback: feedback ?? undefined
    },
    include: { employee: true }
  });

  await logLearningEvent({
    eventType: 'OUTCOME_REPORTED',
    tenantId: employeeIntervention.employee.tenantId,
    employeeId: employeeIntervention.employeeId,
    context: { employeeInterventionId, outcome }
  });
}
