import { describe, expect, it } from 'vitest';
import { bucketForOrder } from './behavioral-state';

describe('bucketForOrder', () => {
  it('mapeo directo con 4 opciones (R1-R4) — caso más común del banco', () => {
    expect(bucketForOrder(1, 4)).toBe('LOW');
    expect(bucketForOrder(2, 4)).toBe('MODERATE');
    expect(bucketForOrder(3, 4)).toBe('HIGH');
    expect(bucketForOrder(4, 4)).toBe('VERY_HIGH');
  });

  it('mapeo proporcional con 5 opciones (R1-R5) — algunas preguntas del banco usan esta escala', () => {
    expect(bucketForOrder(1, 5)).toBe('LOW');
    expect(bucketForOrder(5, 5)).toBe('VERY_HIGH');
    // R3 de 5 (posición central) cae en HIGH, no en MODERATE — "a veces" es
    // más cercano a HIGH que a "nunca/rara vez" en la escala real del banco.
    expect(bucketForOrder(3, 5)).toBe('HIGH');
  });

  it('una sola opción siempre es LOW (caso borde, no ocurre en el banco real)', () => {
    expect(bucketForOrder(1, 1)).toBe('LOW');
  });
});
