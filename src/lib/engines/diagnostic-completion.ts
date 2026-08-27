import { prisma } from '@/lib/db/prisma';
import { computeRootCause } from './root-cause';
import { computePriority } from './priority';
import { computeEligibility } from './eligibility';
import { countAnsweredAndTotal } from './diagnostic';
import { logLearningEvent } from './learning';

// Causa raíz (§25), Prioridad (§26) y Eligibility/Readiness (§18, §27)
// requieren el panorama completo de dimensiones, así que se calculan una
// sola vez al completar el diagnóstico, no en cada respuesta. Vive en un
// solo lugar (no inline en el server action) porque hay dos caminos que
// terminan un diagnóstico: responder la última pregunta (actions.ts) y
// revisitar `/diagnostico` cuando ya no queda ninguna pregunta pendiente
// (page.tsx, ej. una cuenta que ya había respondido todo antes de que
// estos motores existieran) — ambos deben calcular lo mismo.
export async function finalizeDiagnostic(employeeId: string): Promise<void> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });

  const rootCauseResult = await computeRootCause(employeeId);
  const priorityResult = await computePriority(employeeId);
  const eligibilityResult = await computeEligibility(employeeId);

  const rootCause = JSON.stringify(rootCauseResult);
  const systemPriority = JSON.stringify(priorityResult);
  const finReadiness = eligibilityResult.financialReadiness.state;
  const behReadiness = eligibilityResult.behavioralReadiness.state;
  const eligibility = eligibilityResult;

  // "Cuánto toma el diagnóstico" (usado en la pantalla de bienvenida, ver
  // diagnostic-stats.ts) mide SOLO la parte financiera — diagnosticStartedAt
  // se fija en la primera respuesta (submitDiagnosticAnswer). Si por algún
  // motivo no está (ej. una cuenta vieja que ya tenía evidence antes de que
  // este campo existiera), no se inventa una duración: queda null y esa
  // fila simplemente no entra al promedio.
  const existing = await prisma.financialState.findUnique({ where: { employeeId } });
  const completedAt = new Date();
  const diagnosticDurationSeconds = existing?.diagnosticStartedAt
    ? Math.max(0, Math.round((completedAt.getTime() - existing.diagnosticStartedAt.getTime()) / 1000))
    : null;
  const { answered: questionsAnsweredCount } = await countAnsweredAndTotal(employeeId);

  await prisma.financialState.upsert({
    where: { employeeId },
    update: {
      lastDiagnosticCompletedAt: completedAt,
      rootCause,
      systemPriority,
      finReadiness,
      behReadiness,
      eligibility,
      diagnosticDurationSeconds,
      questionsAnsweredCount
    },
    create: {
      employeeId,
      cfhiScore: 0,
      cfhiConfidence: 0,
      lastDiagnosticCompletedAt: completedAt,
      rootCause,
      systemPriority,
      finReadiness,
      behReadiness,
      eligibility,
      diagnosticDurationSeconds,
      questionsAnsweredCount
    }
  });

  await logLearningEvent({
    eventType: 'DIAGNOSTIC_COMPLETED',
    tenantId: employee.tenantId,
    employeeId,
    context: { rootCauseDimension: rootCauseResult.dimensionCode, systemPriorityDimension: priorityResult.dimensionCode }
  });
}
