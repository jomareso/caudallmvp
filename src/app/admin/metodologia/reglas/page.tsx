import { getTranslations } from 'next-intl/server';
import { requireAdm } from '@/lib/auth/admin-context';
import { getBancoMaestroContent } from '@/lib/seed/banco-maestro-content';

const QA_SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-bad/10 text-bad',
  HIGH: 'bg-warn/10 text-warn',
  MEDIUM: 'bg-picton/10 text-yale'
};

export default async function AdminMetodologiaReglasPage() {
  await requireAdm();

  const t = await getTranslations('admin.metodologia.reglas');
  const content = getBancoMaestroContent();

  return (
    <main className="flex-1 p-6 lg:p-8">
      {/* max-w-5xl (no max-w-3xl): las tarjetas de cada sección van en
          grilla de 2 columnas en escritorio (ver más abajo) — con más
          ancho disponible al lado del sidebar. */}
      <div className="w-full max-w-5xl">
        <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
        <p className="text-xs text-nickel mb-6">{t('intro')}</p>

        <div className="space-y-4">
          <details className="bg-white border border-silver/60 rounded-xl p-4">
            <summary className="text-sm font-medium text-quartz cursor-pointer">
              {t('inferenceRulesTitle')} <span className="text-nickel font-normal">({content.inferenceRules.length})</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {content.inferenceRules.map((rule) => (
                <div key={rule.code} className="border border-silver/60 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-quartz font-medium">{rule.code}</span>
                    <span
                      className={
                        rule.type === 'STRONG' ? 'bg-ok/10 text-ok rounded px-1.5 py-0.5' : 'bg-silver/30 text-nickel rounded px-1.5 py-0.5'
                      }
                    >
                      {rule.type}
                    </span>
                    <span className="text-nickel">
                      {t('confidenceLabel')}: {rule.confidence}
                    </span>
                  </div>
                  <p className="text-nickel">
                    {t('ifLabel')} <span className="text-quartz">{rule.sourceConditionRaw}</span>
                  </p>
                  <p className="text-nickel">
                    {t('thenLabel')}{' '}
                    <span className="text-quartz">
                      {rule.targetVariableCode} = {rule.targetValue}
                    </span>
                  </p>
                  {rule.notes ? <p className="text-nickel mt-1">{rule.notes}</p> : null}
                </div>
              ))}
            </div>
          </details>

          <details className="bg-white border border-silver/60 rounded-xl p-4">
            <summary className="text-sm font-medium text-quartz cursor-pointer">
              {t('forbiddenTitle')} <span className="text-nickel font-normal">({content.forbiddenInferences.length})</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {content.forbiddenInferences.map((f, i) => (
                <div key={i} className="border border-silver/60 rounded-lg p-3 text-xs">
                  <p className="text-quartz">
                    {f.sourceVariableCode} = {f.sourceValue} <span className="text-bad font-medium">{t('doesNotImply')}</span>{' '}
                    {f.targetVariableCode} = {f.targetValue}
                  </p>
                  <p className="text-nickel mt-1">{f.reason}</p>
                </div>
              ))}
            </div>
          </details>

          <details className="bg-white border border-silver/60 rounded-xl p-4">
            <summary className="text-sm font-medium text-quartz cursor-pointer">
              {t('qaTitle')} <span className="text-nickel font-normal">({content.qaScenarios.length})</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {content.qaScenarios.map((qa) => (
                <div key={qa.code} className="border border-silver/60 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-quartz font-medium">{qa.code}</span>
                    <span className="text-quartz">{qa.scenario}</span>
                    <span className={`rounded px-1.5 py-0.5 ${QA_SEVERITY_STYLE[qa.severity] ?? 'bg-silver/30 text-nickel'}`}>
                      {qa.severity}
                    </span>
                  </div>
                  <p className="text-nickel">
                    {t('preconditionLabel')}: {qa.precondition}
                  </p>
                  <p className="text-nickel">
                    {t('expectedResultLabel')}: {qa.expectedResult}
                  </p>
                </div>
              ))}
            </div>
          </details>

          <details className="bg-white border border-silver/60 rounded-xl p-4">
            <summary className="text-sm font-medium text-quartz cursor-pointer">
              {t('techniquesTitle')} <span className="text-nickel font-normal">({content.behavioralTechniques.length})</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {content.behavioralTechniques.map((tech, i) => (
                <div key={i} className="border border-silver/60 rounded-lg p-3 text-xs">
                  <p className="text-quartz font-medium">
                    {tech.frictionCode} — {tech.technique}
                  </p>
                  <p className="text-nickel">
                    {t('useWhenLabel')}: {tech.useWhen}
                  </p>
                  <p className="text-nickel">
                    {t('avoidWhenLabel')}: {tech.avoidWhen}
                  </p>
                  <p className="text-nickel">
                    {t('copyTransformationLabel')}: {tech.copyTransformation}
                  </p>
                  {tech.example ? <p className="text-nickel italic mt-1">&ldquo;{tech.example}&rdquo;</p> : null}
                </div>
              ))}
            </div>
          </details>

          <details className="bg-white border border-silver/60 rounded-xl p-4">
            <summary className="text-sm font-medium text-quartz cursor-pointer">
              {t('biasMapTitle')} <span className="text-nickel font-normal">({content.behavioralBiasMap.length})</span>
            </summary>
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
              {content.behavioralBiasMap.map((bias, i) => (
                <div key={i} className="border border-silver/60 rounded-lg p-3 text-xs">
                  <p className="text-quartz font-medium">{bias.construct}</p>
                  <p className="text-nickel">
                    {t('whatItDetectsLabel')}: {bias.whatItDetects}
                  </p>
                  <p className="text-nickel">
                    {t('whenToAskLabel')}: {bias.whenToAsk}
                  </p>
                  <p className="text-nickel">
                    {t('whatNotToConcludeLabel')}: {bias.whatNotToConclude}
                  </p>
                  <p className="text-nickel">
                    {t('candidateInterventionLabel')}: {bias.candidateIntervention}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
