// spec-v2.md §30 (COMMITMENT): TRIGGER + DATE son los dos campos que
// realmente cambian la probabilidad de que un compromiso se cumpla
// (implementation intentions — spec §28, PROCRASTINATION → Implementation
// intention). AMOUNT/FREQUENCY/DURATION quedan fuera a propósito: ya suelen
// venir explícitos en actionText de la intervención (ej. "aparta un monto
// pequeño"), y pedirlos todos junto con trigger+fecha en el mismo paso
// sería fricción extra en el momento exacto que se busca reducir.
export const COMMITMENT_TRIGGERS = [
  'PROXIMO_INGRESO',
  'DIA_ESPECIFICO',
  'DESPUES_GASTOS_FIJOS',
  'PRIMERA_HORA_DIA',
  'FIN_DE_SEMANA'
] as const;

export type CommitmentTrigger = (typeof COMMITMENT_TRIGGERS)[number];

export function isCommitmentTrigger(value: string): value is CommitmentTrigger {
  return (COMMITMENT_TRIGGERS as readonly string[]).includes(value);
}

export const COMMITMENT_TRIGGER_ICON: Record<CommitmentTrigger, string> = {
  PROXIMO_INGRESO: '💰',
  DIA_ESPECIFICO: '📅',
  DESPUES_GASTOS_FIJOS: '🧾',
  PRIMERA_HORA_DIA: '☀️',
  FIN_DE_SEMANA: '🗓️'
};

// Ícono por dimensión para la tarjeta de acción — decorativo, no vive en el
// catálogo (Intervention no tiene campo de ícono propio): se deriva del
// code de la dimensión, igual que ya se hace con las traducciones
// (tDim(dimension.code)).
export const DIMENSION_ICON: Record<string, string> = {
  CONTROL: '🧭',
  RESILIENCE: '🛟',
  DEBT: '⚖️',
  SAVING: '🌱',
  PLANNING: '🎯'
};

export const DEFAULT_DIMENSION_ICON = '⭐';
