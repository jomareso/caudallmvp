import { buildFacts } from './diagnostic';
import { getActiveSafetyFlags } from './safety';

// spec-v2.md §18: Financial Readiness y Behavioral Readiness NO se mezclan.
// FINANCIAL READINESS = ¿tiene con qué? (FIN_CAPACITY, SAFETY_CLEARANCE,
// RESOURCE_AVAILABILITY). BEHAVIORAL READINESS = ¿está en condición de
// actuar ahora? (SELF_EFFICACY, INTENTION, FRICTION, BEHAVIOR_STAGE,
// PERCEIVED_CAPACITY). Igual que Priority, la spec no congela coeficientes
// matemáticos definitivos aquí — en vez de inventar pesos, se usa el
// principio del eslabón más débil: la señal peor disponible manda, porque
// "listo para actuar" es tan fuerte como su parte más frágil.

export type FinancialReadinessState = 'NOT_ELIGIBLE' | 'CONSTRAINED' | 'ELIGIBLE' | 'STRONG';
export type BehavioralReadinessState = 'LOW' | 'MODERATE' | 'HIGH';

export type FinancialReadinessResult = {
  state: FinancialReadinessState | null;
  method: 'SAFETY_OVERRIDE' | 'SAV_CAPACITY' | 'NONE';
  explanation: string;
};

export type BehavioralReadinessResult = {
  state: BehavioralReadinessState | null;
  method: 'WEAKEST_SIGNAL' | 'NONE';
  explanation: string;
  signalsUsed: string[];
};

// SAV_CAPACITY (spec §12/13, ya cargada y respondida en el banco real) es el
// mejor proxy disponible hoy de FIN_CAPACITY: sus estados fueron diseñados
// con semántica prácticamente paralela a la de Financial Readiness.
export const FIN_CAPACITY_TO_READINESS: Record<string, FinancialReadinessState> = {
  NONE: 'NOT_ELIGIBLE',
  CONSTRAINED: 'CONSTRAINED',
  LIMITED: 'CONSTRAINED',
  AVAILABLE: 'ELIGIBLE',
  STRONG: 'STRONG'
};

export async function computeFinancialReadiness(employeeId: string): Promise<FinancialReadinessResult> {
  // Safety puede bloquear temporalmente acciones (spec §19) — mientras haya
  // una alerta activa, no hay "elegibilidad" real posible, sin importar la
  // capacidad de ahorro.
  const activeFlags = await getActiveSafetyFlags(employeeId);
  if (activeFlags.length > 0) {
    return {
      state: 'NOT_ELIGIBLE',
      method: 'SAFETY_OVERRIDE',
      explanation: `Alerta de seguridad activa (${activeFlags.map((f) => f.flagCode).join(', ')}) bloquea la elegibilidad financiera.`
    };
  }

  const facts = await buildFacts(employeeId);
  const savCapacity = facts.get('SAV_CAPACITY')?.state;
  const state = savCapacity ? (FIN_CAPACITY_TO_READINESS[savCapacity] ?? null) : null;

  return {
    state,
    method: state ? 'SAV_CAPACITY' : 'NONE',
    explanation: state
      ? `SAV_CAPACITY=${savCapacity} → ${state}.`
      : 'Sin evidencia todavía de capacidad de ahorro/acción (SAV_CAPACITY desconocida).'
  };
}

export const SELF_EFFICACY_TIER: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };
export const INTENTION_TIER: Record<string, number> = { NONE: 0, WEAK: 0, MODERATE: 1, STRONG: 2 };
export const PLAN_STAGE_TIER: Record<string, number> = {
  NO_DIRECTION: 0,
  ASPIRATION: 0,
  GOAL_DEFINED: 1,
  PLAN_DEFINED: 1,
  READY_TO_ACT: 2,
  STARTED: 2,
  REPEATING: 2,
  TRACKING: 2,
  MAINTAINING: 2
};

const TIER_TO_STATE: BehavioralReadinessState[] = ['LOW', 'MODERATE', 'HIGH'];

export type ReadinessSignal = { code: string; tier: number };

// Principio del eslabón más débil (ver comentario arriba): "listo para
// actuar" es tan fuerte como su señal más frágil, no un promedio.
export function pickWeakestSignal(signals: ReadinessSignal[]): ReadinessSignal {
  return signals.reduce((min, s) => (s.tier < min.tier ? s : min));
}

export async function computeBehavioralReadiness(employeeId: string): Promise<BehavioralReadinessResult> {
  const facts = await buildFacts(employeeId);

  const signals: Array<{ code: string; tier: number }> = [];
  const selfEfficacy = facts.get('BEH_SELF_EFFICACY')?.state;
  if (selfEfficacy && selfEfficacy in SELF_EFFICACY_TIER) {
    signals.push({ code: `BEH_SELF_EFFICACY=${selfEfficacy}`, tier: SELF_EFFICACY_TIER[selfEfficacy] });
  }
  const intention = facts.get('BEH_INTENTION')?.state;
  if (intention && intention in INTENTION_TIER) {
    signals.push({ code: `BEH_INTENTION=${intention}`, tier: INTENTION_TIER[intention] });
  }
  const planStage = facts.get('PLAN_STAGE')?.state;
  if (planStage && planStage in PLAN_STAGE_TIER) {
    signals.push({ code: `PLAN_STAGE=${planStage}`, tier: PLAN_STAGE_TIER[planStage] });
  }

  if (signals.length === 0) {
    return {
      state: null,
      method: 'NONE',
      explanation: 'Sin señales de disposición conductual todavía (BEH_SELF_EFFICACY, BEH_INTENTION, PLAN_STAGE desconocidas).',
      signalsUsed: []
    };
  }

  const weakest = pickWeakestSignal(signals);

  return {
    state: TIER_TO_STATE[weakest.tier],
    method: 'WEAKEST_SIGNAL',
    explanation: `Señal más débil: ${weakest.code} → ${TIER_TO_STATE[weakest.tier]}.`,
    signalsUsed: signals.map((s) => s.code)
  };
}
