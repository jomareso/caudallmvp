import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { sendPushToEmployee, type PushPayload } from '@/lib/push/send';
import { computeNextBestAction } from '@/lib/engines/next-best-action';
import type { NotificationRule, NotificationType } from '@prisma/client';

// Ítem 7 de la auditoría UX del flujo colaborador (28 ago) + feature de
// reglas configurables desde /admin/notificaciones (29 ago): el motor que
// decide CUÁNDO enviar cada notificación. Corre una vez al día — ver
// netlify/functions/notifications-cron.mts — bajo contexto platform-admin
// porque necesita recorrer empleados de TODOS los tenants, igual que el
// sync del banco maestro.
//
// El QUÉ (título/cuerpo/días/activo) vive en NotificationRule, editable
// desde el admin. El CUÁNDO sigue siendo código: cada plantilla usa el
// motor que YA calcula esa señal (regla CORE #19: FRICTION -> TECHNIQUE,
// la fricción tiene que ser real, no inventada para la ocasión):
//   COMMITMENT       -> EmployeeIntervention.commitmentData.targetDate
//   INCOMPLETE       -> FinancialState.diagnosticStartedAt sin completar,
//                       más de rule.days días (por eso INCOMPLETE y
//                       LICENSE_EXPIRING son las únicas plantillas con
//                       parámetro de días editable)
//   RESULT_UPDATED   -> FinancialState.lastDiagnosticCompletedAt (en un
//                       empleado que YA tenía un resultado previo)
//   NEW_STEP         -> computeNextBestAction (motor de Next Best Action)
//   LICENSE_EXPIRING -> License.expiresAt, dentro de rule.days días
//
// Puede haber más de una NotificationRule activa por plantilla (ej. dos
// avisos de "incompleto" a distintos días) — por eso el loop de cada
// plantilla corre una vez POR REGLA, y el dedup en NotificationLog es por
// ruleId, no por tipo.
//
// Los textos de cada regla van en español plano, igual que los templates de
// correo en src/lib/email/send-magic-link.ts — no hay componente React de
// por medio para pasar por useTranslations(), y el MVP es solo español
// (Decisión 5).
//
// NotificationPreference.emailChannelEnabled todavía no tiene una
// contraparte por correo para estas plantillas — ver nota en el PR. Este
// motor solo cubre el canal push. La preferencia de apagar/prender sigue
// siendo por PLANTILLA (NotificationPreference), no por instancia de
// regla — el empleado no ve las reglas del admin, solo los 5 tipos.

const ACTIVE_INTERVENTION_STATUSES = ['SUGGESTED', 'COMMITTED', 'IN_PROGRESS'] as const;

type NotificationTypeKey = 'commitment' | 'incomplete' | 'resultUpdated' | 'newStep' | 'licenseExpiring';

const PREFERENCE_FIELD: Record<NotificationTypeKey, 'commitment' | 'incomplete' | 'resultUpdated' | 'newStep' | 'licenseExpiring'> = {
  commitment: 'commitment',
  incomplete: 'incomplete',
  resultUpdated: 'resultUpdated',
  newStep: 'newStep',
  licenseExpiring: 'licenseExpiring'
};

const TEMPLATE_TYPE: Record<NotificationTypeKey, NotificationType> = {
  commitment: 'COMMITMENT',
  incomplete: 'INCOMPLETE',
  resultUpdated: 'RESULT_UPDATED',
  newStep: 'NEW_STEP',
  licenseExpiring: 'LICENSE_EXPIRING'
};

export type NotificationEngineSummary = Record<NotificationTypeKey, { sent: number; expired: number; skipped: number }>;

function emptySummary(): NotificationEngineSummary {
  return {
    commitment: { sent: 0, expired: 0, skipped: 0 },
    incomplete: { sent: 0, expired: 0, skipped: 0 },
    resultUpdated: { sent: 0, expired: 0, skipped: 0 },
    newStep: { sent: 0, expired: 0, skipped: 0 },
    licenseExpiring: { sent: 0, expired: 0, skipped: 0 }
  };
}

