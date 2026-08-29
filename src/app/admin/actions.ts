'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { signOut } from '@/lib/auth/auth';
import { createMagicLinkToken } from '@/lib/auth/magic-link';
import { sendAdminMagicLinkEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';

export async function requestAdminMagicLink(
  rawEmail: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [t, tCommon] = await Promise.all([getTranslations('admin.login'), getTranslations('common.errors')]);
  const emailSchema = z.string().trim().toLowerCase().email(t('errorInvalidEmail'));
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? t('errorInvalidEmail') };
  }
  const email = parsed.data;

  // Sin autoregistro (a diferencia del empleado): un AdminUser solo existe
  // si alguien con acceso ya lo creó (ej. sembrado directo en el seed para
  // el primer ADM). No revelamos si el correo existe o no en la respuesta,
  // para no filtrar qué correos son admins.
  //
  // Este lookup pasa por email, ANTES de que exista cualquier sesión — no
  // hay id de session-subject todavía, así que no aplica ese contexto. Es
  // una operación de infraestructura de auth (no expone datos de tenant
  // al llamador: solo decide si se envía o no un correo, y la respuesta
  // es siempre {ok:true} para no filtrar nada), así que corre bajo
  // contexto platform-admin.
  const admin = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    prisma.adminUser.findUnique({ where: { email } })
  );
  // Un admin desactivado no debe poder pedir un link nuevo — mismo trato
  // silencioso que un correo que no existe, para no filtrar cuáles son
  // admins ni cuáles están desactivados.
  if (!admin || !admin.active) {
    return { ok: true };
  }

  const token = await createMagicLinkToken({ type: 'admin', adminUserId: admin.id, email: admin.email });
  const verifyUrl = `${getRequestOrigin()}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendAdminMagicLinkEmail({ to: admin.email, verifyUrl });
  } catch (error) {
    console.error('[requestAdminMagicLink] fallo al enviar correo', error);
    return { ok: false, message: tCommon('emailSendFailed') };
  }

  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/admin');
}
