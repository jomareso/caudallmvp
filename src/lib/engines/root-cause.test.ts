import { describe, expect, it } from 'vitest';
import { extractSourceVariables, pickBest, type ActiveEdge } from './root-cause';

describe('extractSourceVariables', () => {
  it('extrae variables de comparaciones simples, ignorando el operador y el valor', () => {
    expect(extractSourceVariables('CTRL_DRIVER = VARIABLE_INCOME')).toEqual(['CTRL_DRIVER']);
    expect(extractSourceVariables('DEBT_STATE IN {UNMET,CRITICAL}')).toEqual(['DEBT_STATE']);
  });

  it('extrae varias variables de una condición compuesta, sin duplicados', () => {
    expect(
      extractSourceVariables('CTRL_DRIVER = VARIABLE_INCOME AND CTRL_DRIVER != UNKNOWN AND CTX_INCOME_PATTERN = VARIABLE')
    ).toEqual(['CTRL_DRIVER', 'CTX_INCOME_PATTERN']);
  });

  it('solo extrae variables de comparaciones =/!=/IN — "confidence <" no es una de ellas (ninguna regla real la usa)', () => {
    expect(extractSourceVariables('DEBT_DRIVER confidence < 0.80')).toEqual([]);
  });

  it('nunca devuelve "CONFIDENCE" como si fuera una variable fuente', () => {
    expect(extractSourceVariables('CTRL_DRIVER = VARIABLE_INCOME AND CONFIDENCE = HIGH')).toEqual(['CTRL_DRIVER']);
  });
});

describe('pickBest', () => {
  function edge(overrides: Partial<ActiveEdge>): ActiveEdge {
    return {
      ruleCode: 'INF-000',
      sourceVariables: ['X'],
      targetVariableCode: 'Y',
      targetValue: 'Z',
      confidence: 0.5,
      type: 'WEAK',
      ...overrides
    };
  }

  it('una regla STRONG siempre gana sobre una WEAK, sin importar la confianza', () => {
    const weakButConfident = edge({ ruleCode: 'INF-001', type: 'WEAK', confidence: 0.99 });
    const strongButLess = edge({ ruleCode: 'INF-002', type: 'STRONG', confidence: 0.5 });
    expect(pickBest([weakButConfident, strongButLess]).ruleCode).toBe('INF-002');
  });

  it('entre dos del mismo tipo, gana la de mayor confianza', () => {
    const lower = edge({ ruleCode: 'INF-003', type: 'STRONG', confidence: 0.6 });
    const higher = edge({ ruleCode: 'INF-004', type: 'STRONG', confidence: 0.9 });
    expect(pickBest([lower, higher]).ruleCode).toBe('INF-004');
  });
});
