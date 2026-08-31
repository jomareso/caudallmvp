import { describe, expect, it } from 'vitest';
import {
  GROUP_HIERARCHY,
  calculatePercentile,
  classifyPosition,
  percentileToNaturalFrequency,
  selectableLevels,
  type CtxKey
} from './social-comparison';

describe('calculatePercentile', () => {
  it('sin pares, no hay percentil (no se inventa un dato con muestra vacía)', () => {
    expect(calculatePercentile(70, [])).toBeNull();
  });

  it('por encima de todos los pares, percentil cercano a 100', () => {
    expect(calculatePercentile(90, [50, 60, 70, 80])).toBe(100);
  });

  it('por debajo de todos los pares, percentil cercano a 0', () => {
    expect(calculatePercentile(10, [50, 60, 70, 80])).toBe(0);
  });

  it('un empate exacto con todos los pares da 50 (ni mejor ni peor)', () => {
    expect(calculatePercentile(60, [60, 60, 60, 60])).toBe(50);
  });

  it('a mitad de la distribución, percentil intermedio', () => {
    // 2 de 4 por debajo (50,55), 0 empatados -> 50%
    expect(calculatePercentile(60, [50, 55, 65, 70])).toBe(50);
  });
});

describe('percentileToNaturalFrequency', () => {
  it('redondea al entero más cercano de 10', () => {
    expect(percentileToNaturalFrequency(41)).toBe(4);
    expect(percentileToNaturalFrequency(70)).toBe(7);
  });

  it('nunca baja de 1 (un percentil bajo no es "0 de cada 10")', () => {
    expect(percentileToNaturalFrequency(0)).toBe(1);
    expect(percentileToNaturalFrequency(4)).toBe(1);
  });

  it('nunca sube de 9 (un percentil alto no es "10 de cada 10")', () => {
    expect(percentileToNaturalFrequency(100)).toBe(9);
    expect(percentileToNaturalFrequency(96)).toBe(9);
  });
});

describe('classifyPosition', () => {
  const cutoffs = { superior: 60, inferior: 40 };

  it('percentil en el corte superior o más, es SUPERIOR', () => {
    expect(classifyPosition(60, cutoffs)).toBe('SUPERIOR');
    expect(classifyPosition(85, cutoffs)).toBe('SUPERIOR');
  });

  it('percentil en el corte inferior o menos, es INFERIOR', () => {
    expect(classifyPosition(40, cutoffs)).toBe('INFERIOR');
    expect(classifyPosition(10, cutoffs)).toBe('INFERIOR');
  });

  it('entre los dos cortes, es SIMILAR', () => {
    expect(classifyPosition(50, cutoffs)).toBe('SIMILAR');
  });
});

describe('GROUP_HIERARCHY', () => {
  it('tiene exactamente los 5 niveles del spec, en orden de más a menos específico', () => {
    expect(GROUP_HIERARCHY.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    expect(GROUP_HIERARCHY[0].variables).toEqual(['age', 'income', 'dependents', 'employment', 'sex']);
    expect(GROUP_HIERARCHY[4].variables).toEqual(['income']);
  });

  it('cada nivel es un subconjunto del anterior (nunca agrega una variable nueva al reducir)', () => {
    for (let i = 1; i < GROUP_HIERARCHY.length; i++) {
      const previous = new Set(GROUP_HIERARCHY[i - 1].variables);
      for (const key of GROUP_HIERARCHY[i].variables) {
        expect(previous.has(key)).toBe(true);
      }
    }
  });
});

describe('selectableLevels', () => {
  it('con las 5 variables respondidas, los 5 niveles son alcanzables', () => {
    const answered = new Set<CtxKey>(['age', 'income', 'dependents', 'employment', 'sex']);
    expect(selectableLevels(answered).map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sin sexo, el nivel 1 no es alcanzable pero el resto sí', () => {
    const answered = new Set<CtxKey>(['age', 'income', 'dependents', 'employment']);
    expect(selectableLevels(answered).map((l) => l.level)).toEqual([2, 3, 4, 5]);
  });

  it('solo con ingreso respondido, únicamente el nivel 5 es alcanzable', () => {
    const answered = new Set<CtxKey>(['income']);
    expect(selectableLevels(answered).map((l) => l.level)).toEqual([5]);
  });

  it('sin ingreso, ningún nivel es alcanzable (spec: ingreso es núcleo de todos los niveles)', () => {
    const answered = new Set<CtxKey>(['age', 'sex']);
    expect(selectableLevels(answered)).toEqual([]);
  });
});
