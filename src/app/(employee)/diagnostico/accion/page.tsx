import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { getActionSuggestion } from './actions';
import { ActionCard } from './action-card';
import { EmployeeTopBar } from '../../employee-topbar';
import { BackHomeLink } from '../../back-home-link';

export default async function AccionPage() {
  // getActionSuggestion() (en ./actions, un Server Action) ya resuelve su
  // propia sesión/contexto de RLS — no hace falta duplicarlo acá.
  const result = await getActionSuggestion();
  const { showInterventionVideos } = await getPlatformSettings();
  const t = await getTranslations();
  const tAction = await getTranslations('diagnostic.action');

  const commitmentData = result.kind === 'suggestion' ? result.suggestion.commitmentData : null;
  const committedWith = commitmentData
    ? tAction('committedWith', {
        trigger: tAction(`commitStep.triggers.${commitmentData.triggerCode}`),
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
          <p className="text-sm font-medium text-quartz mb-2 text-center">{tAction('eyebrow')}</p>

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
                triggers: {
                  PROXIMO_INGRESO: tAction('commitStep.triggers.PROXIMO_INGRESO'),
                  DIA_ESPECIFICO: tAction('commitStep.triggers.DIA_ESPECIFICO'),
                  DESPUES_GASTOS_FIJOS: tAction('commitStep.triggers.DESPUES_GASTOS_FIJOS'),
                  PRIMERA_HORA_DIA: tAction('commitStep.triggers.PRIMERA_HORA_DIA'),
                  FIN_DE_SEMANA: tAction('commitStep.triggers.FIN_DE_SEMANA')
                },
                didYouDoIt: tAction('didYouDoIt'),
                achieved: tAction('achieved'),
                partial: tAction('partial'),
                notAchieved: tAction('notAchieved'),
                outcomeReasonPrompt: tAction('outcomeReason.prompt'),
                outcomeReasonBack: tAction('outcomeReason.back'),
                outcomeReasons: {
                  NO_TIME: tAction('outcomeReason.reasons.NO_TIME'),
                  TOO_HARD: tAction('outcomeReason.reasons.TOO_HARD'),
                  CHANGED_MIND: tAction('outcomeReason.reasons.CHANGED_MIND')
                },
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
