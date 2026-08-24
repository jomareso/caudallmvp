import { describe, expect, it } from 'vitest';
import { evaluateRule, type Facts } from './rules';

function facts(entries: Record<string, { state: string; confidenceRatio: number }>): Facts {
  return new Map(Object.entries(entries));
}

describe('evaluateRule', () => {
  it('TRUE siempre se cumple', () => {
    expect(evaluateRule('TRUE', facts({}))).toBe(true);
    expect(evaluateRule('', facts({}))).toBe(true);
  });

  it('igualdad simple requiere que la variable sea conocida', () => {
    expect(evaluateRule('DEBT_APPLICABILITY = APPLICABLE', facts({}))).toBe(false);
    expect(
      evaluateRule('DEBT_APPLICABILITY = APPLICABLE', facts({ DEBT_APPLICABILITY: { state: 'APPLICABLE', confidenceRatio: 1 } }))
    ).toBe(true);
    expect(
      evaluateRule('DEBT_APPLICABILITY = APPLICABLE', facts({ DEBT_APPLICABILITY: { state: 'NONE', confidenceRatio: 1 } }))
    ).toBe(false);
  });

  it('IN {..} — caso real de CTRL-03', () => {
    const f = facts({ CTRL_CASHFLOW: { state: 'CRITICAL', confidenceRatio: 1 } });
    expect(evaluateRule('CTRL_CASHFLOW IN {NEGATIVE,CRITICAL}', f)).toBe(true);
    expect(evaluateRule('CTRL_CASHFLOW IN {HIGH,POSITIVE}', f)).toBe(false);
  });

  it('OR simple — caso real de CTRL-04', () => {
    const f1 = facts({ CTRL_DRIVER: { state: 'VARIABLE_INCOME', confidenceRatio: 1 } });
    expect(evaluateRule('CTRL_DRIVER = VARIABLE_INCOME OR CTX_INCOME_PATTERN = VARIABLE', f1)).toBe(true);

    const f2 = facts({ CTX_INCOME_PATTERN: { state: 'VARIABLE', confidenceRatio: 1 } });
    expect(evaluateRule('CTRL_DRIVER = VARIABLE_INCOME OR CTX_INCOME_PATTERN = VARIABLE', f2)).toBe(true);

    expect(evaluateRule('CTRL_DRIVER = VARIABLE_INCOME OR CTX_INCOME_PATTERN = VARIABLE', facts({}))).toBe(false);
  });

  it('"IDENT < número" sin la palabra confidence: si el estado no es numérico, no se soporta -> false seguro', () => {
    const f = facts({
      CTRL_VISIBILITY: { state: 'PARTIAL', confidenceRatio: 1 },
      CTRL_CONFIDENCE: { state: 'x', confidenceRatio: 0.5 }
    });
    expect(evaluateRule('CTRL_VISIBILITY IN {PARTIAL,LOW,UNKNOWN} AND CTRL_CONFIDENCE < 0.80', f)).toBe(false);
  });

  it('"IDENT >=/< número" SÍ se soporta cuando el estado es un valor numérico "0..1" (ej. SAV_CONFIDENCE) — caso real de SAV-18', () => {
    expect(evaluateRule('SAV_CONFIDENCE >= 0.80', facts({}))).toBe(false);
    expect(evaluateRule('SAV_CONFIDENCE >= 0.80', facts({ SAV_CONFIDENCE: { state: '0.85', confidenceRatio: 1 } }))).toBe(
      true
    );
    expect(evaluateRule('SAV_CONFIDENCE >= 0.80', facts({ SAV_CONFIDENCE: { state: '0.65', confidenceRatio: 1 } }))).toBe(
      false
    );
    expect(evaluateRule('CTRL_CONFIDENCE < 0.80', facts({ CTRL_CONFIDENCE: { state: '0.60', confidenceRatio: 1 } }))).toBe(
      true
    );
  });

  it('confidence sin evidencia se trata como 0 (SKIP_IF típico)', () => {
    expect(evaluateRule('CTRL_DRIVER confidence >= 0.80', facts({}))).toBe(false);
    expect(
      evaluateRule('CTRL_DRIVER confidence >= 0.80', facts({ CTRL_DRIVER: { state: 'x', confidenceRatio: 1 } }))
    ).toBe(true);
  });

  it('"not known" y "known"', () => {
    expect(evaluateRule('RES_PROTECTION not known OR RES_PROTECTION != STRONG', facts({}))).toBe(true);
    expect(
      evaluateRule(
        'RES_PROTECTION not known OR RES_PROTECTION != STRONG',
        facts({ RES_PROTECTION: { state: 'STRONG', confidenceRatio: 1 } })
      )
    ).toBe(false);
    expect(
      evaluateRule('USER_GOAL known AND PLAN_ACTION confidence < 0.80', facts({ USER_GOAL: { state: 'x', confidenceRatio: 1 } }))
    ).toBe(true);
  });

  it('paréntesis — caso real de DEBT-xx', () => {
    const f = facts({
      DEBT_APPLICABILITY: { state: 'APPLICABLE', confidenceRatio: 1 },
      DEBT_PAYMENT_CAPACITY: { state: 'COMFORTABLE', confidenceRatio: 1 },
      DEBT_PRESSURE: { state: 'MODERATE', confidenceRatio: 1 }
    });
    // DEBT_PRESSURE >= MODERATE no es una comparación soportada (no es
    // numérica ni IN): debe evaluar como no soportada -> false en ese atom,
    // pero el OR con la otra rama sigue funcionando si esa es verdadera.
    expect(
      evaluateRule('DEBT_APPLICABILITY = APPLICABLE AND (DEBT_PAYMENT_CAPACITY != COMFORTABLE OR DEBT_PRESSURE >= MODERATE)', f)
    ).toBe(false);
  });

  it('frases fuera de la gramática soportada se resuelven como false, sin lanzar', () => {
    expect(() => evaluateRule('NEXT_ACTION requires debt structure', facts({}))).not.toThrow();
    expect(evaluateRule('NEXT_ACTION requires debt structure', facts({}))).toBe(false);
    expect(evaluateRule('ELIGIBLE_ACTIONS_COUNT > 2', facts({}))).toBe(false);
  });
});
