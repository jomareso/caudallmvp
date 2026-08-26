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

async function requireAdm() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
  return admin;
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

const updateTenantSchema = z.object({
  tenantId: z.string().trim().min(1),
  name: z.string().trim().min(1)
});

export async function updateTenant(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdm();
  const t = await getTranslations('admin.empresas');

  const parsed = updateTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { tenantId, name } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return { ok: false, message: t('errorGeneric') };
  }
  if (tenant.name === name) {
    return { ok: true };
  }

  await prisma.tenant.update({ where: { id: tenantId }, data: { name } });

  await prisma.auditLog.create({
    data: {
      whoId: admin.id,
      whoData: { email: admin.email, profileType: admin.profileType },
      what: 'UPDATE_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      previousValue: { name: tenant.name },
      newValue: { name }
    }
  });

  revalidatePath('/admin/empresas');
  revalidatePath(`/admin/empresas/${tenantId}`);
  return { ok: true };
}

export async function setTenantSuspended(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdm();
  const t = await getTranslations('admin.empresas');

  const parsed = z.object({ tenantId: z.string().trim().min(1), suspended: z.boolean() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { tenantId, suspended } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return { ok: false, message: t('errorGeneric') };
  }

  // Nunca se borra un tenant (empleados, licencias y diagnósticos ya le
  // apuntan — Decisión 1 exige que el historial del empleado nunca se
  // pierda). Suspender es el equivalente a "eliminar": corta el acceso de
  // empleados y admins de esa empresa sin tocar ni un dato.
  const newStatus = suspended ? 'SUSPENDED' : 'ACTIVE';
  await prisma.tenant.update({ where: { id: tenantId }, data: { status: newStatus } });

  await prisma.auditLog.create({
    data: {
      whoId: admin.id,
      whoData: { email: admin.email, profileType: admin.profileType },
      what: suspended ? 'SUSPEND_TENANT' : 'REACTIVATE_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      previousValue: { status: tenant.status },
      newValue: { status: newStatus }
    }
  });

  revalidatePath('/admin/empresas');
  revalidatePath(`/admin/empresas/${tenantId}`);
  return { ok: true };
}