async function getEnabledRules(key: NotificationTypeKey): Promise<NotificationRule[]> {
  return prisma.notificationRule.findMany({
    where: { templateType: TEMPLATE_TYPE[key], enabled: true }
  });
}

async function isEnabled(employeeId: string, key: NotificationTypeKey): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({ where: { employeeId } });
  // Sin fila = nunca abrió Configuración -> los 5 tipos siguen en su
  // default (true), igual que la columna en la base de datos.
  if (!preference) return true;
  return preference[PREFERENCE_FIELD[key]];
}

// Solo registra el envío como hecho si de verdad llegó a algún
// dispositivo — si el empleado no tiene ninguna suscripción push todavía,
// no se marca "ya avisado": el día que la active, el próximo barrido lo
// intenta de nuevo con la misma causa.
async function sendAndLog(
  employeeId: string,
  ruleId: string,
  refId: string | null,
  payload: PushPayload
): Promise<{ sent: number; expired: number }> {
  const result = await sendPushToEmployee(employeeId, payload);
  if (result.sent > 0) {
    await prisma.notificationLog.create({ data: { employeeId, ruleId, refId } });
  }
  return result;
}

async function runCommitmentReminders(summary: NotificationEngineSummary): Promise<void> {
  const rules = await getEnabledRules('commitment');
  if (rules.length === 0) return;

  const todayISO = new Date().toISOString().slice(0, 10);
  const candidates = await prisma.employeeIntervention.findMany({
    where: { status: { in: [...ACTIVE_INTERVENTION_STATUSES] } }
  });

  for (const ei of candidates) {
    const commitmentData = ei.commitmentData as { triggerCode: string; targetDate: string } | null;
    if (!commitmentData?.targetDate || commitmentData.targetDate > todayISO) continue;

    if (!(await isEnabled(ei.employeeId, 'commitment'))) {
      summary.commitment.skipped += 1;
      continue;
    }

    for (const rule of rules) {
      const alreadySent = await prisma.notificationLog.findFirst({
        where: { employeeId: ei.employeeId, ruleId: rule.id, refId: ei.id }
      });
      if (alreadySent) continue;

      const result = await sendAndLog(ei.employeeId, rule.id, ei.id, {
        title: rule.title,
        body: rule.body,
        url: '/diagnostico/accion'
      });
      summary.commitment.sent += result.sent;
      summary.commitment.expired += result.expired;
    }
  }
}

async function runIncompleteReminders(summary: NotificationEngineSummary): Promise<void> {
  const rules = await getEnabledRules('incomplete');
  if (rules.length === 0) return;

  for (const rule of rules) {
    const days = rule.days ?? 3;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    const candidates = await prisma.financialState.findMany({
      where: { lastDiagnosticCompletedAt: null, diagnosticStartedAt: { lte: threshold } }
    });

    for (const state of candidates) {
      if (!(await isEnabled(state.employeeId, 'incomplete'))) {
        summary.incomplete.skipped += 1;
        continue;
      }

      const alreadySent = await prisma.notificationLog.findFirst({
        where: { employeeId: state.employeeId, ruleId: rule.id }
      });
      if (alreadySent) continue;

      const result = await sendAndLog(state.employeeId, rule.id, null, {
        title: rule.title,
        body: rule.body,
        url: '/diagnostico'
      });
      summary.incomplete.sent += result.sent;
      summary.incomplete.expired += result.expired;
    }
  }
}

