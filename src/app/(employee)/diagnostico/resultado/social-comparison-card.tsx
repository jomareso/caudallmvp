import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { PostDiagnosticMessagePlan } from '@/lib/engines/post-diagnostic-message';

// Puramente decorativo (no es texto de UI, no pasa por next-intl — un
// emoji no es un idioma): un ancla visual por tier para que la tarjeta no
// dependa solo de tipografía gris para transmitir tono, más la clase de
// color semántico ya usada en el resto de /resultado (bad/warn/ok, ver
// CFHI_BAND_CLASS en page.tsx) — nunca el azul de marca ('yale'), que
// queda reservado para el CTA porque es overridable por tenant (ADR-003).
const TIER_META: Record<'LOW' | 'MID' | 'HIGH', { emoji: string; badge: string; box: string }> = {
  LOW: { emoji: '🌱', badge: 'bg-warn/10 text-warn', box: 'bg-warn/10' },
  MID: { emoji: '📈', badge: 'bg-picton/10 text-yale', box: 'bg-picton/10' },
  HIGH: { emoji: '🏆', badge: 'bg-ok/10 text-ok', box: 'bg-ok/10' }
};

// Server Component puro (sin 'use client', mismo patrón que ScoreGauge):
// solo renderiza el plan que ya calculó el motor, sin ningún estado propio.
// Estructura REFUERZO → [COMPARACIÓN] → PRÓXIMO PASO → CTA (spec del Motor
// de Comparación Social) — nunca decide nada acá, solo interpola el texto
// según tier/posición ya resueltos.
export async function SocialComparisonCard({ plan }: { plan: PostDiagnosticMessagePlan }) {
  const { comparison, action, tier } = plan;
  // NO_CONSENT: el empleado dijo explícitamente que no quiere ver
  // comparación (CTX-07=NO) — se respeta igual que DISABLED, sin mostrar
  // ni siquiera el refuerzo genérico de noData.
  if (!comparison.shown && (comparison.reason === 'DISABLED' || comparison.reason === 'NO_CONSENT')) return null;

  const t = await getTranslations('diagnostic.result.socialComparison');
  const tDim = await getTranslations('diagnostic.dimensions');
  const tRoot = await getTranslations();

  // GENERAL (fallback de Resiliencia): el percentil es del índice
  // general, no de comparisonDimension ('RESILIENCE' se conserva para
  // auditoría) — usar tDim acá diría "Tu Resiliencia..." sobre un número
  // que en realidad es del CFHI general. Ver comentario del tipo en
  // social-comparison.ts.
  const dimensionLabel =
    comparison.shown && comparison.comparisonScope === 'GENERAL'
      ? t('generalIndexLabel')
      : comparison.priorityDimension
        ? tDim(comparison.priorityDimension)
        : '';

  const reinforcement = comparison.shown
    ? t(`reinforcement.${tier}.${comparison.position}`, { dimension: dimensionLabel })
    : t(`noData.${tier}`, { dimension: dimensionLabel });

  const meta = TIER_META[tier];

  // El percentil/posición ya se muestra como una tarjeta grande junto al
  // gauge del CFHI (ver resultado/page.tsx) — repetirlo acá abajo, más
  // chico, sería redundante. Esta tarjeta se queda solo con el REFUERZO
  // cualitativo y el PRÓXIMO PASO/CTA.
  return (
    <div className="mt-6 bg-white border border-silver/60 rounded-xl p-4 text-left">
      <div className="flex items-center gap-2 mb-3">
        <span className={`flex items-center justify-center w-7 h-7 rounded-full text-sm ${meta.badge}`} aria-hidden="true">
          {meta.emoji}
        </span>
        <p className="text-xs font-semibold text-yale">{t('title')}</p>
      </div>

      <p className={`text-sm text-quartz leading-relaxed rounded-xl px-3 py-3 ${meta.box}`}>{reinforcement}</p>

      {action ? (
        <div className="mt-4 pt-4 border-t border-silver/40">
          <p className="text-[11px] text-nickel mb-1">🎯 {t('actionTitle')}</p>
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
