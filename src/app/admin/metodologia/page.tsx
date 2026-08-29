import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { SyncBancoMaestroButton } from './sync-banco-maestro-button';

export default async function AdminMetodologiaPage() {
  // Solo ADM administra el Banco Maestro — tocar constructos/variables/
  // preguntas afecta al motor de todos los tenants a la vez.
  await requireAdm();

  const t = await getTranslations('admin.metodologia');

  // methodology/questionBank/audit_logs son catálogo global sin tenantId,
  // no llevan RLS.

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

          <Link href="/admin/metodologia/contenido" className="block mt-4 text-xs text-yale underline">
            {t('viewContentLink')}
          </Link>
          <Link href="/admin/metodologia/reglas" className="block mt-1 text-xs text-yale underline">
            {t('viewRulesLink')}
          </Link>
          <Link href="/admin/metodologia/parametros" className="block mt-1 text-xs text-yale underline">
            {t('viewParametersLink')}
          </Link>
        </div>
      </div>
    </main>
  );
}
