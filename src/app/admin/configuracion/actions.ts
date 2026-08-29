'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export async function uploadLogo(formData: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdm();
  const t = await getTranslations('admin.settings');

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: t('uploadErrorType') };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: t('uploadErrorType') };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, message: t('uploadErrorSize') };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // platform_settings es un singleton global sin tenantId, no lleva RLS.
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: { logoData: bytes, logoMimeType: file.type },
    create: { id: 'singleton', logoData: bytes, logoMimeType: file.type }
  });

  revalidatePath('/');
  revalidatePath('/admin/configuracion');
  return { ok: true };
}

// Parámetros globales de plataforma (auditoría de valores hardcodeados, 29
// ago) — ver src/lib/settings/platform-settings.ts para dónde se leen.
const platformParametersSchema = z.object({
  followupInviteAfterDays: z.coerce.number().int().min(1).max(3650),
  showInterventionVideos: z.boolean(),
  // Texto separado por comas (ej. "3, 6, 12") en vez de una lista de
  // checkboxes fija — así el admin puede agregar una duración nueva (ej.
  // 1 o 24 meses) sin que el código tenga que anticipar cuáles.
  licenseDurationsMonths: z.string().trim().min(1),
  minCohortSize: z.coerce.number().int().min(1).max(10000),
  minSampleSize: z.coerce.number().int().min(1).max(10000),
  magicLinkTtlMinutes: z.coerce.number().int().min(1).max(1440)
});

function parseLicenseDurations(raw: string): number[] | null {
  const values = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number(s));

  if (values.some((n) => !Number.isInteger(n) || n < 1 || n > 120)) return null;

  const unique = Array.from(new Set(values)).sort((a, b) => a - b);
  return unique.length > 0 ? unique : null;
}

export async function updatePlatformParameters(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.settings.parameters');

  const parsed = platformParametersSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }

  const licenseDurationsMonths = parseLicenseDurations(parsed.data.licenseDurationsMonths);
  if (!licenseDurationsMonths) {
    return { ok: false, message: t('errorDurationsInvalid') };
  }

  const { followupInviteAfterDays, showInterventionVideos, minCohortSize, minSampleSize, magicLinkTtlMinutes } =
    parsed.data;

  const previous = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });

  const newValue = {
    followupInviteAfterDays,
    showInterventionVideos,
    licenseDurationsMonths,
    minCohortSize,
    minSampleSize,
    magicLinkTtlMinutes
  };

  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: newValue,
    create: { id: 'singleton', ...newValue }
  });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'UPDATE_PLATFORM_PARAMETERS',
      entityType: 'PlatformSettings',
      entityId: 'singleton',
      previousValue: previous
        ? {
            followupInviteAfterDays: previous.followupInviteAfterDays,
            showInterventionVideos: previous.showInterventionVideos,
            licenseDurationsMonths: previous.licenseDurationsMonths,
            minCohortSize: previous.minCohortSize,
            minSampleSize: previous.minSampleSize,
            magicLinkTtlMinutes: previous.magicLinkTtlMinutes
          }
        : undefined,
      newValue
    }
  });

  revalidatePath('/admin/configuracion');
  return { ok: true };
}
