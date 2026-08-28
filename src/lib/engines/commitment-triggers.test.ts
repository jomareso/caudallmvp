import { describe, expect, it } from 'vitest';
import { COMMITMENT_TRIGGERS, isCommitmentTrigger } from './commitment-triggers';

describe('isCommitmentTrigger', () => {
  it('acepta cualquier código real del catálogo', () => {
    for (const trigger of COMMITMENT_TRIGGERS) {
      expect(isCommitmentTrigger(trigger)).toBe(true);
    }
  });

  it('rechaza un valor arbitrario del cliente — commitToAction no debe confiar en el input sin validar', () => {
    expect(isCommitmentTrigger('CUALQUIER_COSA')).toBe(false);
    expect(isCommitmentTrigger('')).toBe(false);
  });
});
