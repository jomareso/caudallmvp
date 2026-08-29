'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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
  if (!isNotificationKey(key)) {
    const t = await getTranslations('employee.profile.notifications');
    return { ok: false, message: t('errorInvalidType') };
  }

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
  const t = await getTranslations('employee.profile.email');
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, message: t('invalidEmail') };
  const newEmail = parsed.data;

  return requireEmployeeWithContext(async (employee) => {
    if (newEmail === employee.personalEmail) {
      return { ok: false, message: t('alreadySame') };
    }

    const taken = await prisma.employee.findUnique({
      where: { tenantId_personalEmail: { tenantId: employee.tenantId, personalEmail: newEmail } }
    });
    if (taken) {
      return { ok: false, message: t('taken') };
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
      return { ok: false, message: t('changeError') };
    }

    return { ok: true };
  });
}

export async function logout(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/acceso');
}
