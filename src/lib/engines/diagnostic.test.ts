import { describe, expect, it } from 'vitest';
import type { Question } from '@prisma/client';
import { nbqScore, isHighValue, HIGH_VALUE_THRESHOLD, HIGH_VALUE_THRESHOLD_SOFT } from './diagnostic';

function q(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    bankId: 'bank1',
    code: 'TEST-01',
    textI18nKey: 'k',
    dimensionId: null,
    variableTargetId: 'v1',
    constructTargetId: null,
    role: 'ADAPTIVE',
    whyAskI18nKey: null,
    askIfRule: null,
    skipIfRule: null,
    doNotAskIfRule: null,
    basePriority: 50,
    informationValue: 0.5,
    safetyValue: 0.0,
    scoringValue: 0.5,
    routingValue: 0.5,
    rootCauseValue: 0.0,
    uncertaintyReduction: 0.5,
    burden: 3,
    inferenceSubstitutionAllowed: true,
    minConfidenceToSkip: 80,
    frictionTargetCode: null,
    aiRegenerationAllowed: true,
    coreLogicEditable: true,
    benchmarkSource: null,
    methodologicalFunction: null,
    behavioralConstructCode: null,
    status: 'ACTIVE',
    ...overrides
  } as Question;
}

describe('nbqScore', () => {
  it('suma los cinco valores de impacto/información/incertidumbre, sin duplicar redundancia', () => {
    const question = q({
      informationValue: 0.6,
      scoringValue: 0.4,
      routingValue: 0.2,
      safetyValue: 0.1,
      rootCauseValue: 0.3,
      uncertaintyReduction: 0.5,
      burden: 0
    });
    expect(nbqScore(question)).toBeCloseTo(0.6 + 0.4 + 0.2 + 0.1 + 0.3 + 0.5);
  });

  it('una pregunta más pesada (mayor burden) puntúa más bajo que una igual de valiosa pero liviana', () => {
    const liviana = q({ burden: 1 });
    const pesada = q({ burden: 5 });
    expect(nbqScore(liviana)).toBeGreaterThan(nbqScore(pesada));
  });

  it('a igual burden, más valor de información gana', () => {
    const alta = q({ informationValue: 0.9 });
    const baja = q({ informationValue: 0.1 });
    expect(nbqScore(alta)).toBeGreaterThan(nbqScore(baja));
  });
});

describe('isHighValue', () => {
  it('es de alto valor si su informationValue alcanza el umbral, aunque no aporte a Safety', () => {
    const question = q({ informationValue: HIGH_VALUE_THRESHOLD, safetyValue: 0 });
    expect(isHighValue(question, HIGH_VALUE_THRESHOLD)).toBe(true);
  });

  it('es de alto valor si su safetyValue alcanza el umbral, aunque su informationValue sea bajo', () => {
    // Regla CORE #14: Safety puede modificar prioridad sin que el score lo
    // reconozca — acá, una pregunta de bajo valor "normal" sigue
    // considerándose importante si toca Safety.
    const question = q({ informationValue: 0.1, safetyValue: HIGH_VALUE_THRESHOLD });
    expect(isHighValue(question, HIGH_VALUE_THRESHOLD)).toBe(true);
  });

  it('no es de alto valor si ninguno de los dos llega al umbral', () => {
    const question = q({ informationValue: HIGH_VALUE_THRESHOLD - 0.2, safetyValue: HIGH_VALUE_THRESHOLD - 0.3 });
    expect(isHighValue(question, HIGH_VALUE_THRESHOLD)).toBe(false);
  });

  it('el umbral "soft" (pasado el soft max) es más exigente que el normal', () => {
    // Una pregunta que calificaba como alto valor bajo el umbral normal
    // deja de calificar bajo el umbral más estricto post soft-max — así
    // es como el STOP ENGINE se vuelve más selectivo entre las preguntas
    // 15 y 18.
    const question = q({ informationValue: HIGH_VALUE_THRESHOLD, safetyValue: 0 });
    expect(isHighValue(question, HIGH_VALUE_THRESHOLD)).toBe(true);
    expect(isHighValue(question, HIGH_VALUE_THRESHOLD_SOFT)).toBe(false);
  });
});
