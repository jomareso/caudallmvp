import { describe, expect, it } from 'vitest';
import { DIMENSION_VARIABLE_PREFIX } from './cfhi';
import { weightedAverageExcludingNA } from './scoring';

describe('DIMENSION_VARIABLE_PREFIX', () => {
  // Bug real encontrado al verificar el motor manualmente: Dimension.code
  // (CONTROL/RESILIENCE/...) NO es el mismo prefijo que usan sus variables
  // en el Banco Maestro (CTRL/RES/...) — sin este mapeo, syncDimensionStateFacts
  // buscaba "CONTROL_STATE" (no existe) en vez de "CTRL_STATE" (sí existe) y
  // nunca escribía nada, dejando el motor de reglas ciego a estas variables.
  it('mapea cada código de dimensión al prefijo real de sus variables', () => {
    expect(DIMENSION_VARIABLE_PREFIX).toEqual({
      CONTROL: 'CTRL',
      RESILIENCE: 'RES',
      DEBT: 'DEBT',
      SAVING: 'SAV',
      PLANNING: 'PLAN'
    });
  });
});

describe('weightedAverageExcludingNA (usado por dimensión y CFHI)', () => {
  it('excluye N/A del denominador y redistribuye peso — regla CORE #7', () => {
    const result = weightedAverageExcludingNA([
      { key: 'CONTROL', score: 80, weight: 20 },
      { key: 'DEBT', score: null, weight: 20 },
      { key: 'SAVING', score: 60, weight: 20 }
    ]);
    // (80*20 + 60*20) / (20+20) = 70, no (80*20+60*20)/60
    expect(result.score).toBe(70);
    expect(result.excludedKeys).toEqual(['DEBT']);
  });

  it('sin nada respondido todavía, no confunde "sin datos" con score 0', () => {
    const result = weightedAverageExcludingNA([{ key: 'CONTROL', score: null, weight: 20 }]);
    expect(result.score).toBeNull();
  });
});
