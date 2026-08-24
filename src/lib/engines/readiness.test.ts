import { describe, expect, it } from 'vitest';
import {
  pickWeakestSignal,
  FIN_CAPACITY_TO_READINESS,
  SELF_EFFICACY_TIER,
  INTENTION_TIER,
  PLAN_STAGE_TIER
} from './readiness';

describe('pickWeakestSignal — principio del eslabón más débil', () => {
  it('la señal de tier más bajo manda, aunque las demás sean altas', () => {
    const signals = [
      { code: 'BEH_SELF_EFFICACY=HIGH', tier: 2 },
      { code: 'BEH_INTENTION=WEAK', tier: 0 },
      { code: 'PLAN_STAGE=READY_TO_ACT', tier: 2 }
    ];
    expect(pickWeakestSignal(signals).code).toBe('BEH_INTENTION=WEAK');
  });

  it('con una sola señal, esa es la que manda', () => {
    const signals = [{ code: 'BEH_SELF_EFFICACY=MODERATE', tier: 1 }];
    expect(pickWeakestSignal(signals).code).toBe('BEH_SELF_EFFICACY=MODERATE');
  });
});

describe('mapas de tier — no confundir "sin capacidad" con "capacidad limitada"', () => {
  it('SAV_CAPACITY=NONE nunca debe quedar como ELIGIBLE/STRONG', () => {
    expect(FIN_CAPACITY_TO_READINESS.NONE).toBe('NOT_ELIGIBLE');
  });

  it('LIMITED y CONSTRAINED comparten la misma banda (ambos son "puede pero con restricción")', () => {
    expect(FIN_CAPACITY_TO_READINESS.LIMITED).toBe(FIN_CAPACITY_TO_READINESS.CONSTRAINED);
  });

  it('los 3 tiers conductuales son consistentes en escala (0=bajo, 2=alto)', () => {
    expect(SELF_EFFICACY_TIER.LOW).toBe(0);
    expect(SELF_EFFICACY_TIER.HIGH).toBe(2);
    expect(INTENTION_TIER.NONE).toBe(0);
    expect(INTENTION_TIER.STRONG).toBe(2);
    expect(PLAN_STAGE_TIER.NO_DIRECTION).toBe(0);
    expect(PLAN_STAGE_TIER.MAINTAINING).toBe(2);
  });
});
