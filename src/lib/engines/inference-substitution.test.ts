import { describe, expect, it } from 'vitest';
import bancoMaestro from '../../../prisma/seed-data/banco-maestro-v3.json';

// Regla CORE #15: "Una inferencia fuerte puede sustituir una pregunta; una
// débil solo orienta routing." materializeInferences() confía en que el
// dato del banco respeta esto (mapea type==='STRONG' a Reliability.
// STRONG_INFERENCE al persistir) — si alguien agrega una regla WEAK con
// canSubstituteQuestion=true por error, este motor la trataría igual que
// una fuerte y saltaría una pregunta con una señal débil, justo lo que la
// regla CORE #15 prohíbe. Este test no ejercita materializeInferences en sí
// (toca DB, como el resto de los engines de orquestación — ver
// safety.test.ts/root-cause.test.ts, cubiertos por e2e en vez de mocks de
// Prisma) — verifica el invariante del que depende.
type InferenceRuleSeed = {
  code: string;
  type: 'STRONG' | 'WEAK';
  canSubstituteQuestion: boolean;
};

const inferenceRules = (bancoMaestro as { inferenceRules: InferenceRuleSeed[] }).inferenceRules;

describe('banco maestro: reglas de inferencia', () => {
  it('trae al menos una regla marcada canSubstituteQuestion', () => {
    expect(inferenceRules.some((r) => r.canSubstituteQuestion)).toBe(true);
  });

  it('ninguna regla WEAK está marcada canSubstituteQuestion=true', () => {
    const offenders = inferenceRules.filter((r) => r.type === 'WEAK' && r.canSubstituteQuestion);
    expect(offenders.map((r) => r.code)).toEqual([]);
  });
});
