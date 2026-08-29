import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { getActionSuggestion } from './actions';
import { ActionCard } from './action-card';
import { EmployeeTopBar } from '../../employee-topbar';
import { BackHomeLink } from '../../back-home-link';
import { getEnabledCommitmentTriggers, getCommitmentTriggerLabel } from '@/lib/engines/commitment-triggers';
import { getEnabledOutcomeReasons } from '@/lib/engines/outcome-reasons';

export default async function AccionPage() {
  // getActionSuggestion() (en ./actions, un Server Action) ya resuelve su
  // propia sesión/contexto de RLS — no hace falta duplicarlo acá.
  const [result, { showInterventionVideos }, triggers, outcomeReasons] = await Promise.all([
    getActionSuggestion(),
    getPlatformSettings(),
    getEnabledCommitmentTriggers(),
    getEnabledOutcomeReasons()
  ]);
  const t = await getTranslations();
  const tAction = await getTranslations('diagnostic.action');

  const commitmentData = result.kind === 'suggestion' ? result.suggestion.commitmentData : null;
  // El label del trigger ya elegido se resuelve por separado de la lista de
  // triggers ACTIVOS de arriba — si esa opción se desactivó después de
  // comprometerse, igual debe poder mostrar con qué se comprometió (ver
  // getCommitmentTriggerLabel).
  const committedTriggerLabel = commitmentData ? await getCommitmentTriggerLabel(commitmentData.triggerCode) : null;
  const committedWith = commitmentData
    ? tAction('committedWith', {
        trigger: committedTriggerLabel ?? commitmentData.triggerCode,
        date: new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long' }).format(
          new Date(`${commitmentData.targetDate}T00:00:00`)
        )
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeTopBar />
      <main className="flex-1 flex flex-col items-center p-6 pt-10 lg:justify-center lg:pt-10">
        <div className="w-full max-w-sm lg:max-w-xl">
          <BackHomeLink />
          <p className="text-sm font-semibold text-yale mb-2 text-center">{tAction('eyebrow')}</p>

          {result.kind === 'suggestion' ? (
            <ActionCard
              employeeInterventionId={result.suggestion.employeeInterventionId}
              status={result.suggestion.status}
              dimensionCode={result.suggestion.dimensionCode}
              title={t(result.suggestion.titleI18nKey)}
              description={t(result.suggestion.descriptionI18nKey)}
              actionText={result.suggestion.actionTextI18nKey ? t(result.suggestion.actionTextI18nKey) : ''}
              whyThisStep={result.suggestion.whyThisStepI18nKey ? t(result.suggestion.whyThisStepI18nKey) : null}
              videoUrl={result.suggestion.videoUrl}
              showVideo={showInterventionVideos}
              committedWith={committedWith}
              triggers={triggers}
              outcomeReasons={outcomeReasons}
              labels={{
                whyThisStep: tAction('whyThisStep'),
                commit: tAction('commit'),
                dismiss: tAction('dismiss'),
                committedNotice: tAction('committedNotice'),
                commitStepIntro: tAction('commitStep.intro'),
                commitStepTriggerPrompt: tAction('commitStep.triggerPrompt'),
                commitStepDatePrompt: tAction('commitStep.datePrompt'),
                commitStepConfirm: tAction('commitStep.confirm'),
                commitStepCancel: tAction('commitStep.cancel'),
                didYouDoIt: tAction('didYouDoIt'),
                achieved: tAction('achieved'),
                partial: tAction('partial'),
                notAchieved: tAction('notAchieved'),
                outcomeReasonPrompt: tAction('outcomeReason.prompt'),
                outcomeReasonBack: tAction('outcomeReason.back'),
                watchVideo: tAction('watchVideo'),
                pushEnable: tAction('pushEnable'),
                pushEnabled: tAction('pushEnabled')
              }}
            />
          ) : (
            <div className="bg-white border border-silver/60 rounded-xl p-6 text-center">
              <p className="text-sm text-nickel mb-4">{tAction(result.reason === 'HEALTHY' ? 'none' : 'pending')}</p>
              <Link
                href="/diagnostico/resultado"
                className="inline-block bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
              >
                {tAction('backToResult')}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
