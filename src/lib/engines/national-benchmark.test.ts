import { describe, expect, it } from 'vitest';
import { selectComparisonScope, buildCohortWhere, MIN_COHORT_SIZE, INCOME_BAND_TO_RAW_RANGES } from './national-benchmark';
import nationalBenchmark from '../../../prisma/seed-data/national-benchmark.json';

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

// La comparación por Ingresos (ítem 9, auditoría UX) es una aproximación:
// CTX_INCOME_BAND (la pregunta del diagnóstico) y incomeRangeRaw (el
// benchmark, 2021-2024) usan cortes de RD$ distintos. Estos tests no
// validan que la aproximación sea "correcta" (no hay forma de serlo sin
// el ingreso puntual de cada encuestado) — validan que el mapeo esté
// completo y que cada valor apunte a un rango que de verdad existe en el
// benchmark, para que un typo silencioso no vacíe una cohorte entera.
describe('INCOME_BAND_TO_RAW_RANGES', () => {
  const realRawRanges = new Set(
    (nationalBenchmark as { records: { incomeRangeRaw: string | null }[] }).records
      .map((r) => r.incomeRangeRaw)
      .filter((v): v is string => v !== null)
  );

  it('cubre las 7 bandas de ingreso del banco de preguntas (sin DECLINED)', () => {
    expect(Object.keys(INCOME_BAND_TO_RAW_RANGES).sort()).toEqual(
      ['INC_LT_25K', 'INC_25_49K', 'INC_50_74K', 'INC_75_99K', 'INC_100_149K', 'INC_150_199K', 'INC_200K_PLUS'].sort()
    );
  });

  it('cada rango mapeado existe de verdad en el benchmark', () => {
    for (const rawRanges of Object.values(INCOME_BAND_TO_RAW_RANGES)) {
      for (const raw of rawRanges) {
        expect(realRawRanges.has(raw)).toBe(true);
      }
    }
  });

  it('cada rango del benchmark con ingreso (no "No estoy trabajando") se usa exactamente una vez', () => {
    const used = Object.values(INCOME_BAND_TO_RAW_RANGES).flat();
    const withIncome = [...realRawRanges].filter((v) => v !== 'No estoy trabajando');
    expect(used.sort()).toEqual(withIncome.sort());
    expect(new Set(used).size).toBe(used.length);
  });
});
