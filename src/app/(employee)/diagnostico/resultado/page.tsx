import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireEmployee, employeeTenantContext } from '@/lib/auth/employee-context';
import { scoreToDimensionState, scoreToProgressTier } from '@/lib/engines/scoring';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { countContextAnsweredAndTotal } from '@/lib/engines/diagnostic';
import { buildPostDiagnosticMessagePlan } from '@/lib/engines/post-diagnostic-message';
import { recordSocialComparisonSnapshot } from '@/lib/engines/social-comparison';
import { sendDiagnosticResultEmail } from '@/lib/email/send-diagnostic-result';
import { EmployeeTopBar } from '../../employee-topbar';
import { BackHomeLink } from '../../back-home-link';
import { ScoreGauge } from './score-gauge';
import { SocialComparisonCard } from './social-comparison-card';

export default async function ResultadoPage() {
  const employee = await requireEmployee();
  const employeeId = employee.id;

  return runWithTenantContext(employeeTenantContext(employee), async () => {
    const [financialState, settings] = await Promise.all([
      prisma.financialState.findUnique({ where: { employeeId } }),
      getPlatformSettings()
    ]);
    if (!financialState) {
      // Diagnóstico incompleto: manda de vuelta a responder.
      redirect('/diagnostico');
    }

    const methodology = await prisma.methodology.findFirst({
      where: { status: 'ACTIVE' },
      include: { dimensions: { orderBy: { code: 'asc' } } }
    });
    const dimensionScores = await prisma.dimensionScore.findMany({
      where: { employeeId }
    });
    const scoreByDimensionId = new Map(dimensionScores.map((ds) => [ds.dimensionId, ds]));

    const { answered: ctxAnswered, total: ctxTotal } = await countContextAnsweredAndTotal(employeeId);
    const showContextBanner = ctxTotal > 0 && ctxAnswered < ctxTotal;

    const messagePlan = await buildPostDiagnosticMessagePlan(employeeId);

    // Motor de Comparación Social + notificación por correo (spec 30
    // secciones, confirmado con Reynoso — reemplaza al benchmark nacional
    // gateado por CTX-07, retirado del banco activo). El snapshot de
    // auditoría (N, nivel, posición) se escribe una sola vez por
    // (employeeId, completedAt) — eso sí debe ser idempotente. El envío del
    // correo es una condición APARTE (emailSentAt), no "¿ya existe el
    // snapshot?": antes ambas cosas compartían el mismo dedup, así que un
    // primer intento de correo fallido (ej. Resend caído o mal configurado)
    // dejaba el snapshot creado con emailSentAt=null para siempre — ninguna
    // visita futura lo volvía a intentar. Ahora se reintenta en cada visita
    // mientras emailSentAt siga vacío. Todo el bloque va en try/catch — un
    // fallo acá nunca debe romper el render del resultado.
    if (financialState.lastDiagnosticCompletedAt) {
      const completedAt = financialState.lastDiagnosticCompletedAt;
      try {
        let snapshot = await prisma.socialComparisonSnapshot.findUnique({
          where: { employeeId_completedAt: { employeeId, completedAt } }
        });
        if (!snapshot) {
          await recordSocialComparisonSnapshot(employeeId, completedAt, messagePlan.comparison);
          snapshot = await prisma.socialComparisonSnapshot.findUnique({
            where: { employeeId_completedAt: { employeeId, completedAt } }
          });
        }
        if (snapshot && !snapshot.emailSentAt) {
          try {
            await sendDiagnosticResultEmail({ to: employee.personalEmail, employeeId, plan: messagePlan });
            await prisma.socialComparisonSnapshot.update({
              where: { employeeId_completedAt: { employeeId, completedAt } },
              data: { emailSentAt: new Date() }
            });
          } catch (emailError) {
            console.error('sendDiagnosticResultEmail falló', emailError);
          }
        }
      } catch (snapshotError) {
        console.error('recordSocialComparisonSnapshot falló', snapshotError);
      }
    }

    const t = await getTranslations('diagnostic.result');
    const tDim = await getTranslations('diagnostic.dimensions');
    const tLevel = await getTranslations('diagnostic.result.levels');
    const tInterpretation = await getTranslations('diagnostic.result.interpretation');
    const tSocial = await getTranslations('diagnostic.result.socialComparison');

    const cfhiRounded = Math.round(financialState.cfhiScore);
    const cfhiBand = scoreToDimensionState(cfhiRounded);
    const cfhiLevel = scoreToProgressTier(cfhiRounded, {
      mid: settings.progressTierMidCutoff,
      high: settings.progressTierHighCutoff
    });

    // Percentil/posición del Motor de Comparación Social, mostrado junto al
    // índice (no dentro del ScoreGauge: el gauge es del CFHI general, esto
    // compara la dimensión prioritaria — mezclarlos en el mismo número
    // sería engañoso). Nunca se muestra en INFERIOR
    // (comparison.includeNumericComparison ya resuelve esa regla en el
    // motor — ver social-comparison.ts) ni sin datos suficientes.
    const { comparison } = messagePlan;
    const comparisonBadge =
      comparison.shown && comparison.includeNumericComparison && comparison.priorityDimension
        ? {
            text: tSocial(comparison.position === 'SUPERIOR' ? 'statSuperior' : 'statSimilar', {
              dimension: tDim(comparison.priorityDimension),
              percentile: comparison.percentile
            }),
            className:
              comparison.position === 'SUPERIOR' ? 'bg-ok/10 text-ok' : 'bg-picton/10 text-yale'
          }
        : null;

    const CFHI_BAND_CLASS: Record<string, string> = {
      CRITICAL: 'bg-bad/10 text-bad',
      UNMET: 'bg-warn/10 text-warn',
      PARTIAL: 'bg-warn/10 text-warn',
      MET: 'bg-ok/10 text-ok'
    };

    return (
      <div className="min-h-screen flex flex-col">
        <EmployeeTopBar />
        <main className="flex-1 flex flex-col items-center p-6 pt-10">
        <div className="w-full max-w-sm lg:max-w-2xl text-center">
          <div className="lg:max-w-md lg:mx-auto text-left">
            <BackHomeLink />
          </div>
          <div className="lg:max-w-md lg:mx-auto">
            <p className="text-sm font-semibold text-yale mb-2">{t('title')}</p>
            <ScoreGauge score={cfhiRounded} vsAverage={null} outOfLabel={t('outOf100')} vsAverageLabel={t('comparison.vsAverage')} />
            <span className="inline-block text-[11px] px-2.5 py-1 rounded-lg bg-picton/10 text-yale mt-2">
              {tLevel('prefix')}: {tLevel(cfhiLevel)}
            </span>

            {comparisonBadge ? (
              <p className={`text-sm font-medium rounded-xl px-4 py-3 mt-3 leading-snug ${comparisonBadge.className}`}>
                {comparisonBadge.text}
              </p>
            ) : null}

            <p className={`text-sm text-left mt-3 leading-relaxed rounded-xl px-4 py-3 ${CFHI_BAND_CLASS[cfhiBand]}`}>
              {tInterpretation(`cfhi.${cfhiBand}`)}
            </p>
          </div>

          <p className="text-xs text-nickel text-left mt-8 mb-2">{t('dimensionsTitle')}</p>
          <div className="space-y-2 text-left lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
            {methodology?.dimensions.map((dimension) => {
              const ds = scoreByDimensionId.get(dimension.id);
              const isNA = ds?.state === 'NA';
              const score = ds && !isNA ? Math.round(ds.score) : null;
              const band = isNA ? 'NA' : score !== null ? scoreToDimensionState(score) : null;
              const level = !isNA && score !== null ? scoreToProgressTier(score) : null;

              return (
                <div key={dimension.id} className="border border-silver/50 rounded-lg p-3 bg-white">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-quartz">{tDim(dimension.code)}</span>
                    <div className="flex items-center gap-1">
                      {level ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-picton/10 text-yale">
                          {tLevel(level)}
                        </span>
                      ) : null}
                      {isNA || score !== null ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-silver/20 text-nickel">
                          {isNA ? t('debtNotApplicable') : score}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!isNA && score !== null ? (
                    <div className="h-1.5 bg-silver/30 rounded-full overflow-hidden">
                      <div className="h-full bg-cola" style={{ width: `${score}%` }} />
                    </div>
                  ) : null}
                  {!isNA && band ? (
                    <p className="text-[11px] text-nickel mt-1.5 leading-relaxed">
                      {tInterpretation(`dimensions.${dimension.code}.${band}`)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="lg:max-w-md lg:mx-auto">
            {showContextBanner ? (
              <div className="mt-6 bg-picton/10 border border-cola/30 rounded-lg p-4 text-left">
                <p className="text-xs text-nickel mb-2">{t('contextBanner.body')}</p>
                <Link href="/diagnostico/contexto" className="text-xs text-yale underline">
                  {t('contextBanner.cta')}
                </Link>
              </div>
            ) : null}

            <SocialComparisonCard plan={messagePlan} />

            {!messagePlan.comparison.shown && messagePlan.comparison.reason === 'DISABLED' ? (
              <Link
                href="/diagnostico/accion"
                className="block mt-6 text-center bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
              >
                {t('ctaNextStep')}
              </Link>
            ) : null}
          </div>
        </div>
        </main>
      </div>
    );
  });
}
