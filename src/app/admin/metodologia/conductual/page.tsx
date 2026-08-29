import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { CreateTriggerForm } from './create-trigger-form';
import { TriggerRow } from './trigger-row';
import { CreateReasonForm } from './create-reason-form';
import { ReasonRow } from './reason-row';

// Opciones conductuales (disparadores de compromiso, motivos de no-logro)
// — terreno del rol METHODOLOGIST, junto a /admin/metodologia/reglas,
// /contenido y /parametros. Antes listas fijas en código
// (commitment-triggers.ts / outcome-reasons.ts).
export default async function AdminMetodologiaConductualPage() {
  await requireAdm();

  const [triggers, reasons] = await Promise.all([
    prisma.commitmentTriggerOption.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.outcomeReasonOption.findMany({ orderBy: { sortOrder: 'asc' } })
  ]);

  const t = await getTranslations('admin.metodologia.conductual');

  const sharedLabels = {
    codeLabel: t('codeLabel'),
    codeHelp: t('codeHelp'),
    labelLabel: t('labelLabel'),
    sortOrderLabel: t('sortOrderLabel'),
    createCta: t('createCta'),
    creating: t('creating'),
    createSuccess: t('createSuccess'),
    editCta: t('editCta'),
    saveCta: t('saveCta'),
    saving: t('saving'),
    cancelCta: t('cancelCta'),
    activateCta: t('activateCta'),
    deactivateCta: t('deactivateCta'),
    enabledBadge: t('enabledBadge'),
    disabledBadge: t('disabledBadge')
  };
  const triggerLabels = { ...sharedLabels, iconLabel: t('iconLabel') };

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-1">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('description')}</p>

        <h2 className="text-sm font-medium text-quartz mb-1">{t('triggersSectionTitle')}</h2>
        <p className="text-xs text-nickel mb-3">{t('triggersSectionDescription')}</p>
        <CreateTriggerForm labels={triggerLabels} />
        <h3 className="text-sm font-medium text-quartz mt-6 mb-2">{t('existingTitle')}</h3>
        <div className="space-y-2 mb-8">
          {triggers.map((trigger) => (
            <TriggerRow key={trigger.id} trigger={trigger} labels={triggerLabels} />
          ))}
        </div>

        <h2 className="text-sm font-medium text-quartz mb-1">{t('reasonsSectionTitle')}</h2>
        <p className="text-xs text-nickel mb-3">{t('reasonsSectionDescription')}</p>
        <CreateReasonForm labels={sharedLabels} />
        <h3 className="text-sm font-medium text-quartz mt-6 mb-2">{t('existingTitle')}</h3>
        <div className="space-y-2">
          {reasons.map((reason) => (
            <ReasonRow key={reason.id} reason={reason} labels={sharedLabels} />
          ))}
        </div>
      </div>
    </main>
  );
}
