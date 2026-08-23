'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { createMagicLinkToken } from '@/lib/auth/magic-link';
import { sendMagicLinkEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; message: string };

export async function validateEnrollmentCode(rawCode: string): Promise<ActionResult<{ tenantName: string }>> {
  const code = rawCode.trim().toUpperCase();

  if (!code) {
    return { ok: false, message: 'Ingresa el código de tu empresa.' };
  }

  const tenant = await prisma.tenant.findUnique({ where: { enrollmentCode: code } });

  if (!tenant || tenant.status === 'SUSPENDED') {
    return { ok: false, message: 'No encontramos una empresa con ese código. Verifícalo con tu equipo de RRHH.' };
  }

  return { ok: true, tenantName: tenant.name };
}

const requestLinkSchema = z.object({
  enrollmentCode: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido.')
});

export async function requestMagicLink(input: { enrollmentCode: string; email: string }): Promise<ActionResult> {
  const parsed = requestLinkSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.' };
  }

  const enrollmentCode = parsed.data.enrollmentCode.toUpperCase();
  const email = parsed.data.email;

  const tenant = await prisma.tenant.findUnique({ where: { enrollmentCode } });

  if (!tenant || tenant.status === 'SUSPENDED') {
    return { ok: false, message: 'No encontramos una empresa con ese código. Verifícalo con tu equipo de RRHH.' };
  }

  // Decisión 6 (docs/decisions.md): el correo debe ser personal, no corporativo.
  if (tenant.corporateEmailDomain) {
    const domain = email.split('@')[1];
    if (domain === tenant.corporateEmailDomain.toLowerCase()) {
      return {
        ok: false,
        message: 'Usa tu correo personal, no el de la empresa. Esta cuenta es solo tuya.'
      };
    }
  }

  const employee = await prisma.employee.upsert({
    where: { tenantId_personalEmail: { tenantId: tenant.id, personalEmail: email } },
    update: {},
    create: {
      tenantId: tenant.id,
      personalEmail: email,
      enrollmentCodeUsed: tenant.enrollmentCode,
      authMethod: 'MAGIC_LINK'
    }
  });

  const token = await createMagicLinkToken({
    type: 'employee',
    tenantId: tenant.id,
    employeeId: employee.id,
    email
  });

  const verifyUrl = `${getRequestOrigin()}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendMagicLinkEmail({ to: email, verifyUrl, tenantName: tenant.name });
  } catch (error) {
    console.error('[requestMagicLink] fallo al enviar correo', error);
    return { ok: false, message: 'No pudimos enviar el correo ahora mismo. Intenta de nuevo en un momento.' };
  }

  return { ok: true };
}
