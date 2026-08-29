import { describe, expect, it } from 'vitest';
import { calculateSampleSize } from './sample-size';

describe('calculateSampleSize', () => {
  it('devuelve null sin población (no se ha cargado employeeCount todavía)', () => {
    expect(calculateSampleSize({ populationSize: null, confidenceLevel: 0.95, marginOfError: 0.05 })).toBeNull();
    expect(calculateSampleSize({ populationSize: undefined, confidenceLevel: 0.95, marginOfError: 0.05 })).toBeNull();
    expect(calculateSampleSize({ populationSize: 0, confidenceLevel: 0.95, marginOfError: 0.05 })).toBeNull();
    expect(calculateSampleSize({ populationSize: -10, confidenceLevel: 0.95, marginOfError: 0.05 })).toBeNull();
  });

  it('para una población muy grande, calza con el número de referencia conocido (~385) al 95%/5%', () => {
    const n = calculateSampleSize({ populationSize: 1_000_000, confidenceLevel: 0.95, marginOfError: 0.05 });
    expect(n).not.toBeNull();
    expect(n as number).toBeGreaterThanOrEqual(383);
    expect(n as number).toBeLessThanOrEqual(386);
  });

  it('nunca pide más muestra que la población total', () => {
    const n = calculateSampleSize({ populationSize: 10, confidenceLevel: 0.95, marginOfError: 0.05 });
    expect(n).not.toBeNull();
    expect(n as number).toBeLessThanOrEqual(10);
    // Con una población tan chica frente al n0 de referencia (~384), la
    // corrección por población finita debería pedir casi todos los 10.
    expect(n as number).toBeGreaterThanOrEqual(9);
  });

  it('más confianza exige más muestra, a igual margen de error y población', () => {
    const n90 = calculateSampleSize({ populationSize: 5000, confidenceLevel: 0.9, marginOfError: 0.05 })!;
    const n95 = calculateSampleSize({ populationSize: 5000, confidenceLevel: 0.95, marginOfError: 0.05 })!;
    const n99 = calculateSampleSize({ populationSize: 5000, confidenceLevel: 0.99, marginOfError: 0.05 })!;
    expect(n90).toBeLessThan(n95);
    expect(n95).toBeLessThan(n99);
  });

  it('más margen de error tolerado exige menos muestra, a igual confianza y población', () => {
    const nTight = calculateSampleSize({ populationSize: 5000, confidenceLevel: 0.95, marginOfError: 0.03 })!;
    const nLoose = calculateSampleSize({ populationSize: 5000, confidenceLevel: 0.95, marginOfError: 0.08 })!;
    expect(nLoose).toBeLessThan(nTight);
  });
});
