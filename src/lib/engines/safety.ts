import { prisma } from '@/lib/db/prisma';

// spec-v2.md §19: Safety es independiente del score. Puede bloquear
// temporalmente ciertas acciones sin tocar el CFHI. La lista de acciones
// bloqueables queda declarada aquí para que el futuro motor de Next Best
// Action la consulte — el MVP no tiene productos financieros (Decisión 2),
// así que hoy no hay nada que filtrar con ella todavía.
export const SAFETY_BLOCKED_ACTIONS = [
  'INVEST',
  'ACCELERATE_SECONDARY_GOAL',
  'AGGRESSIVE_SAVING',
  'NEW_FINANCIAL_COMMITMENT'
] as const;

type SafetyRule = {
  flagCode: string;
  variableCode: string;
  triggerStates: string[];
};

const SAFETY_RULES: SafetyRule[] = [
  { flagCode: 'DEBT_PAYMENT_STRESS', variableCode: 'DEBT_ARREARS', triggerStates: ['CURRENT'] },
  { flagCode: 'DEBT_CYCLE_RISK', variableCode: 'DEBT_ROLLOVER', triggerStates: ['RECURRENT'] },
  { flagCode: 'CASHFLOW_CREDIT_DEPENDENCY', variableCode: 'DEBT_ESSENTIAL_DEPENDENCY', triggerStates: ['RECURRENT'] }
];

async function raiseSafetyFlag(employeeId: string, flagCode: string, evidenceIds: string[]): Promise<void> {
  const existing = await prisma.safetyFlag.findFirst({ where: { employeeId, flagCode, resolvedAt: null } });
  if (existing) return;
  await prisma.safetyFlag.create({ data: { employeeId, flagCode, evidenceIds } });
}

export async function evaluateSafety(employeeId: string): Promise<void> {
  const variableCodes = SAFETY_RULES.map((r) => r.variableCode);
  const [variables, debtDimension, existingFlags] = await Promise.all([
    prisma.variable.findMany({ where: { code: { in: variableCodes } } }),
    prisma.dimension.findFirst({ where: { code: 'DEBT' } }),
    prisma.safetyFlag.findMany({ where: { employeeId, resolvedAt: null } })
  ]);

  const variableIdByCode = new Map(variables.map((v) => [v.code, v.id]));
  const states = await prisma.variableState.findMany({
    where: { employeeId, variableId: { in: variables.map((v) => v.id) } }
  });
  const stateByVariableId = new Map(states.map((s) => [s.variableId, s]));

  const activeFlagCodes = new Set<string>();

  for (const rule of SAFETY_RULES) {
    const variableId = variableIdByCode.get(rule.variableCode);
    const state = variableId ? stateByVariableId.get(variableId) : undefined;
    if (state && rule.triggerStates.includes(state.state)) {
      activeFlagCodes.add(rule.flagCode);
      await raiseSafetyFlag(employeeId, rule.flagCode, state.derivedFromEvidenceIds);
    }
  }

  // DEBT_STATE = CRITICAL (spec §19) no es una variable propia (es
  // "DERIVED") — es el estado ya calculado de la dimensión Deuda.
  if (debtDimension) {
    const debtScore = await prisma.dimensionScore.findUnique({
      where: { employeeId_dimensionId: { employeeId, dimensionId: debtDimension.id } }
    });
    if (debtScore?.state === 'CRITICAL') {
      activeFlagCodes.add('CRITICAL_DEBT');
      await raiseSafetyFlag(employeeId, 'CRITICAL_DEBT', []);
    }
  }

  // Una respuesta corregida puede hacer que una condición de safety deje de
  // aplicar — el flag se resuelve, no se borra (queda el historial).
  for (const flag of existingFlags) {
    if (!activeFlagCodes.has(flag.flagCode)) {
      await prisma.safetyFlag.update({ where: { id: flag.id }, data: { resolvedAt: new Date() } });
    }
  }
}

export async function getActiveSafetyFlags(employeeId: string) {
  return prisma.safetyFlag.findMany({ where: { employeeId, resolvedAt: null }, orderBy: { raisedAt: 'asc' } });
}
