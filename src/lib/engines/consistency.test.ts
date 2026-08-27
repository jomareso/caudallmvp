import { describe, expect, it } from 'vitest';
import type { Facts } from './rules';
import { detectConsistencyFindings, applyConsistencyFlags } from './consistency';

function facts(entries: Record<string, string>): Facts {
  const map: Facts = new Map();
  for (const [key, state] of Object.entries(entries)) {
    map.set(key, { state, confidenceRatio: 1 });
  }
  return map;
}

describe('detectConsistencyFindings', () => {
  it('no encuentra nada cuando los hechos no chocan entre sí', () => {
    const f = facts({ CTRL_CASHFLOW: 'NEGATIVE', CTRL_PAYMENT: 'RARELY' });
    expect(detectConsistencyFindings(f)).toEqual([]);
  });

  it('detecta margen alto/positivo junto con pagos que rara vez se cumplen a tiempo (CTRL_CASHFLOW_AMBIGUOUS)', () => {
    const f = facts({ CTRL_CASHFLOW: 'HIGH', CTRL_PAYMENT: 'NEVER' });
    const findings = detectConsistencyFindings(f);
    expect(findings).toHaveLength(1);
    expect(findings[0].flag).toBe('CTRL_CASHFLOW_AMBIGUOUS');
    expect(findings[0].category).toBe('ANOMALY');
  });

  it('detecta reserva 6+ meses junto con incapacidad de cubrir un imprevisto (RES_SHOCK_AMBIGUOUS) — spec §20 ejemplo B', () => {
    const f = facts({ RES_COVERAGE: 'STRONG', RES_SHOCK_CAPACITY: 'UNABLE' });
    const findings = detectConsistencyFindings(f);
    expect(findings).toHaveLength(1);
    expect(findings[0].flag).toBe('RES_SHOCK_AMBIGUOUS');
  });

  it('detecta capacidad de pago cómoda junto con atrasos recurrentes (DEBT_CAPACITY_AMBIGUOUS) — spec §20 ejemplo A', () => {
    const f = facts({ DEBT_PAYMENT_CAPACITY: 'COMFORTABLE', DEBT_ARREARS: 'RECURRENT' });
    const findings = detectConsistencyFindings(f);
    expect(findings).toHaveLength(1);
    expect(findings[0].flag).toBe('DEBT_CAPACITY_AMBIGUOUS');
    expect(findings[0].category).toBe('CONTRADICTION');
  });

  it('no dispara con solo una mitad de la combinación presente', () => {
    const f = facts({ RES_COVERAGE: 'STRONG' });
    expect(detectConsistencyFindings(f)).toEqual([]);
  });
});

describe('applyConsistencyFlags', () => {
  it('deja el mapa de facts intacto si no hay hallazgos', () => {
    const f = facts({ CTRL_CASHFLOW: 'NEGATIVE' });
    applyConsistencyFlags(f);
    expect(f.has('CONSISTENCY_FLAG')).toBe(false);
  });

  it('setea CONSISTENCY_FLAG con el flag detectado para que el banco lo pueda leer', () => {
    const f = facts({ DEBT_PAYMENT_CAPACITY: 'MANAGEABLE', DEBT_ARREARS: 'CURRENT' });
    applyConsistencyFlags(f);
    expect(f.get('CONSISTENCY_FLAG')?.state).toBe('DEBT_CAPACITY_AMBIGUOUS');
  });
});
