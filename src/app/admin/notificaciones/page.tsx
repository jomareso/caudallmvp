import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { SendTestForm } from './send-test-form';
import { CreateRuleForm } from './create-rule-form';
import { RuleRow } from './rule-row';

const TEMPLATE_LABEL_KEY: Record<string, string> = {
  COMMITMENT: 'templateTypeCommitment',
  INCOMPLETE: 'templateTypeIncomplete',
  RESULT_UPDATED: 'templateTypeResultUpdated',
  NEW_STEP: 'templateTypeNewStep',
  LICENSE_EXPIRING: 'templateTypeLicenseExpiring'
};

// Herramienta de verificación de la infraestructura de push (Decisión 9),
// no una función de producto — ver comentario en ./actions.ts. Las reglas
// de notificación (abajo) sí son producto: definen QUÉ se envía y CUÁNDO.
export default async function AdminNotificacionesPage() {
  await requireAdm();

  // Configuración global de plataforma, no de un tenant — igual que el
  // banco de preguntas o el catálogo de intervenciones.
  const rules = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    prisma.notificationRule.findMany({ orderBy: [{ templateType: 'asc' }, { createdAt: 'asc' }] })
  );

  const t = await getTranslations('admin.notifications');
  const tRules = await getTranslations('admin.notifications.rules');

  const ruleLabels = {
    templateTypeLabel: tRules('templateTypeLabel'),
    templateTypeCommitment: tRules('templateTypeCommitment'),
    templateTypeIncomplete: tRules('templateTypeIncomplete'),
    templateTypeResultUpdated: tRules('templateTypeResultUpdated'),
    templateTypeNewStep: tRules('templateTypeNewStep'),
    templateTypeLicenseExpiring: tRules('templateTypeLicenseExpiring'),
    titleLabel: tRules('titleLabel'),
    bodyLabel: tRules('bodyLabel'),
    daysLabel: tRules('daysLabel'),
    daysHelpIncomplete: tRules('daysHelpIncomplete'),
    daysHelpLicenseExpiring: tRules('daysHelpLicenseExpiring'),
    createCta: tRules('createCta'),
    creating: tRules('creating'),
    createSuccess: tRules('createSuccess'),
    editCta: tRules('editCta'),
    saveCta: tRules('saveCta'),
    saving: tRules('saving'),
    cancelCta: tRules('cancelCta'),
    deleteCta: tRules('deleteCta'),
    deleteConfirm: tRules('deleteConfirm'),
    activateCta: tRules('activateCta'),
    deactivateCta: tRules('deactivateCta'),
    enabledBadge: tRules('enabledBadge'),
    disabledBadge: tRules('disabledBadge')
  };

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-4xl (no max-w-sm): mismo criterio que el resto de /admin ya
          migrado. */}
      <div className="w-full max-w-4xl">
        <h1 className="text-lg font-medium text-quartz mb-1">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('description')}</p>

        {/* max-w-md: es una herramienta de verificación (ver comentario
            arriba), no producto — 3 campos, no se beneficia de más
            ancho. */}
        <div className="max-w-md bg-white border border-silver/60 rounded-xl p-6 mb-8">
          <SendTestForm
            labels={{
              emailLabel: t('emailLabel'),
              titleLabel: t('titleLabel'),
              bodyLabel: t('bodyLabel'),
              send: t('send'),
              sending: t('sending'),
              success: t('success')
            }}
          />
        </div>

        <h2 className="text-sm font-medium text-quartz mb-1">{tRules('sectionTitle')}</h2>
        <p className="text-xs text-nickel mb-3">{tRules('sectionDescription')}</p>

        <div className="max-w-2xl mb-6">
          <CreateRuleForm labels={ruleLabels} />
        </div>

        <h3 className="text-sm font-medium text-quartz mb-2">{tRules('existingTitle')}</h3>
        {rules.length === 0 ? (
          <p className="text-xs text-nickel">{tRules('emptyState')}</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={{
                  id: rule.id,
                  templateType: rule.templateType,
                  templateLabel: tRules(TEMPLATE_LABEL_KEY[rule.templateType]),
                  title: rule.title,
                  body: rule.body,
                  days: rule.days,
                  enabled: rule.enabled
                }}
                labels={ruleLabels}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
