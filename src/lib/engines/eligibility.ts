import { computeFinancialReadiness, computeBehavioralReadiness } from './readiness';
import { computePriority } from './priority';

// spec-v2.md §27: separar USER_GOAL / SYSTEM_PRIORITY / ACTION_ELIGIBILITY,
// y nunca borrar una aspiración solo porque no sea accionable ahora.
// FinancialState.userGoal no lo llena ninguna pantalla todavía (no existe
// UI que capture el objetivo del empleado) — este motor deliberadamente NO
// lo toca ni lo infiere, para no pisar ese campo el día que sí exista esa
// pantalla.
//
// ELIGIBILITY = ¿conviene hacer esta acción? READINESS = ¿está preparado
// para hacerla ahora? (spec §18). Este motor responde lo primero
// combinando Financial Readiness (¿tiene con qué?) y la ausencia de un
// bloqueo de Safety; Next Best Action (motor futuro) todavía decide QUÉ
// acción específica, así que "accionable" aquí es a nivel general, no por
// intervención concreta.

export type EligibilityResult = {
  actionEligible: boolean;
  systemPriorityDimension: string | null;
  financialReadiness: Awaited<ReturnType<typeof computeFinancialReadiness>>;
  behavioralReadiness: Awaited<ReturnType<typeof computeBehavioralReadiness>>;
};

export async function computeEligibility(employeeId: string): Promise<EligibilityResult> {
  const [financialReadiness, behavioralReadiness, priority] = await Promise.all([
    computeFinancialReadiness(employeeId),
    computeBehavioralReadiness(employeeId),
    computePriority(employeeId)
  ]);

  const actionEligible = financialReadiness.state === 'ELIGIBLE' || financialReadiness.state === 'STRONG';

  return {
    actionEligible,
    systemPriorityDimension: priority.dimensionCode,
    financialReadiness,
    behavioralReadiness
  };
}
