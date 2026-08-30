'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';

// Parámetros del motor de diagnóstico (STOP ENGINE, spec §24) y de las
// bandas de nivel (auditoría de valores hardcodeados, 29 ago) — ver
// src/lib/engines/diagnostic.ts y src/lib/engines/scoring.ts para dónde se
// usan en runtime.
const diagnosticParametersSchema = z.object({
  stopFloor: z.coerce.number().int().min(1).max(200),
  stopSoftMax: z.coerce.number().int().min(1).max(200),
  stopHardMax: z.coerce.number().int().min(1).max(200),
  highValueThreshold: z.coerce.number().min(0).max(1),
  highValueThresholdSoft: z.coerce.number().min(0).max(1),
  progressTarget: z.coerce.number().int().min(1).max(200),
  progressTierMidCutoff: z.coerce.number().int().min(0).max(100),
  progressTierHighCutoff: z.coerce.number().int().min(0).max(100),
  // Motor de Comparación Social — ver src/lib/engines/social-comparison.ts.
  socialComparisonEnabled: z.boolean(),
  socialComparisonMinN: z.coerce.number().int().min(1).max(10000),
  socialComparisonMinNRRHH: z.coerce.number().int().min(1).max(10000),
  socialComparisonSuperiorCutoff: z.coerce.number().int().min(0).max(100),
  socialComparisonInferiorCutoff: z.coerce.number().int().min(0).max(100)
});

export async function updateDiagnosticParameters(
  input: unknown
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.metodologia.parametros');

  const parsed = diagnosticParametersSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: t('errorGeneric') };
  }
  const data = parsed.data;

  // El STOP ENGINE asume este orden (spec §24: nunca menos del piso, nunca
  // más del tope duro) — invertirlo dejaría preguntas sin poder pararse
  // nunca, o parando antes de tiempo.
  if (!(data.stopFloor <= data.stopSoftMax && data.stopSoftMax <= data.stopHardMax)) {
    return { ok: false, message: t('errorStopOrder') };
  }
  if (data.highValueThreshold > data.highValueThresholdSoft) {
    return { ok: false, message: t('errorThresholdOrder') };
  }
  if (data.progressTierMidCutoff >= data.progressTierHighCutoff) {
    return { ok: false, message: t('errorTierOrder') };
  }
  if (data.socialComparisonInferiorCutoff >= data.socialComparisonSuperiorCutoff) {
    return { ok: false, message: t('errorSocialComparisonCutoffOrder') };
  }

  const previous = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });

  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: data,
    create: { id: 'singleton', ...data }
  });

  await prisma.auditLog.create({
    data: {
      whoId: actor.id,
      whoData: { email: actor.email, profileType: actor.profileType },
      what: 'UPDATE_DIAGNOSTIC_PARAMETERS',
      entityType: 'PlatformSettings',
      entityId: 'singleton',
      previousValue: previous
        ? {
            stopFloor: previous.stopFloor,
            stopSoftMax: previous.stopSoftMax,
            stopHardMax: previous.stopHardMax,
            highValueThreshold: previous.highValueThreshold,
            highValueThresholdSoft: previous.highValueThresholdSoft,
            progressTarget: previous.progressTarget,
            progressTierMidCutoff: previous.progressTierMidCutoff,
            progressTierHighCutoff: previous.progressTierHighCutoff,
            socialComparisonEnabled: previous.socialComparisonEnabled,
            socialComparisonMinN: previous.socialComparisonMinN,
            socialComparisonMinNRRHH: previous.socialComparisonMinNRRHH,
            socialComparisonSuperiorCutoff: previous.socialComparisonSuperiorCutoff,
            socialComparisonInferiorCutoff: previous.socialComparisonInferiorCutoff
          }
        : undefined,
      newValue: data
    }
  });

  revalidatePath('/diagnostico');
  revalidatePath('/diagnostico/resultado');
  revalidatePath('/admin/metodologia/parametros');
  return { ok: true };
}
