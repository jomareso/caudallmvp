import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { LogoUploadForm } from './upload-form';

export default async function AdminConfiguracionPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  // Solo ADM (control total de la plataforma) administra el logo de
  // Caudall — EMPRESA y FUNCIONAL no tienen ese alcance.
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');

  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
  const hasLogo = Boolean(settings?.logoData);

  const t = await getTranslations('admin.settings');

  return (
    <main className="min-h-screen p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        <div className="bg-white border border-silver/60 rounded-xl p-6">
          <h2 className="text-sm font-medium text-quartz mb-1">{t('logoTitle')}</h2>
          <p className="text-xs text-nickel mb-4">{t('logoDescription')}</p>

          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
            <img src="/api/branding/logo" alt={t('logoCurrentAlt')} className="max-h-16 mb-4" />
          ) : (
            <p className="text-xs text-nickel mb-4">{t('logoNone')}</p>
          )}

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
