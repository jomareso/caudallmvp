import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { getActionSuggestion } from './actions';
import { ActionCard } from './action-card';

export default async function AccionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/');

  const result = await getActionSuggestion();
  const t = await getTranslations();
  const tAction = await getTranslations('diagnostic.action');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <p className="text-xs text-nickel mb-2 text-center">{tAction('eyebrow')}</p>

        {result.kind === 'suggestion' ? (
          <ActionCard
            employeeInterventionId={result.suggestion.employeeInterventionId}
            status={result.suggestion.status}
            title={t(result.suggestion.titleI18nKey)}
            description={t(result.suggestion.descriptionI18nKey)}
            actionText={result.suggestion.actionTextI18nKey ? t(result.suggestion.actionTextI18nKey) : ''}
            whyThisStep={result.suggestion.whyThisStepI18nKey ? t(result.suggestion.whyThisStepI18nKey) : null}
            videoUrl={result.suggestion.videoUrl}
            labels={{
              whyThisStep: tAction('whyThisStep'),
              commit: tAction('commit'),
              dismiss: tAction('dismiss'),
              committedNotice: tAction('committedNotice'),
              didYouDoIt: tAction('didYouDoIt'),
              achieved: tAction('achieved'),
              partial: tAction('partial'),
              notAchieved: tAction('notAchieved'),
              watchVideo: tAction('watchVideo')
            }}
          />
        ) : (
          <div className="bg-white border border-silver/60 rounded-xl p-6 text-center">
            <p className="text-sm text-nickel">{tAction(result.reason === 'HEALTHY' ? 'none' : 'pending')}</p>
          </div>
        )}
      </div>
    </main>
  );
}
