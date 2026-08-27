import { describe, expect, it } from 'vitest';
import { selectComparisonScope, buildCohortWhere, MIN_COHORT_SIZE } from './national-benchmark';

describe('selectComparisonScope', () => {
  it('usa la cohorte cruzada cuando alcanza el mínimo', () => {
    expect(selectComparisonScope(MIN_COHORT_SIZE)).toBe('COHORT');
    expect(selectComparisonScope(MIN_COHORT_SIZE + 50)).toBe('COHORT');
  });

  it('cae al promedio nacional cuando la cohorte es demasiado chica', () => {
    expect(selectComparisonScope(MIN_COHORT_SIZE - 1)).toBe('NATIONAL');
    expect(selectComparisonScope(0)).toBe('NATIONAL');
  });
});

describe('buildCohortWhere', () => {
  it('incluye solo los hechos conocidos y no declinados', () => {
    expect(buildCohortWhere({ sex: 'MALE', ageBand: 'AGE_25_34', employmentStatus: 'PRIVATE_EMPLOYEE' })).toEqual({
      sex: 'MALE',
      ageBand: 'AGE_25_34',
      employmentStatus: 'PRIVATE_EMPLOYEE'
    });
  });

  it('omite lo que el empleado prefirió no responder', () => {
    expect(buildCohortWhere({ sex: 'DECLINED', ageBand: 'AGE_25_34' })).toEqual({ ageBand: 'AGE_25_34' });
  });

  it('omite lo que todavía no respondió', () => {
    expect(buildCohortWhere({ sex: 'MALE' })).toEqual({ sex: 'MALE' });
  });

  it('objeto vacío cuando no hay ningún hecho', () => {
    expect(buildCohortWhere({})).toEqual({});
  });
});
