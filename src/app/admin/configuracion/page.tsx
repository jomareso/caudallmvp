import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { LogoUploadForm } from './upload-form';
import { ParametersForm } from './parameters-form';

export default async function AdminConfiguracionPage() {
  // Solo ADM (control total de la plataforma) administra la configuración
  // de Caudall — EMPRESA y FUNCIONAL no tienen ese alcance.
  await requireAdm();

  // platform_settings es un singleton global sin tenantId, no lleva RLS.
  const [settings, parameters] = await Promise.all([
    prisma.platformSettings.findUnique({ where: { id: 'singleton' } }),
    getPlatformSettings()
  ]);
  const hasLogo = Boolean(settings?.logoData);

  const t = await getTranslations('admin.settings');
  const tParams = await getTranslations('admin.settings.parameters');

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        <h2 className="text-sm font-medium text-quartz mb-1">{t('logoTitle')}</h2>
        <p className="text-xs text-nickel mb-4">{t('logoDescription')}</p>

        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
          <img
            src="/api/branding/logo"
            alt={t('logoCurrentAlt')}
            className="max-h-24 mb-6 mix-blend-multiply"
          />
        ) : (
          <p className="text-xs text-nickel mb-6">{t('logoNone')}</p>
        )}

        <div className="bg-white border border-silver/60 rounded-xl p-6">
          <LogoUploadForm
            labels={{
              uploadLabel: t('uploadLabel'),
              uploadCta: t('uploadCta'),
              uploading: t('uploading'),
              uploadSuccess: t('uploadSuccess')
            }}
          />
        </div>

        <h2 className="text-sm font-medium text-quartz mt-8 mb-1">{tParams('title')}</h2>
        <p className="text-xs text-nickel mb-3">{tParams('description')}</p>

        <ParametersForm
          initial={parameters}
          labels={{
            followupInviteAfterDaysLabel: tParams('followupInviteAfterDaysLabel'),
            followupInviteAfterDaysHelp: tParams('followupInviteAfterDaysHelp'),
            licenseDurationsMonthsLabel: tParams('licenseDurationsMonthsLabel'),
            licenseDurationsMonthsHelp: tParams('licenseDurationsMonthsHelp'),
            minCohortSizeLabel: tParams('minCohortSizeLabel'),
            minCohortSizeHelp: tParams('minCohortSizeHelp'),
            minSampleSizeLabel: tParams('minSampleSizeLabel'),
            minSampleSizeHelp: tParams('minSampleSizeHelp'),
            magicLinkTtlMinutesLabel: tParams('magicLinkTtlMinutesLabel'),
            magicLinkTtlMinutesHelp: tParams('magicLinkTtlMinutesHelp'),
            showInterventionVideosLabel: tParams('showInterventionVideosLabel'),
            saveCta: tParams('saveCta'),
            saving: tParams('saving'),
            saveSuccess: tParams('saveSuccess')
          }}
        />
      </div>
    </main>
  );
}
