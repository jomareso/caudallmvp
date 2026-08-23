import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { getActionSuggestion } from './actions';
import { ActionCard } from './action-card';

export default async function AccionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const suggestion = await getActionSuggestion();
  const t = await getTranslations();
  const tAction = await getTranslations('diagnostic.action');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="text-xs text-nickel mb-2 text-center">{tAction('eyebrow')}</p>

        {suggestion ? (
          <ActionCard
            employeeInterventionId={suggestion.employeeInterventionId}
            status={suggestion.status}
            title={t(suggestion.titleI18nKey)}
            description={t(suggestion.descriptionI18nKey)}
            actionText={suggestion.actionTextI18nKey ? t(suggestion.actionTextI18nKey) : ''}
            whyThisStep={suggestion.whyThisStepI18nKey ? t(suggestion.whyThisStepI18nKey) : null}
            labels={{
              whyThisStep: tAction('whyThisStep'),
              commit: tAction('commit'),
              dismiss: tAction('dismiss'),
              committedNotice: tAction('committedNotice'),
              didYouDoIt: tAction('didYouDoIt'),
              achieved: tAction('achieved'),
              partial: tAction('partial'),
              notAchieved: tAction('notAchieved')
            }}
          />
        ) : (
          <div className="bg-white border border-silver/60 rounded-xl p-6 text-center">
            <p className="text-sm text-nickel">{tAction('none')}</p>
          </div>
        )}
      </div>
    </main>
  );
}
