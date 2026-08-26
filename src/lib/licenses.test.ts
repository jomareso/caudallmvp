import { describe, expect, it } from 'vitest';
import { addMonths, generateUniqueLicenseCodes, isLicenseDurationMonths } from './licenses';

describe('isLicenseDurationMonths', () => {
  it('acepta 3, 6 y 12', () => {
    expect(isLicenseDurationMonths(3)).toBe(true);
    expect(isLicenseDurationMonths(6)).toBe(true);
    expect(isLicenseDurationMonths(12)).toBe(true);
  });

  it('rechaza cualquier otro número', () => {
    expect(isLicenseDurationMonths(1)).toBe(false);
    expect(isLicenseDurationMonths(24)).toBe(false);
    expect(isLicenseDurationMonths(0)).toBe(false);
  });
});

describe('addMonths', () => {
  it('suma meses sin mutar la fecha original', () => {
    const original = new Date('2026-01-15T00:00:00.000Z');
    const result = addMonths(original, 6);
    expect(result.getUTCMonth()).toBe(6); // enero (0) + 6 = julio (6)
    expect(original.getUTCMonth()).toBe(0);
  });

  it('cruza de año correctamente (caso real: licencia de 3 meses activada en noviembre)', () => {
    const original = new Date('2026-11-20T00:00:00.000Z');
    const result = addMonths(original, 3);
    expect(result.getUTCFullYear()).toBe(2027);
    expect(result.getUTCMonth()).toBe(1); // febrero
  });
});

describe('generateUniqueLicenseCodes', () => {
  it('genera la cantidad pedida, todos distintos', () => {
    const codes = generateUniqueLicenseCodes(50);
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
  });

  it('no usa caracteres ambiguos (0/O, 1/I)', () => {
    const codes = generateUniqueLicenseCodes(20);
    for (const code of codes) {
      expect(code).not.toMatch(/[01OI]/);
    }
  });
});