async function runResultUpdatedNotifications(summary: NotificationEngineSummary): Promise<void> {
  const rules = await getEnabledRules('resultUpdated');
  if (rules.length === 0) return;

  const candidates = await prisma.financialState.findMany({
    where: { lastDiagnosticCompletedAt: { not: null } }
  });

  for (const state of candidates) {
    const completedAt = state.lastDiagnosticCompletedAt!;
    const refId = completedAt.toISOString();

    // "Actualizado" implica que ya existía un resultado antes — se detecta
    // con una intervención asignada ANTES de esta finalización, que solo
    // pudo haberse creado a partir de un diagnóstico previo ya completado.
    const hadPriorResult = await prisma.employeeIntervention.findFirst({
      where: { employeeId: state.employeeId, assignedAt: { lt: completedAt } }
    });
    if (!hadPriorResult) continue;

    if (!(await isEnabled(state.employeeId, 'resultUpdated'))) {
      summary.resultUpdated.skipped += 1;
      continue;
    }

    for (const rule of rules) {
      const alreadySentForThisCompletion = await prisma.notificationLog.findFirst({
        where: { employeeId: state.employeeId, ruleId: rule.id, refId }
      });
      if (alreadySentForThisCompletion) continue;

      const result = await sendAndLog(state.employeeId, rule.id, refId, {
        title: rule.title,
        body: rule.body,
        url: '/diagnostico/resultado'
      });
      summary.resultUpdated.sent += result.sent;
      summary.resultUpdated.expired += result.expired;
    }
  }
}

async function runNewStepNotifications(summary: NotificationEngineSummary): Promise<void> {
  const rules = await getEnabledRules('newStep');
  if (rules.length === 0) return;

  const idleEmployees = await prisma.financialState.findMany({
    where: {
      lastDiagnosticCompletedAt: { not: null },
      employee: { interventions: { none: { status: { in: [...ACTIVE_INTERVENTION_STATUSES] } } } }
    },
    select: { employeeId: true }
  });

  for (const { employeeId } of idleEmployees) {
    const nba = await computeNextBestAction(employeeId);
    if (!nba.intervention) continue;

    const refId = nba.intervention.id;

    if (!(await isEnabled(employeeId, 'newStep'))) {
      summary.newStep.skipped += 1;
      continue;
    }

    for (const rule of rules) {
      const alreadySent = await prisma.notificationLog.findFirst({
        where: { employeeId, ruleId: rule.id, refId }
      });
      if (alreadySent) continue;

      const result = await sendAndLog(employeeId, rule.id, refId, {
        title: rule.title,
        body: rule.body,
        url: '/diagnostico/accion'
      });
      summary.newStep.sent += result.sent;
      summary.newStep.expired += result.expired;
    }
  }
}

async function runLicenseExpiringNotifications(summary: NotificationEngineSummary): Promise<void> {
  const rules = await getEnabledRules('licenseExpiring');
  if (rules.length === 0) return;

  for (const rule of rules) {
    const days = rule.days ?? 7;
    const now = new Date();
    const window = new Date();
    window.setDate(window.getDate() + days);

    const candidates = await prisma.license.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now, lte: window } },
      include: { employee: true }
    });

    for (const license of candidates) {
      if (!license.employee) continue;
      const employeeId = license.employee.id;

      if (!(await isEnabled(employeeId, 'licenseExpiring'))) {
        summary.licenseExpiring.skipped += 1;
        continue;
      }

      const alreadySent = await prisma.notificationLog.findFirst({
        where: { employeeId, ruleId: rule.id, refId: license.id }
      });
      if (alreadySent) continue;

      const result = await sendAndLog(employeeId, rule.id, license.id, {
        title: rule.title,
        body: rule.body,
        url: '/perfil'
      });
      summary.licenseExpiring.sent += result.sent;
      summary.licenseExpiring.expired += result.expired;
    }
  }
}

export async function runNotificationEngine(): Promise<NotificationEngineSummary> {
  const summary = emptySummary();

  await runWithTenantContext({ kind: 'platform-admin' }, async () => {
    await runCommitmentReminders(summary);
    await runIncompleteReminders(summary);
    await runResultUpdatedNotifications(summary);
    await runNewStepNotifications(summary);
    await runLicenseExpiringNotifications(summary);
  });

  return summary;
}
