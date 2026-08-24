import Link from 'next/link';
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

  const [methodology, questionBank, lastSync] = await Promise.all([
    prisma.methodology.findFirst({ where: { status: 'ACTIVE' } }),
    prisma.questionBank.findFirst({ where: { status: 'ACTIVE' } }),
    prisma.auditLog.findFirst({
      where: { what: 'SYNC_BANCO_MAESTRO' },
      orderBy: { when: 'desc' }
    })
  ]);

  const lastSyncWho = lastSync?.whoData as { email?: string } | null;
  const lastSyncWhen = lastSync
    ? new Intl.DateTimeFormat('es-DO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Santo_Domingo'
      }).format(lastSync.when)
    : null;

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        <div className="bg-white border border-silver/60 rounded-xl p-6">
          <p className="text-xs text-nickel mb-1">
            {t('currentVersion')}: <span className="text-quartz font-medium">{methodology?.version ?? '—'}</span>
            {questionBank ? ` (${questionBank.version})` : ''}
          </p>
          {lastSync && lastSyncWho?.email ? (
            <p className="text-xs text-nickel">
              {t('lastSync')}: {lastSyncWho.email} · {lastSyncWhen}
            </p>
          ) : (
            <p className="text-xs text-nickel">{t('lastSyncNone')}</p>
          )}

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

          <Link href="/admin/metodologia/contenido" className="inline-block mt-4 text-xs text-yale underline">
            {t('viewContentLink')}
          </Link>
        </div>
      </div>
    </main>
  );
}
