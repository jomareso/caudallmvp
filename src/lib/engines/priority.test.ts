import { describe, expect, it } from 'vitest';
import { pickMostSevere } from './priority';

describe('pickMostSevere', () => {
  it('CRITICAL es siempre peor que UNMET/PARTIAL/MET, sin importar el score', () => {
    const critical = { state: 'CRITICAL', score: 40 };
    const unmet = { state: 'UNMET', score: 10 };
    expect(pickMostSevere([unmet, critical])).toBe(critical);
  });

  it('a igual estado, desempata por el score más bajo', () => {
    const worse = { state: 'PARTIAL', score: 55 };
    const better = { state: 'PARTIAL', score: 65 };
    expect(pickMostSevere([better, worse])).toBe(worse);
  });

  it('MET es la banda menos severa', () => {
    const met = { state: 'MET', score: 90 };
    const partial = { state: 'PARTIAL', score: 60 };
    expect(pickMostSevere([met, partial])).toBe(partial);
  });
});
