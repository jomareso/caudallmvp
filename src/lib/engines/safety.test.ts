import { describe, expect, it } from 'vitest';
import { SAFETY_RULES, SAFETY_FLAG_DIMENSION, SAFETY_BLOCKED_ACTIONS } from './safety';

// Estas tablas se editan a mano y priority.ts/next-best-action.ts confían en
// que están sincronizadas entre sí — un flagCode en SAFETY_RULES sin su
// dimensión en SAFETY_FLAG_DIMENSION rompería a Priority en silencio
// (dimensionCode quedaría null y el override de Safety no apuntaría a nada).
describe('consistencia de las tablas de Safety', () => {
  it('todo flagCode de SAFETY_RULES tiene su dimensión declarada en SAFETY_FLAG_DIMENSION', () => {
    for (const rule of SAFETY_RULES) {
      expect(SAFETY_FLAG_DIMENSION[rule.flagCode], `falta dimensión para ${rule.flagCode}`).toBeDefined();
    }
  });

  it('CRITICAL_DEBT (el único flag que no viene de SAFETY_RULES, sino de DimensionScore) también está mapeado', () => {
    expect(SAFETY_FLAG_DIMENSION.CRITICAL_DEBT).toBe('DEBT');
  });

  it('regla CORE #24: CTRL_CASHFLOW=CRITICAL dispara un flag de safety de la dimensión Control', () => {
    const rule = SAFETY_RULES.find((r) => r.variableCode === 'CTRL_CASHFLOW');
    expect(rule, 'falta el SafetyRule de gastos > ingresos (regla CORE #24)').toBeDefined();
    expect(rule?.triggerStates).toContain('CRITICAL');
    expect(SAFETY_FLAG_DIMENSION[rule!.flagCode]).toBe('CONTROL');
  });

  it('no hay acciones bloqueadas duplicadas', () => {
    expect(new Set(SAFETY_BLOCKED_ACTIONS).size).toBe(SAFETY_BLOCKED_ACTIONS.length);
  });

  it('cada regla tiene al menos un estado disparador', () => {
    for (const rule of SAFETY_RULES) {
      expect(rule.triggerStates.length, `${rule.flagCode} sin triggerStates`).toBeGreaterThan(0);
    }
  });
});
