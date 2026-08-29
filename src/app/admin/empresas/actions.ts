'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { revalidatePath } from 'next/cache';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { generateUniqueLicenseCodes, isLicenseDurationMonths } from '@/lib/licenses';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { sendAdminWelcomeEmail } from '@/lib/email/send-magic-link';
import { getRequestOrigin } from '@/lib/http/request-origin';

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
  const settings = await getPlatformSettings();
  if (!isLicenseDurationMonths(durationMonths, settings.licenseDurationsMonths)) {
    return { ok: false, message: t('errorGeneric') };
  }

  const codes = generateUniqueLicenseCodes(licenseCount);
  const emailSchema = z.string().email();
  const candidateEmails = parseAdminEmails(adminEmails);

  // ADM crea tenants y sus admins/licencias iniciales sin pertenecer todavía
  // a ninguno de ellos — de ahí platform-admin para toda esta acción.
  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
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
  });
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
  const settings = await getPlatformSettings();
  if (!isLicenseDurationMonths(durationMonths, settings.licenseDurationsMonths)) {
    return { ok: false, message: t('errorGeneric') };
  }

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
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
  });
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

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
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
  });
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const updateTenantBrandingSchema = z.object({
  tenantId: z.string().trim().min(1),
  primaryColor: z.string().trim().regex(HEX_COLOR_PATTERN),
  // Vacío = "sin logo propio" (solo caudall en el header) — no todo tenant
  // tiene uno todavía. Netlify no tiene storage persistente de archivos
  // (mismo motivo que PlatformSettings.logoData para el logo de Caudall),
  // pero acá no hace falta: logoUrl es simplemente la URL pública que ya
  // aloja la propia empresa (su sitio, su CDN), no un archivo que Caudall
  // suba y guarde.
  logoUrl: z.union([z.string().trim().url(), z.literal('')])
});

// ADR-003: co-branding pleno — logo + color primario configurables por
// tenant. Separado de updateTenant (nombre) porque son formularios
// distintos en la UI, mismo patrón que GenerateLicensesForm/
// SuspendTenantButton siendo piezas propias.
export async function updateTenantBranding(input: unknown): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireAdm();
  const t = await getTranslations('admin.empresas');

  const parsed = updateTenantBrandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const { tenantId, primaryColor } = parsed.data;
  const logoUrl = parsed.data.logoUrl === '' ? null : parsed.data.logoUrl;

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return { ok: false, message: t('errorGeneric') };
    }
    if (tenant.primaryColor === primaryColor && tenant.logoUrl === logoUrl) {
      return { ok: true };
    }

    await prisma.tenant.update({ where: { id: tenantId }, data: { primaryColor, logoUrl } });

    await prisma.auditLog.create({
      data: {
        whoId: admin.id,
        whoData: { email: admin.email, profileType: admin.profileType },
        what: 'UPDATE_TENANT_BRANDING',
        entityType: 'Tenant',
        entityId: tenantId,
        previousValue: { primaryColor: tenant.primaryColor, logoUrl: tenant.logoUrl },
        newValue: { primaryColor, logoUrl }
      }
    });

    revalidatePath(`/admin/empresas/${tenantId}`);
    return { ok: true };
  });
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

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
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
  });
}
