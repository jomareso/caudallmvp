import { describe, expect, it } from 'vitest';
import { hexToTailwindRgbTriplet } from './tenant-color';

describe('hexToTailwindRgbTriplet', () => {
  it('convierte un hex válido a triplete "R G B"', () => {
    expect(hexToTailwindRgbTriplet('#0F5499')).toBe('15 84 153');
    expect(hexToTailwindRgbTriplet('#FFFFFF')).toBe('255 255 255');
    expect(hexToTailwindRgbTriplet('#000000')).toBe('0 0 0');
  });

  it('acepta minúsculas', () => {
    expect(hexToTailwindRgbTriplet('#0f5499')).toBe('15 84 153');
  });

  it('cae al azul Caudall por defecto cuando no hay valor', () => {
    expect(hexToTailwindRgbTriplet(null)).toBe('15 84 153');
    expect(hexToTailwindRgbTriplet(undefined)).toBe('15 84 153');
    expect(hexToTailwindRgbTriplet('')).toBe('15 84 153');
  });

  it('cae al default con un valor mal formado en vez de romper el render', () => {
    expect(hexToTailwindRgbTriplet('no-un-color')).toBe('15 84 153');
    expect(hexToTailwindRgbTriplet('#ZZZZZZ')).toBe('15 84 153');
    expect(hexToTailwindRgbTriplet('#FFF')).toBe('15 84 153');
  });
});
