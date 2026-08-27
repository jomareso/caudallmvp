import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { LogoUploadForm } from './upload-form';

export default async function AdminConfiguracionPage() {
  // Solo ADM (control total de la plataforma) administra el logo de
  // Caudall — EMPRESA y FUNCIONAL no tienen ese alcance.
  await requireAdm();

  // platform_settings es un singleton global sin tenantId, no lleva RLS.
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const hasLogo = Boolean(settings?.logoData);

  const t = await getTranslations('admin.settings');

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
      </div>
    </main>
  );
}
