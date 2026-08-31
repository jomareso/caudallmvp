import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { getRequestOrigin } from '@/lib/http/request-origin';
import type { PostDiagnosticMessagePlan } from '@/lib/engines/post-diagnostic-message';
import { percentileToNaturalFrequency } from '@/lib/engines/social-comparison';
import { getResendClient, renderEmailShell } from './send-magic-link';

// Correo post-diagnóstico (spec del Motor de Comparación Social, §21):
// distinto del push RESULT_UPDATED existente (src/lib/push/notification-engine.ts),
// que solo avisa cuando un resultado YA existente cambia. Este correo se
// envía una sola vez por diagnóstico completado (dedup vía
// SocialComparisonSnapshot, ver resultado/page.tsx), incluyendo la primera
// vez. Reusa las mismas claves de next-intl que la tarjeta en pantalla
// (diagnostic.result.socialComparison) — a diferencia de
// notification-engine.ts, esto SÍ corre dentro de una request de Next.js
// (se llama desde el Server Component de /diagnostico/resultado, no desde
// el cron), así que next-intl tiene contexto de locale disponible y no
// hace falta duplicar el copy en texto plano.
export async function sendDiagnosticResultEmail(params: {
  to: string;
  employeeId: string;
  plan: PostDiagnosticMessagePlan;
}): Promise<void> {
  const { to, employeeId, plan } = params;

  const preference = await prisma.notificationPreference.findUnique({ where: { employeeId } });
  // Sin fila = nunca abrió Configuración -> default true, igual que el
  // resto del motor de notificaciones (ver notification-engine.ts).
  const emailEnabled = preference ? preference.emailChannelEnabled && preference.resultUpdated : true;
  if (!emailEnabled) return;

  const { comparison, action, tier } = plan;

  const t = await getTranslations('diagnostic.result.socialComparison');
  const tDim = await getTranslations('diagnostic.dimensions');
  const tRoot = await getTranslations();

  // GENERAL (fallback de Resiliencia): mismo motivo que en
  // social-comparison-card.tsx/resultado/page.tsx — el percentil es del
  // índice general, no de priorityDimension, así que la etiqueta no
  // puede venir de tDim(priorityDimension) o el texto quedaría engañoso.
  const dimensionLabel =
    comparison.shown && comparison.comparisonScope === 'GENERAL'
      ? t('generalIndexLabel')
      : comparison.priorityDimension
        ? tDim(comparison.priorityDimension)
        : '';

  // Dato primero, refuerzo después (no al revés): "7 de cada 10" ya dice la
  // comparación, así que el refuerzo (reinforcement.*.SUPERIOR/SIMILAR en
  // es.json) se recortó para no repetirla — sin el dato (INFERIOR o sin
  // datos), el refuerzo se queda con el peso visual principal, como antes.
  const stat =
    comparison.shown && comparison.includeNumericComparison
      ? t('stat', { dimension: dimensionLabel, n: percentileToNaturalFrequency(comparison.percentile) })
      : null;

  const reinforcement = comparison.shown
    ? t(`reinforcement.${tier}.${comparison.position}`, { dimension: dimensionLabel })
    : t(`noData.${tier}`, { dimension: dimensionLabel });
  const reinforcementStyle = stat
    ? 'font-size:13px;color:#737373;line-height:1.5;margin:0 0 16px'
    : 'font-size:14px;line-height:1.5;margin:0 0 16px';

  const origin = getRequestOrigin();
  const from = process.env.EMAIL_FROM ?? 'Caudall <no-reply@caudall.com>';

  const actionHtml = action
    ? `
        <p style="font-size:12px;color:#737373;margin:0 0 4px">${t('actionTitle')}</p>
        <p style="font-size:14px;font-weight:600;margin:0 0 24px">${tRoot(action.titleI18nKey)}</p>
      `
    : '';

  // Si hay una acción sugerida, el CTA manda directo a comprometerse con
  // ella (/diagnostico/accion) en vez de a /resultado — que solo era una
  // parada intermedia desde la que igual había que dar otro clic para
  // llegar ahí. Fricción real de un clic de más, no una técnica conductual
  // (spec, regla CORE #19: FRICTION → TECHNIQUE, nunca al revés) — sin
  // acción sugerida, no hay a dónde más llevarlo que al resultado.
  const ctaUrl = action ? `${origin}/diagnostico/accion` : `${origin}/diagnostico/resultado`;
  const ctaLabel = action ? t('emailCtaAction') : t('emailCta');

  const { error } = await getResendClient().emails.send({
    from,
    to,
    subject: t(`emailSubject.${tier}`),
    html: renderEmailShell(
      origin,
      `
        ${stat ? `<p style="font-size:14px;line-height:1.5;margin:0 0 8px">${stat}</p>` : ''}
        <p style="${reinforcementStyle}">${reinforcement}</p>
        ${actionHtml}
        <p style="margin:0 0 8px">
          <a href="${ctaUrl}" class="cd-btn"
             style="background:#0F5499;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;font-size:14px;display:inline-block">
            ${ctaLabel}
          </a>
        </p>
      `
    )
  });

  if (error) {
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}
