'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { requireEmployeeWithContext } from '@/lib/auth/employee-context';
import { createMagicLinkToken } from '@/lib/auth/magic-link';
import { sendEmailChangeConfirmation } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';

type ActionResult = { ok: true } | { ok: false; message: string };

const NOTIFICATION_KEYS = ['commitment', 'incomplete', 'resultUpdated', 'newStep', 'licenseExpiring'] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

function isNotificationKey(key: string): key is NotificationKey {
  return (NOTIFICATION_KEYS as readonly string[]).includes(key);
}

// Fila con defaults si el empleado nunca abrió Configuración — evita que
// cada page.tsx tenga que repetir el mismo upsert-de-lectura.
export async function getOrCreateNotificationPreference(employeeId: string) {
  return prisma.notificationPreference.upsert({
    where: { employeeId },
    update: {},
    create: { employeeId }
  });
}

export async function toggleNotificationPreference(key: NotificationKey): Promise<ActionResult> {
  if (!isNotificationKey(key)) return { ok: false, message: 'Tipo de notificación inválido.' };

  return requireEmployeeWithContext(async (employee) => {
    const current = await getOrCreateNotificationPreference(employee.id);
    await prisma.notificationPreference.update({
      where: { employeeId: employee.id },
      data: { [key]: !current[key] }
    });
    revalidatePath('/perfil');
    return { ok: true };
  });
}

export async function toggleEmailChannel(): Promise<ActionResult> {
  return requireEmployeeWithContext(async (employee) => {
    const current = await getOrCreateNotificationPreference(employee.id);
    await prisma.notificationPreference.update({
      where: { employeeId: employee.id },
      data: { emailChannelEnabled: !current.emailChannelEnabled }
    });
    revalidatePath('/perfil');
    return { ok: true };
  });
}

const emailSchema = z.string().trim().toLowerCase().email();

export async function requestEmailChange(rawEmail: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, message: 'Ingresa un correo válido.' };
  const newEmail = parsed.data;

  return requireEmployeeWithContext(async (employee) => {
    if (newEmail === employee.personalEmail) {
      return { ok: false, message: 'Ese ya es tu correo actual.' };
    }

    const taken = await prisma.employee.findUnique({
      where: { tenantId_personalEmail: { tenantId: employee.tenantId, personalEmail: newEmail } }
    });
    if (taken) {
      return { ok: false, message: 'Ese correo ya está en uso por otra cuenta.' };
    }

    const token = await createMagicLinkToken({
      type: 'email-change',
      tenantId: employee.tenantId,
      employeeId: employee.id,
      newEmail
    });
    const verifyUrl = `${getRequestOrigin()}/api/auth/verify-email-change?token=${encodeURIComponent(token)}`;

    try {
      await sendEmailChangeConfirmation({ to: newEmail, verifyUrl });
    } catch (error) {
      console.error('[requestEmailChange] fallo al enviar correo', error);
      return { ok: false, message: 'No pudimos enviar el correo ahora mismo. Intenta de nuevo en un momento.' };
    }

    return { ok: true };
  });
}

export async function logout(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/acceso');
}
