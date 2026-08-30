// Compone el PLAN de mensaje post-diagnóstico (spec: RESULTADO → REFUERZO →
// [COMPARACIÓN] → PRÓXIMO PASO → CTA). Deliberadamente NO devuelve texto —
// devuelve datos estructurados (tier, comparación, próxima acción) que cada
// canal renderiza en su propio idioma: la tarjeta en resultado/page.tsx vía
// next-intl (Decisión 5), el correo vía plantillas de texto plano (mismo
// patrón que src/lib/push/notification-engine.ts). Así ninguno de los dos
// "redecide" nada — ambos leen el mismo plan.
//
// No son 3 tiers × 5 dimensiones × 3 posiciones = 45 textos escritos a
// mano: la copy real varía por tier × posición (9 combinaciones), y el
// nombre de la dimensión / texto de la acción se interpolan como datos, no
// como bloques de texto independientes por dimensión.
import { prisma } from '@/lib/db/prisma';
import { computeNextBestAction } from './next-best-action';
import { computeSocialComparison, type SocialComparisonResult } from './social-comparison';
import type { ProgressTier } from './scoring';

export type NextActionSummary = {
  dimensionCode: string;
  titleI18nKey: string;
  actionTextI18nKey: string | null;
};

// Solo lectura — a propósito no usa getActionSuggestion() (la acción de
// /diagnostico/accion), porque esa función tiene efecto secundario: crea el
// EmployeeIntervention (status SUGGESTED) y registra un evento de learning
// la primera vez que se llama. Llamarla desde acá adelantaría ese
// "sugerido" al momento de ver el resultado en vez de cuando el empleado
// realmente abre la pantalla de acción. Este helper replica solo la parte
// de lectura (¿ya hay una sugerencia activa? si no, ¿cuál elegiría el motor
// ahora?) sin persistir nada.
export async function resolveNextAction(employeeId: string): Promise<NextActionSummary | null> {
  const existing = await prisma.employeeIntervention.findFirst({
    where: { employeeId, status: { in: ['SUGGESTED', 'COMMITTED', 'IN_PROGRESS'] } },
    include: { intervention: { include: { dimension: true } } },
    orderBy: { assignedAt: 'desc' }
  });
  if (existing) {
    return {
      dimensionCode: existing.intervention.dimension.code,
      titleI18nKey: existing.intervention.titleI18nKey,
      actionTextI18nKey: existing.intervention.actionTextI18nKey
    };
  }

  const nba = await computeNextBestAction(employeeId);
  if (!nba.intervention) return null;

  const dimension = await prisma.dimension.findUniqueOrThrow({ where: { id: nba.intervention.dimensionId } });
  return {
    dimensionCode: dimension.code,
    titleI18nKey: nba.intervention.titleI18nKey,
    actionTextI18nKey: nba.intervention.actionTextI18nKey
  };
}

export type PostDiagnosticMessagePlan = {
  tier: ProgressTier;
  comparison: SocialComparisonResult;
  action: NextActionSummary | null;
};

export async function buildPostDiagnosticMessagePlan(employeeId: string): Promise<PostDiagnosticMessagePlan> {
  const [comparison, action] = await Promise.all([computeSocialComparison(employeeId), resolveNextAction(employeeId)]);

  return { tier: comparison.progressTier, comparison, action };
}
