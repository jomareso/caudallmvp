import { getTranslations } from 'next-intl/server';
import { requireAdm } from '@/lib/auth/admin-context';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { DiagnosticParametersForm } from './diagnostic-parameters-form';

// Parámetros del motor de diagnóstico (STOP ENGINE) y de las bandas de
// nivel — terreno del rol METHODOLOGIST, junto a /admin/metodologia/reglas
// y /contenido. Antes eran constantes en diagnostic.ts/scoring.ts.
export default async function AdminMetodologiaParametrosPage() {
  await requireAdm();

  const settings = await getPlatformSettings();
  const t = await getTranslations('admin.metodologia.parametros');

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-4xl (no max-w-sm): mismo criterio que Configuración. */}
      <div className="w-full max-w-4xl">
        <h1 className="text-lg font-medium text-quartz mb-1">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('description')}</p>

        <DiagnosticParametersForm
          initial={settings}
          labels={{
            stopSectionTitle: t('stopSectionTitle'),
            stopFloorLabel: t('stopFloorLabel'),
            stopFloorHelp: t('stopFloorHelp'),
            stopSoftMaxLabel: t('stopSoftMaxLabel'),
            stopSoftMaxHelp: t('stopSoftMaxHelp'),
            stopHardMaxLabel: t('stopHardMaxLabel'),
            stopHardMaxHelp: t('stopHardMaxHelp'),
            progressTargetLabel: t('progressTargetLabel'),
            progressTargetHelp: t('progressTargetHelp'),
            thresholdSectionTitle: t('thresholdSectionTitle'),
            highValueThresholdLabel: t('highValueThresholdLabel'),
            highValueThresholdHelp: t('highValueThresholdHelp'),
            highValueThresholdSoftLabel: t('highValueThresholdSoftLabel'),
            highValueThresholdSoftHelp: t('highValueThresholdSoftHelp'),
            tierSectionTitle: t('tierSectionTitle'),
            progressTierMidCutoffLabel: t('progressTierMidCutoffLabel'),
            progressTierMidCutoffHelp: t('progressTierMidCutoffHelp'),
            progressTierHighCutoffLabel: t('progressTierHighCutoffLabel'),
            progressTierHighCutoffHelp: t('progressTierHighCutoffHelp'),
            socialComparisonSectionTitle: t('socialComparisonSectionTitle'),
            socialComparisonEnabledLabel: t('socialComparisonEnabledLabel'),
            socialComparisonEnabledHelp: t('socialComparisonEnabledHelp'),
            socialComparisonMinNLabel: t('socialComparisonMinNLabel'),
            socialComparisonMinNHelp: t('socialComparisonMinNHelp'),
            socialComparisonMinNRRHHLabel: t('socialComparisonMinNRRHHLabel'),
            socialComparisonMinNRRHHHelp: t('socialComparisonMinNRRHHHelp'),
            socialComparisonSuperiorCutoffLabel: t('socialComparisonSuperiorCutoffLabel'),
            socialComparisonSuperiorCutoffHelp: t('socialComparisonSuperiorCutoffHelp'),
            socialComparisonInferiorCutoffLabel: t('socialComparisonInferiorCutoffLabel'),
            socialComparisonInferiorCutoffHelp: t('socialComparisonInferiorCutoffHelp'),
            saveCta: t('saveCta'),
            saving: t('saving'),
            saveSuccess: t('saveSuccess')
          }}
        />
      </div>
    </main>
  );
}
