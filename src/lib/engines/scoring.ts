// Motor de agregación del CFHI — spec §5 (Construct Aggregation Layer) y
// regla CORE #16: el scoring nunca suma preguntas directamente, siempre pasa
// por Evidence → Variable → Constructo → Dimensión → CFHI.
//
// Esta misma función se usa tres veces en el pipeline (variable→constructo,
// constructo→dimensión, dimensión→CFHI) porque las tres son, en el fondo, el
// mismo problema: promediar lo que sí se conoce, ponderado, excluyendo lo que
// no aplica (N/A) o no se ha respondido todavía, y redistribuyendo el peso
// proporcionalmente entre lo que queda (regla CORE #7 para Deuda N/A).

export type WeightedScore = {
  key: string;
  /** null = N/A o todavía sin evidencia. Nunca se trata como 0 ni como 100. */
  score: number | null;
  weight: number;
};

export type AggregateResult = {
  /** null si no hay ninguna entrada con datos (nada que promediar todavía). */
  score: number | null;
  includedKeys: string[];
  excludedKeys: string[];
};

export function weightedAverageExcludingNA(items: WeightedScore[]): AggregateResult {
  const included = items.filter(
    (item): item is WeightedScore & { score: number } => item.score !== null
  );
  const excludedKeys = items.filter((item) => item.score === null).map((item) => item.key);

  const totalWeight = included.reduce((sum, item) => sum + item.weight, 0);

  if (included.length === 0 || totalWeight <= 0) {
    return { score: null, includedKeys: [], excludedKeys: items.map((item) => item.key) };
  }

  const weightedSum = included.reduce((sum, item) => sum + item.score * item.weight, 0);

  return {
    score: weightedSum / totalWeight,
    includedKeys: included.map((item) => item.key),
    excludedKeys
  };
}

export type DimensionState = 'MET' | 'PARTIAL' | 'UNMET' | 'CRITICAL';

// Mismos cortes de banda que ya se usaron y mostraron en el prototipo
// (docs/prototype/caudall-v2-dinamico.html), para no inventar bandas nuevas.
export function scoreToDimensionState(score: number): DimensionState {
  if (score >= 71) return 'MET';
  if (score >= 51) return 'PARTIAL';
  if (score >= 31) return 'UNMET';
  return 'CRITICAL';
}

export type ProgressTier = 'LOW' | 'MID' | 'HIGH';

export type ProgressTierCutoffs = { mid: number; high: number };

// Cortes provisionales confirmados por Reynoso — el propio documento los
// marca como provisionales hasta calibrarlos con evidencia real. Quedan
// acá como default (y para tests sin DB); en producción se usa el valor
// real de PlatformSettings.progressTierMidCutoff/HighCutoff, editable
// desde /admin/metodologia/parametros.
export const PROGRESS_TIER_DEFAULT_CUTOFFS: ProgressTierCutoffs = { mid: 41, high: 71 };

// Metodología v1.5 §6: Explorador/Navegante/Capitán (empleado) y
// Vulnerables/Sobreviviendo/Saludables (RRHH) son "una capa de
// gamificación y progreso" — comparten la misma medición de fondo (CFHI y
// puntuaciones por dimensión) pero NO son la misma banda de 4 estados que
// devuelve scoreToDimensionState (esa es la "interpretación de la
// condición"; el nivel es un elemento aparte que se muestra junto a ella,
// no en su lugar).
export function scoreToProgressTier(score: number, cutoffs: ProgressTierCutoffs = PROGRESS_TIER_DEFAULT_CUTOFFS): ProgressTier {
  if (score >= cutoffs.high) return 'HIGH';
  if (score >= cutoffs.mid) return 'MID';
  return 'LOW';
}
