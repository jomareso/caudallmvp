import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { PostDiagnosticMessagePlan } from '@/lib/engines/post-diagnostic-message';

// Server Component puro (sin 'use client', mismo patrón que ScoreGauge):
// solo renderiza el plan que ya calculó el motor, sin ningún estado propio.
// Estructura REFUERZO → [COMPARACIÓN] → PRÓXIMO PASO → CTA (spec del Motor
// de Comparación Social) — nunca decide nada acá, solo interpola el texto
// según tier/posición ya resueltos.
export async function SocialComparisonCard({ plan }: { plan: PostDiagnosticMessagePlan }) {
  const { comparison, action, tier } = plan;
  if (!comparison.shown && comparison.reason === 'DISABLED') return null;

  const t = await getTranslations('diagnostic.result.socialComparison');
  const tDim = await getTranslations('diagnostic.dimensions');
  const tRoot = await getTranslations();

  const dimensionLabel = comparison.priorityDimension ? tDim(comparison.priorityDimension) : '';

  const reinforcement = comparison.shown
    ? t(`reinforcement.${tier}.${comparison.position}`, { dimension: dimensionLabel })
    : t(`noData.${tier}`, { dimension: dimensionLabel });

  // El percentil/posición ya se muestra como una tarjeta grande junto al
  // gauge del CFHI (ver resultado/page.tsx) — repetirlo acá abajo, más
  // chico, sería redundante. Esta tarjeta se queda solo con el REFUERZO
  // cualitativo y el PRÓXIMO PASO/CTA.
  return (
    <div className="mt-6 bg-white border border-silver/60 rounded-xl p-4 text-left">
      <p className="text-xs font-semibold text-yale mb-2">{t('title')}</p>
      <p className="text-sm text-quartz leading-relaxed">{reinforcement}</p>

      {action ? (
        <div className="mt-4 pt-4 border-t border-silver/40">
          <p className="text-[11px] text-nickel mb-1">{t('actionTitle')}</p>
          <p className="text-sm font-medium text-quartz">{tRoot(action.titleI18nKey)}</p>
        </div>
      ) : null}

      <Link
        href="/diagnostico/accion"
        className="block mt-4 text-center bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
      >
        {t(`cta.${tier}`)}
      </Link>
    </div>
  );
}
