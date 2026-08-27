import type { Facts } from './rules';

// Consistency Resolution Engine (spec-v2.md §20).
//
// Tres categorías definidas en la spec:
//   A. USER CONTRADICTION — dos respuestas del propio usuario se
//      contradicen ("no tengo deuda" + "tengo pagos vencidos").
//   B. APPARENT ANOMALY — la combinación es rara pero no imposible
//      (reserva de 6+ meses pero no puede cubrir un imprevisto) y merece
//      investigarse, no descartarse.
//   C. ENGINE QA ERROR — el propio sistema pregunta algo que ya no debería
//      (ej. tasa de deuda cuando DEBT_APPLICABILITY=NONE). Esta categoría
//      NO necesita mecanismo aparte aquí: ya está garantizada
//      estructuralmente por isApplicable() en diagnostic.ts (regla CORE
//      #21 corta TODA la rama de deuda en cuanto DEBT_APPLICABILITY=NONE),
//      así que no hay una condición real de este tipo que detectar en
//      runtime hoy.
//
// Para A y B: el banco maestro YA tiene 3 preguntas de aclaración
// esperando esto (ver banco-maestro-v3.json) — su ASK_IF es literalmente
// "<var> confidence < 0.70 OR CONSISTENCY_FLAG = <flag>":
//   CTRL-13 -> CONSISTENCY_FLAG = CTRL_CASHFLOW_AMBIGUOUS
//   RES-08  -> CONSISTENCY_FLAG = RES_SHOCK_AMBIGUOUS
//   DEBT-09 -> CONSISTENCY_FLAG = DEBT_CAPACITY_AMBIGUOUS
// pero nada calculaba CONSISTENCY_FLAG todavía, así que esa mitad del OR
// nunca se activaba. Este motor detecta la inconsistencia real a partir de
// hechos ya conocidos y setea CONSISTENCY_FLAG — no se inventan preguntas
// nuevas, se conecta lo que el banco ya preveía.
type ConsistencyRule = {
  flag: string;
  category: 'CONTRADICTION' | 'ANOMALY';
  reason: string;
  check: (facts: Facts) => boolean;
};

function stateIn(facts: Facts, variable: string, states: string[]): boolean {
  const state = facts.get(variable)?.state;
  return state !== undefined && states.includes(state);
}

const RULES: ConsistencyRule[] = [
  {
    flag: 'CTRL_CASHFLOW_AMBIGUOUS',
    category: 'ANOMALY',
    reason: 'Margen de flujo alto/positivo declarado junto con pagos que rara vez o nunca se cumplen a tiempo.',
    check: (facts) =>
      stateIn(facts, 'CTRL_CASHFLOW', ['HIGH', 'POSITIVE']) && stateIn(facts, 'CTRL_PAYMENT', ['RARELY', 'NEVER'])
  },
  {
    flag: 'RES_SHOCK_AMBIGUOUS',
    category: 'ANOMALY',
    // Ejemplo B textual de la spec §20: "Reserva 6+ meses + no puede cubrir
    // imprevisto -> investigar liquidez/accesibilidad".
    reason: 'Reserva de cobertura buena/fuerte declarada junto con incapacidad de cubrir un imprevisto.',
    check: (facts) =>
      stateIn(facts, 'RES_COVERAGE', ['GOOD', 'STRONG']) &&
      stateIn(facts, 'RES_SHOCK_CAPACITY', ['UNABLE', 'DEBT_REQUIRED'])
  },
  {
    flag: 'DEBT_CAPACITY_AMBIGUOUS',
    category: 'CONTRADICTION',
    reason: 'Capacidad de pago de deuda declarada cómoda/manejable junto con atrasos recurrentes o actuales.',
    check: (facts) =>
      stateIn(facts, 'DEBT_PAYMENT_CAPACITY', ['COMFORTABLE', 'MANAGEABLE']) &&
      stateIn(facts, 'DEBT_ARREARS', ['RECURRENT', 'CURRENT'])
  }
];

export type ConsistencyFinding = {
  flag: string;
  category: 'CONTRADICTION' | 'ANOMALY';
  reason: string;
};

export function detectConsistencyFindings(facts: Facts): ConsistencyFinding[] {
  return RULES.filter((rule) => rule.check(facts)).map(({ flag, category, reason }) => ({
    flag,
    category,
    reason
  }));
}

// CONSISTENCY_FLAG es una única variable en el banco (no una por hallazgo):
// si hay más de un hallazgo activo a la vez, se expone el primero — en
// cuanto su pregunta de aclaración se responde, esa combinación deja de
// cumplirse y, en la siguiente vuelta, el siguiente hallazgo (si sigue
// activo) toma su lugar. No hace falta más que eso: STOP_ENGINE vuelve a
// llamar a esta función en cada pregunta.
export function applyConsistencyFlags(facts: Facts): Facts {
  const [first] = detectConsistencyFindings(facts);
  if (first) {
    facts.set('CONSISTENCY_FLAG', { state: first.flag, confidenceRatio: 1 });
  }
  return facts;
}
