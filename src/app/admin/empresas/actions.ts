'use server';

import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { generateUniqueLicenseCodes, isLicenseDurationMonths } from '@/lib/licenses';
import { sendAdminWelcomeEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';

async function requireAdm(): Promise<void> {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
}

const createTenantSchema = z.object({
  name: z.string().trim().min(1),
  licenseCount: z.coerce.number().int().min(1).max(500),
  durationMonths: z.coerce.number().int(),
  adminEmails: z.string().optional()
});

export type AdminEmailOutcome = {
  email: string;
  status: 'created' | 'welcomeEmailFailed' | 'duplicate' | 'invalidFormat';
};

function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  const candidates = raw
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return Array.from(new Set(candidates));
}

export async function createTenant(
  input: unknown
): Promise<{ ok: true; tenantId: string; adminResults: AdminEmailOutcome[] } | { ok: false; message: string }> {
  await requireAdm();
  const t = await getTranslations('admin.empresas');

  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { name, licenseCount, durationMonths, adminEmails } = parsed.data;
  if (!isLicenseDurationMonths(durationMonths)) {
    return { ok: false, message: t('errorGeneric') };
  }

  const codes = generateUniqueLicenseCodes(licenseCount);
  const emailSchema = z.string().email();
  const candidateEmails = parseAdminEmails(adminEmails);

  const tenant = await prisma.tenant.create({
    data: {
      name,
      // Tenant.enrollmentCode ya no se usa para registrarse (eso ahora lo
      // hace cada License.code) — se conserva único solo porque el schema
      // todavía lo exige, no tiene otro propósito.
      enrollmentCode: `LEGACY-${randomUUID().slice(0, 8).toUpperCase()}`,
      licenses: {
        create: codes.map((code) => ({ code, durationMonths }))
      }
    }
  });

  // Un correo inválido o repetido no debe tumbar la creación de la empresa
  // ni de los demás admins — se reporta aparte para que Reynoso vea
  // exactamente qué pasó con cada uno.
  const adminResults: AdminEmailOutcome[] = [];
  const panelUrl = `${getRequestOrigin()}/admin`;

  for (const email of candidateEmails) {
    if (!emailSchema.safeParse(email).success) {
      adminResults.push({ email, status: 'invalidFormat' });
      continue;
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      adminResults.push({ email, status: 'duplicate' });
      continue;
    }

    await prisma.adminUser.create({
      data: { email, profileType: 'EMPRESA', tenantId: tenant.id }
    });

    try {
      await sendAdminWelcomeEmail({ to: email, tenantName: name, panelUrl });
      adminResults.push({ email, status: 'created' });
    } catch (error) {
      console.error('[createTenant] fallo al enviar correo de bienvenida', error);
      adminResults.push({ email, status: 'welcomeEmailFailed' });
    }
  }

  revalidatePath('/admin/empresas');
  return { ok: true, tenantId: tenant.id, adminResults };
}

const generateLicensesSchema = z.object({
  tenantId: z.string().trim().min(1),
  licenseCount: z.coerce.number().int().min(1).max(500),
  durationMonths: z.coerce.number().int()
});

export async function generateLicenses(
  input: unknown
): Promise<{ ok: true; codes: string[] } | { ok: false; message: string }> {
  await requireAdm();
  const t = await getTranslations('admin.empresas');

  const parsed = generateLicensesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { tenantId, licenseCount, durationMonths } = parsed.data;
  if (!isLicenseDurationMonths(durationMonths)) {
    return { ok: false, message: t('errorGeneric') };
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return { ok: false, message: t('errorGeneric') };
  }

  const codes = generateUniqueLicenseCodes(licenseCount);
  await prisma.license.createMany({
    data: codes.map((code) => ({ tenantId, code, durationMonths }))
  });

  revalidatePath(`/admin/empresas/${tenantId}`);
  return { ok: true, codes };
}
