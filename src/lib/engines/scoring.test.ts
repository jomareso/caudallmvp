import { describe, expect, it } from 'vitest';
import { scoreToDimensionState, scoreToProgressTier, weightedAverageExcludingNA } from './scoring';

describe('weightedAverageExcludingNA', () => {
  it('promedia ponderado cuando todo tiene score', () => {
    const result = weightedAverageExcludingNA([
      { key: 'a', score: 100, weight: 45 },
      { key: 'b', score: 50, weight: 35 },
      { key: 'c', score: 0, weight: 20 }
    ]);

    // (100*45 + 50*35 + 0*20) / 100 = 62.5
    expect(result.score).toBeCloseTo(62.5);
    expect(result.includedKeys).toEqual(['a', 'b', 'c']);
    expect(result.excludedKeys).toEqual([]);
  });

  it('excluye entradas N/A y redistribuye el peso proporcionalmente (regla CORE #7)', () => {
    // Deuda es N/A: no debe contar ni como 0 ni como 100, y el resto de las
    // dimensiones deben repartirse su peso.
    const result = weightedAverageExcludingNA([
      { key: 'CONTROL', score: 80, weight: 20 },
      { key: 'RESILIENCE', score: 60, weight: 20 },
      { key: 'DEBT', score: null, weight: 20 },
      { key: 'SAVING', score: 40, weight: 20 },
      { key: 'PLANNING', score: 100, weight: 20 }
    ]);

    // Promedio de las 4 dimensiones aplicables, pesos iguales entre ellas:
    // (80+60+40+100)/4 = 70
    expect(result.score).toBeCloseTo(70);
    expect(result.excludedKeys).toEqual(['DEBT']);
  });

  it('nunca convierte N/A en 100 aunque sea la única entrada excluida', () => {
    const withDebtNA = weightedAverageExcludingNA([
      { key: 'DEBT', score: null, weight: 20 },
      { key: 'OTHER', score: 50, weight: 80 }
    ]);
    expect(withDebtNA.score).toBeCloseTo(50);
    expect(withDebtNA.score).not.toBe(100);
  });

  it('devuelve null si no hay ninguna entrada con datos todavía', () => {
    const result = weightedAverageExcludingNA([
      { key: 'a', score: null, weight: 50 },
      { key: 'b', score: null, weight: 50 }
    ]);
    expect(result.score).toBeNull();
    expect(result.excludedKeys).toEqual(['a', 'b']);
  });

  it('ignora pesos de entradas con score 0 sin tratarlas como N/A', () => {
    const result = weightedAverageExcludingNA([{ key: 'a', score: 0, weight: 100 }]);
    expect(result.score).toBe(0);
    expect(result.excludedKeys).toEqual([]);
  });
});

describe('scoreToDimensionState', () => {
  it('mapea las bandas usadas en el prototipo', () => {
    expect(scoreToDimensionState(95)).toBe('MET');
    expect(scoreToDimensionState(71)).toBe('MET');
    expect(scoreToDimensionState(60)).toBe('PARTIAL');
    expect(scoreToDimensionState(51)).toBe('PARTIAL');
    expect(scoreToDimensionState(40)).toBe('UNMET');
    expect(scoreToDimensionState(31)).toBe('UNMET');
    expect(scoreToDimensionState(10)).toBe('CRITICAL');
  });
});

describe('scoreToProgressTier', () => {
  it('mapea los cortes provisionales de nivel por default (0-40/41-70/71-100)', () => {
    expect(scoreToProgressTier(100)).toBe('HIGH');
    expect(scoreToProgressTier(71)).toBe('HIGH');
    expect(scoreToProgressTier(70)).toBe('MID');
    expect(scoreToProgressTier(41)).toBe('MID');
    expect(scoreToProgressTier(40)).toBe('LOW');
    expect(scoreToProgressTier(0)).toBe('LOW');
  });

  it('respeta cortes configurables distintos (PlatformSettings)', () => {
    const cutoffs = { mid: 30, high: 60 };
    expect(scoreToProgressTier(60, cutoffs)).toBe('HIGH');
    expect(scoreToProgressTier(59, cutoffs)).toBe('MID');
    expect(scoreToProgressTier(30, cutoffs)).toBe('MID');
    expect(scoreToProgressTier(29, cutoffs)).toBe('LOW');
  });
});
