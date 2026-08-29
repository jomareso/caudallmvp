import { describe, expect, it } from 'vitest';
import { meetsReadinessGate, normalizeFriction } from './next-best-action';

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

describe('normalizeFriction', () => {
  // BEH-05/06/07/08 (preguntas de refinamiento) devuelven variantes de
  // intensidad que antes nunca calzaban contra el behavioralTechniqueCode
  // de ninguna intervención — bug real encontrado auditando la fase de
  // empleado (29 ago).
  it('normaliza las variantes _MODERATE/HIGH_ a la fricción base con contenido cargado', () => {
    expect(normalizeFriction('PROCRASTINATION_MODERATE')).toBe('PROCRASTINATION');
    expect(normalizeFriction('FORGETTING_MODERATE')).toBe('FORGETTING');
    expect(normalizeFriction('HIGH_COMPLEXITY')).toBe('COMPLEXITY');
    expect(normalizeFriction('CHOICE_OVERLOAD_MODERATE')).toBe('TOO_MANY_CHOICES');
  });

  it('deja pasar sin cambios un estado ya canónico', () => {
    expect(normalizeFriction('PROCRASTINATION')).toBe('PROCRASTINATION');
    expect(normalizeFriction('NONE')).toBe('NONE');
  });

  it('LOW_COMPLEXITY queda sin mapear a propósito — señal débil, no justifica forzar la intervención (CORE #13)', () => {
    expect(normalizeFriction('LOW_COMPLEXITY')).toBe('LOW_COMPLEXITY');
  });

  it('un código de fricción sin contenido cargado (ej. LACK_OF_SYSTEM) pasa intacto y cae al fallback', () => {
    expect(normalizeFriction('LACK_OF_SYSTEM')).toBe('LACK_OF_SYSTEM');
  });
});
