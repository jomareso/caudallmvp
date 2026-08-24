import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { SyncBancoMaestroButton } from './sync-banco-maestro-button';

export default async function AdminMetodologiaPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  // Solo ADM administra el Banco Maestro — tocar constructos/variables/
  // preguntas afecta al motor de todos los tenants a la vez.
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');

  const t = await getTranslations('admin.metodologia');

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        <SyncBancoMaestroButton
          labels={{
            title: t('syncTitle'),
            description: t('syncDescription'),
            cta: t('syncCta'),
            syncing: t('syncing'),
            confirm: t('syncConfirm'),
            success: t('syncSuccess'),
            resultActive: t('syncResultActive'),
            resultDraft: t('syncResultDraft'),
            resultConstructs: t('syncResultConstructs'),
            resultVariables: t('syncResultVariables'),
            error: t('syncError')
          }}
        />
      </div>
    </main>
  );
}
