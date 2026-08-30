import { prisma } from '@/lib/db/prisma';

// Parámetros globales de plataforma (auditoría de valores hardcodeados, 29
// ago) — antes eran `const` sueltas en distintos archivos de motor/UI,
// ahora viven en PlatformSettings y se editan desde /admin/configuracion
// sin necesitar un deploy. Un solo punto de lectura para todos: evita que
// cada caller reimplemente su propio fallback si la fila 'singleton'
// faltara.
export const PLATFORM_SETTINGS_DEFAULTS = {
  followupInviteAfterDays: 90,
  showInterventionVideos: false,
  licenseDurationsMonths: [3, 6, 12] as number[],
  minCohortSize: 30,
  minSampleSize: 20,
  magicLinkTtlMinutes: 15,
  sampleConfidenceLevel: 0.95,
  sampleMarginOfError: 0.05,
  // Motor de diagnóstico (STOP ENGINE) y bandas de nivel — ver
  // src/lib/engines/diagnostic.ts y src/lib/engines/scoring.ts.
  stopFloor: 8,
  stopSoftMax: 15,
  stopHardMax: 18,
  highValueThreshold: 0.9,
  highValueThresholdSoft: 0.97,
  progressTarget: 12,
  progressTierMidCutoff: 41,
  progressTierHighCutoff: 71,
  // Motor de Comparación Social — ver src/lib/engines/social-comparison.ts.
  // minN es el mínimo de la cohorte comparable para mostrar una comparación
  // al empleado (distinto de minCohortSize/minSampleSize, que gobiernan el
  // benchmark nacional retirado). minNRRHH es el umbral, más estricto, para
  // mostrar un segmento en el dashboard de RRHH (distinto de
  // Tenant.aggregationMinSegmentSize, que es por-tenant).
  socialComparisonEnabled: true,
  socialComparisonMinN: 50,
  socialComparisonMinNRRHH: 20,
  socialComparisonSuperiorCutoff: 60,
  socialComparisonInferiorCutoff: 40
};

export type PlatformSettingsValues = typeof PLATFORM_SETTINGS_DEFAULTS;

// platform_settings es un singleton global sin tenantId, no lleva RLS. La
// migración garantiza que la fila 'singleton' siempre existe, pero este
// fallback cubre igual cualquier entorno donde no haya corrido (ej. tests).
export async function getPlatformSettings(): Promise<PlatformSettingsValues> {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) return PLATFORM_SETTINGS_DEFAULTS;

  return {
    followupInviteAfterDays: settings.followupInviteAfterDays,
    showInterventionVideos: settings.showInterventionVideos,
    // Un admin no debería poder dejar la lista vacía (ver validación en
    // actions.ts), pero por si acaso: sin duraciones válidas no se podría
    // generar ninguna licencia nueva.
    licenseDurationsMonths:
      settings.licenseDurationsMonths.length > 0
        ? settings.licenseDurationsMonths
        : PLATFORM_SETTINGS_DEFAULTS.licenseDurationsMonths,
    minCohortSize: settings.minCohortSize,
    minSampleSize: settings.minSampleSize,
    magicLinkTtlMinutes: settings.magicLinkTtlMinutes,
    sampleConfidenceLevel: settings.sampleConfidenceLevel,
    sampleMarginOfError: settings.sampleMarginOfError,
    stopFloor: settings.stopFloor,
    stopSoftMax: settings.stopSoftMax,
    stopHardMax: settings.stopHardMax,
    highValueThreshold: settings.highValueThreshold,
    highValueThresholdSoft: settings.highValueThresholdSoft,
    progressTarget: settings.progressTarget,
    progressTierMidCutoff: settings.progressTierMidCutoff,
    progressTierHighCutoff: settings.progressTierHighCutoff,
    socialComparisonEnabled: settings.socialComparisonEnabled,
    socialComparisonMinN: settings.socialComparisonMinN,
    socialComparisonMinNRRHH: settings.socialComparisonMinNRRHH,
    socialComparisonSuperiorCutoff: settings.socialComparisonSuperiorCutoff,
    socialComparisonInferiorCutoff: settings.socialComparisonInferiorCutoff
  };
}
