import Link from 'next/link';
import type { Route } from 'next';
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

  const navCards: { href: Route; label: string; description: string }[] = [
    { href: '/admin/metodologia/contenido', label: t('viewContentLink'), description: t('viewContentDescription') },
    { href: '/admin/metodologia/reglas', label: t('viewRulesLink'), description: t('viewRulesDescription') },
    { href: '/admin/metodologia/parametros', label: t('viewParametersLink'), description: t('viewParametersDescription') },
    { href: '/admin/metodologia/conductual', label: t('viewBehavioralLink'), description: t('viewBehavioralDescription') }
  ];

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-5xl (no max-w-md): la tarjeta única de antes dejaba casi
          toda la pantalla en blanco en escritorio — el banco de preguntas
          y los 4 links a las demás sub-páginas ahora se reparten en dos
          bloques que sí usan el ancho real al lado del sidebar. */}
      <div className="w-full max-w-5xl">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        {/* Los 4 links de antes (una lista subrayada apretada dentro de la
            misma tarjeta) pasan a tarjetas de navegación reales, en grilla
            de 2 columnas — mismo tratamiento de "tarjeta clickeable" que
            el resto de /admin ya rediseñado, y usan el resto del ancho
            disponible en vez de una lista de una sola línea cada una. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {navCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="block bg-white border border-silver/60 rounded-xl p-5 hover:border-cola transition-colors"
            >
              <p className="text-sm font-medium text-yale mb-1">{card.label}</p>
              <p className="text-xs text-nickel">{card.description}</p>
            </Link>
          ))}
        </div>

        {/* max-w-2xl (no todo el ancho de la página): es texto + un botón,
            no una tabla — estirarlo a 5xl completo dejaría las líneas de
            texto incómodamente largas para leer. Debajo de las 4 tarjetas
            (Reynoso: se usa mucho menos seguido que navegar a las
            sub-páginas, no debería ser lo primero que se ve). */}
        <div className="max-w-2xl bg-white border border-silver/60 rounded-xl p-6">
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
        </div>
      </div>
    </main>
  );
}
