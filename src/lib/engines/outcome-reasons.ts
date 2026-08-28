// spec-v2.md §29 (BEHAVIORAL DESIGN) / regla CORE 19: la economía conductual
// resuelve una fricción identificada, nunca al revés (FRICTION → TECHNIQUE).
// Capturar por qué un compromiso quedó en "en parte" o "todavía no" es la
// fricción real que alimenta al Learning Engine (regla CORE 20) — sin esto,
// OUTCOME_REPORTED solo sabe *que* no se logró, no *por qué*, y no hay nada
// de dónde aprender.
export const OUTCOME_REASONS = ['NO_TIME', 'TOO_HARD', 'CHANGED_MIND'] as const;

export type OutcomeReason = (typeof OUTCOME_REASONS)[number];

export function isOutcomeReason(value: string): value is OutcomeReason {
  return (OUTCOME_REASONS as readonly string[]).includes(value);
}
