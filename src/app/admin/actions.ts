'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { signOut } from '@/lib/auth/auth';
import { createMagicLinkToken } from '@/lib/auth/magic-link';
import { sendAdminMagicLinkEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';

const emailSchema = z.string().trim().toLowerCase().email('Ingresa un correo válido.');

export async function requestAdminMagicLink(
  rawEmail: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Ingresa un correo válido.' };
  }
  const email = parsed.data;

  // Sin autoregistro (a diferencia del empleado): un AdminUser solo existe
  // si alguien con acceso ya lo creó (ej. sembrado directo en el seed para
  // el primer ADM). No revelamos si el correo existe o no en la respuesta,
  // para no filtrar qué correos son admins.
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    return { ok: true };
  }

  const token = await createMagicLinkToken({ type: 'admin', adminUserId: admin.id, email: admin.email });
  const verifyUrl = `${getRequestOrigin()}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendAdminMagicLinkEmail({ to: admin.email, verifyUrl });
  } catch (error) {
    console.error('[requestAdminMagicLink] fallo al enviar correo', error);
    return { ok: false, message: 'No pudimos enviar el correo ahora mismo. Intenta de nuevo en un momento.' };
  }

  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  await signOut({ redirect: false });
  redirect('/admin');
}
