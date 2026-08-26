'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { createMagicLinkToken } from '@/lib/auth/magic-link';
import { sendMagicLinkEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';
import { addMonths, findTenantByCode } from '@/lib/licenses';

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; message: string };

export async function validateEnrollmentCode(rawCode: string): Promise<ActionResult<{ tenantName: string }>> {
  const code = rawCode.trim().toUpperCase();

  if (!code) {
    return { ok: false, message: 'Ingresa tu código de acceso.' };
  }

  const found = await findTenantByCode(code);

  if (!found || found.tenant.status === 'SUSPENDED') {
    return { ok: false, message: 'No encontramos ese código. Verifícalo con tu equipo de RRHH.' };
  }

  if (found.license && found.license.status === 'EXPIRED') {
    return { ok: false, message: 'Esta licencia ya venció. Pide un código nuevo a tu equipo de RRHH.' };
  }

  if (found.license?.status === 'ACTIVE' && found.license.expiresAt && found.license.expiresAt < new Date()) {
    return { ok: false, message: 'Esta licencia ya venció. Pide un código nuevo a tu equipo de RRHH.' };
  }

  return { ok: true, tenantName: found.tenant.name };
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

  const found = await findTenantByCode(enrollmentCode);

  if (!found || found.tenant.status === 'SUSPENDED') {
    return { ok: false, message: 'No encontramos ese código. Verifícalo con tu equipo de RRHH.' };
  }
  const { tenant, license } = found;

  if (license?.status === 'EXPIRED' || (license?.expiresAt && license.expiresAt < new Date())) {
    return { ok: false, message: 'Esta licencia ya venció. Pide un código nuevo a tu equipo de RRHH.' };
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

  const existingEmployee = await prisma.employee.findUnique({
    where: { tenantId_personalEmail: { tenantId: tenant.id, personalEmail: email } }
  });

  // Una licencia ACTIVE ya le pertenece a un empleado — si alguien más
  // intenta usar ese código con otro correo, no le presta el cupo.
  if (license?.status === 'ACTIVE' && existingEmployee?.licenseId !== license.id) {
    return { ok: false, message: 'Este código ya está asignado a otra persona.' };
  }

  const employee =
    existingEmployee ??
    (await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        personalEmail: email,
        enrollmentCodeUsed: enrollmentCode,
        licenseId: license?.id,
        authMethod: 'MAGIC_LINK'
      }
    }));

  if (license && license.status === 'UNUSED') {
    const activatedAt = new Date();
    await prisma.license.update({
      where: { id: license.id },
      data: { status: 'ACTIVE', activatedAt, expiresAt: addMonths(activatedAt, license.durationMonths) }
    });
  }

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
