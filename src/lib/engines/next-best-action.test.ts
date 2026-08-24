import { describe, expect, it } from 'vitest';
import { meetsReadinessGate } from './next-best-action';

describe('meetsReadinessGate', () => {
  it('sin requisitos, siempre pasa', () => {
    expect(meetsReadinessGate({ financialReadinessRequired: null, behavioralReadinessRequired: null }, -1, -1)).toBe(
      true
    );
  });

  it('bloquea una intervención que exige más disposición financiera de la que hay', () => {
    // STRONG=3, el empleado está en CONSTRAINED=1
    expect(
      meetsReadinessGate({ financialReadinessRequired: 'STRONG', behavioralReadinessRequired: null }, 1, -1)
    ).toBe(false);
  });

  it('deja pasar una intervención cuando la disposición del empleado alcanza o supera el requisito', () => {
    expect(
      meetsReadinessGate({ financialReadinessRequired: 'ELIGIBLE', behavioralReadinessRequired: null }, 2, -1)
    ).toBe(true);
    expect(
      meetsReadinessGate({ financialReadinessRequired: 'ELIGIBLE', behavioralReadinessRequired: null }, 3, -1)
    ).toBe(true);
  });

  it('readiness todavía desconocida (-1) bloquea cualquier requisito explícito — regla CORE #13', () => {
    expect(
      meetsReadinessGate({ financialReadinessRequired: null, behavioralReadinessRequired: 'LOW' }, -1, -1)
    ).toBe(false);
  });

  it('exige ambas condiciones cuando la intervención declara los dos requisitos', () => {
    const intervention = { financialReadinessRequired: 'ELIGIBLE' as const, behavioralReadinessRequired: 'HIGH' as const };
    expect(meetsReadinessGate(intervention, 2, 2)).toBe(true); // ELIGIBLE + HIGH: ambos alcanzan
    expect(meetsReadinessGate(intervention, 2, 1)).toBe(false); // financiero ok, conductual no alcanza
    expect(meetsReadinessGate(intervention, 1, 2)).toBe(false); // conductual ok, financiero no alcanza
  });
});
