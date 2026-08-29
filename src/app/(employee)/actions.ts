'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { createMagicLinkToken } from '@/lib/auth/magic-link';
import { sendMagicLinkEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';
import { addMonths, findTenantByCode } from '@/lib/licenses';

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; message: string };

// Autoregistro (Decisión 6): antes de este punto no hay sesión ni tenant
// conocido — el código de licencia/enrollment ES lo que determina el
// tenant. Como el WHERE siempre filtra por un código único (no hay forma
// de enumerar otros tenants desde acá), estas dos funciones corren bajo
// contexto platform-admin — mismo patrón que el lookup por email del
// login de admin (ver src/app/admin/actions.ts).
export async function validateEnrollmentCode(rawCode: string): Promise<ActionResult<{ tenantName: string }>> {
  const code = rawCode.trim().toUpperCase();
  const t = await getTranslations('employee.access.errors');

  if (!code) {
    return { ok: false, message: t('emptyCode') };
  }

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const found = await findTenantByCode(code);

    if (!found || found.tenant.status === 'SUSPENDED') {
      return { ok: false, message: t('invalidCode') };
    }

    if (found.license && found.license.status === 'EXPIRED') {
      return { ok: false, message: t('licenseExpired') };
    }

    if (found.license?.status === 'ACTIVE' && found.license.expiresAt && found.license.expiresAt < new Date()) {
      return { ok: false, message: t('licenseExpired') };
    }

    return { ok: true, tenantName: found.tenant.name };
  });
}

export async function requestMagicLink(
  input: { enrollmentCode: string; email: string }
): Promise<ActionResult<{ isExisting: boolean }>> {
  const [t, tCommon] = await Promise.all([
    getTranslations('employee.access.errors'),
    getTranslations('common.errors')
  ]);
  const requestLinkSchema = z.object({
    enrollmentCode: z.string().trim().min(1),
    email: z.string().trim().toLowerCase().email(tCommon('invalidEmail'))
  });
  const parsed = requestLinkSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? t('invalidInput') };
  }

  const enrollmentCode = parsed.data.enrollmentCode.toUpperCase();
  const email = parsed.data.email;

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const found = await findTenantByCode(enrollmentCode);

    if (!found || found.tenant.status === 'SUSPENDED') {
      return { ok: false, message: t('invalidCode') };
    }
    const { tenant, license } = found;

    if (license?.status === 'EXPIRED' || (license?.expiresAt && license.expiresAt < new Date())) {
      return { ok: false, message: t('licenseExpired') };
    }

    // Decisión 6 (docs/decisions.md): el correo debe ser personal, no corporativo.
    if (tenant.corporateEmailDomain) {
      const domain = email.split('@')[1];
      if (domain === tenant.corporateEmailDomain.toLowerCase()) {
        return {
          ok: false,
          message: t('useCorporateEmail')
        };
      }
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { tenantId_personalEmail: { tenantId: tenant.id, personalEmail: email } }
    });

    // Una licencia ACTIVE ya le pertenece a un empleado — si alguien más
    // intenta usar ese código con otro correo, no le presta el cupo.
    if (license?.status === 'ACTIVE' && existingEmployee?.licenseId !== license.id) {
      return { ok: false, message: t('codeAlreadyAssigned') };
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
      return { ok: false, message: tCommon('emailSendFailed') };
    }

    // No bloquear a alguien que ya tiene cuenta con un error — se le manda
    // el mismo link de siempre (arriba), y la pantalla de "revisa tu
    // correo" solo cambia el copy para que sepa que es un login, no un
    // registro nuevo (ver enviado/page.tsx).
    return { ok: true, isExisting: existingEmployee !== null };
  });
}
