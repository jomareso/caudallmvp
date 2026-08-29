'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { sendPushToEmployee } from '@/lib/push/send';
import type { NotificationType } from '@prisma/client';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido.'),
  title: z.string().trim().min(1, 'Falta el título.'),
  body: z.string().trim().min(1, 'Falta el mensaje.')
});

// Solo ADM: herramienta de verificación de la infraestructura de push
// (spec/Decisión 9), no una función de producto — los recordatorios de
// verdad (diagnóstico incompleto, compromiso pendiente, etc.) ya corren
// solos vía notification-engine.ts (netlify/functions/notifications-cron),
// configurables como NotificationRule desde este mismo panel. Esto es solo
// un envío suelto para confirmar que las suscripciones push de un empleado
// puntual funcionan.
export async function sendTestPushNotification(
  formData: FormData
): Promise<{ ok: true; sent: number; expired: number } | { ok: false; message: string }> {
  await requireAdm();

  const parsed = schema.safeParse({
    email: formData.get('email'),
    title: formData.get('title'),
    body: formData.get('body')
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.' };
  }

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const employee = await prisma.employee.findFirst({ where: { personalEmail: parsed.data.email } });
    if (!employee) {
      return { ok: false, message: 'No encontramos ningún empleado con ese correo.' };
    }

    const subscriptionCount = await prisma.pushSubscription.count({ where: { employeeId: employee.id } });
    if (subscriptionCount === 0) {
      return { ok: false, message: 'Ese empleado no tiene notificaciones activadas todavía.' };
    }

    try {
      const result = await sendPushToEmployee(employee.id, { title: parsed.data.title, body: parsed.data.body });
      return { ok: true, sent: result.sent, expired: result.expired };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido enviando la notificación.';
      return { ok: false, message };
    }
  });
}

// Reglas de notificación (feature: notificaciones programables por regla,
// ver NotificationRule en schema.prisma y src/lib/push/notification-engine.ts)
// -----------------------------------------------------------------------

const TEMPLATE_TYPES = ['COMMITMENT', 'INCOMPLETE', 'RESULT_UPDATED', 'NEW_STEP', 'LICENSE_EXPIRING'] as const;

// Solo estas 2 plantillas dependen de un umbral de días — las otras 3 son
// puramente event-driven (ver notification-engine.ts), un "days" ahí no
// significaría nada.
const DAYS_TEMPLATES: NotificationType[] = ['INCOMPLETE', 'LICENSE_EXPIRING'];

const ruleFieldsSchema = z.object({
  templateType: z.enum(TEMPLATE_TYPES),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(300),
  days: z.coerce.number().int().min(1).max(365).optional()
});

export async function createNotificationRule(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.notifications.rules');

  const parsed = ruleFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { templateType, title, body, days } = parsed.data;

  if (DAYS_TEMPLATES.includes(templateType) && !days) {
    return { ok: false, message: t('errorDaysRequired') };
  }

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const rule = await prisma.notificationRule.create({
      data: {
        templateType,
        title,
        body,
        days: DAYS_TEMPLATES.includes(templateType) ? days : null,
        enabled: true
      }
    });

    await prisma.auditLog.create({
      data: {
        whoId: actor.id,
        whoData: { email: actor.email, profileType: actor.profileType },
        what: 'CREATE_NOTIFICATION_RULE',
        entityType: 'NotificationRule',
        entityId: rule.id,
        newValue: { templateType, title, body, days: rule.days }
      }
    });

    return { ok: true };
  });
}

const updateRuleFieldsSchema = ruleFieldsSchema.omit({ templateType: true }).extend({
  ruleId: z.string().trim().min(1)
});

// templateType no se puede cambiar después de creada — decide qué motor la
// recoge (ver notification-engine.ts) y qué significa refId en
// NotificationLog; cambiarla dejaría el historial de envíos sin sentido.
// Para usar otra plantilla, se crea una regla nueva.
export async function updateNotificationRule(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.notifications.rules');

  const parsed = updateRuleFieldsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { ruleId, title, body, days } = parsed.data;

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const target = await prisma.notificationRule.findUnique({ where: { id: ruleId } });
    if (!target) {
      return { ok: false, message: t('errorGeneric') };
    }

    if (DAYS_TEMPLATES.includes(target.templateType) && !days) {
      return { ok: false, message: t('errorDaysRequired') };
    }

    const newDays = DAYS_TEMPLATES.includes(target.templateType) ? days : null;

    await prisma.notificationRule.update({
      where: { id: ruleId },
      data: { title, body, days: newDays }
    });

    await prisma.auditLog.create({
      data: {
        whoId: actor.id,
        whoData: { email: actor.email, profileType: actor.profileType },
        what: 'UPDATE_NOTIFICATION_RULE',
        entityType: 'NotificationRule',
        entityId: ruleId,
        previousValue: { title: target.title, body: target.body, days: target.days },
        newValue: { title, body, days: newDays }
      }
    });

    return { ok: true };
  });
}

export async function setNotificationRuleEnabled(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.notifications.rules');

  const parsed = z.object({ ruleId: z.string().trim().min(1), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { ruleId, enabled } = parsed.data;

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const target = await prisma.notificationRule.findUnique({ where: { id: ruleId } });
    if (!target) {
      return { ok: false, message: t('errorGeneric') };
    }

    await prisma.notificationRule.update({ where: { id: ruleId }, data: { enabled } });

    await prisma.auditLog.create({
      data: {
        whoId: actor.id,
        whoData: { email: actor.email, profileType: actor.profileType },
        what: enabled ? 'ENABLE_NOTIFICATION_RULE' : 'DISABLE_NOTIFICATION_RULE',
        entityType: 'NotificationRule',
        entityId: ruleId,
        previousValue: { enabled: target.enabled },
        newValue: { enabled }
      }
    });

    return { ok: true };
  });
}

export async function deleteNotificationRule(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.notifications.rules');

  const parsed = z.object({ ruleId: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { ruleId } = parsed.data;

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const target = await prisma.notificationRule.findUnique({ where: { id: ruleId } });
    if (!target) {
      return { ok: false, message: t('errorGeneric') };
    }

    // ON DELETE CASCADE en notification_logs.ruleId (ver migración) — se
    // borra junto el historial de envíos de esta regla, que ya no
    // significa nada sin ella.
    await prisma.notificationRule.delete({ where: { id: ruleId } });

    await prisma.auditLog.create({
      data: {
        whoId: actor.id,
        whoData: { email: actor.email, profileType: actor.profileType },
        what: 'DELETE_NOTIFICATION_RULE',
        entityType: 'NotificationRule',
        entityId: ruleId,
        previousValue: { templateType: target.templateType, title: target.title, body: target.body, days: target.days }
      }
    });

    return { ok: true };
  });
}
