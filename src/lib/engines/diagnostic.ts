import { prisma } from '@/lib/db/prisma';
import type { Question, AnswerOption } from '@prisma/client';
import { evaluateRule, type Facts } from './rules';
import { applyConsistencyFlags } from './consistency';
import { getPlatformSettings } from '@/lib/settings/platform-settings';

// NOTA: la spec (docs/spec-v2.md §22) dice que el banco adaptativo "ya
// existe y ya fue auditado" y que no debe rehacerse desde cero — y ahora sí
// lo tenemos (prisma/seed-data/banco-maestro-v3.json). Lo que hay aquí es
// el intérprete real de ASK_IF/SKIP_IF (src/lib/engines/rules.ts) + el
// selector NBQ (Information Value + Decision Impact + Uncertainty
// Reduction − Redundancy − Burden, spec §22) + el STOP ENGINE (spec §24)
// más abajo — decide cuál preguntar y cuándo ya alcanza.

export type QuestionWithOptions = Question & { answerOptions: AnswerOption[] };

export async function buildFacts(employeeId: string): Promise<Facts> {
  const states = await prisma.variableState.findMany({
    where: { employeeId },
    include: { variable: true }
  });

  const facts: Facts = new Map();
  for (const s of states) {
    const value = s.value as { state?: string } | null;
    if (value?.state) {
      facts.set(s.variable.code, { state: value.state, confidenceRatio: s.confidence / 100 });
    }
  }
  return facts;
}

// Evidence.questionId (a diferencia de VariableState, que vive por
// variable) permite distinguir "esta pregunta puntual ya se respondió"
// aunque otra pregunta distinta haya puesto un valor más reciente en la
// misma variable — necesario para la aclaración de consistencia, que
// reutiliza a propósito el VARIABLE_TARGET de la pregunta original (ver
// getNextQuestion).
async function wasQuestionAnswered(employeeId: string, questionId: string): Promise<boolean> {
  const evidence = await prisma.evidence.findFirst({
    where: { employeeId, questionId },
    select: { id: true }
  });
  return evidence !== null;
}

function isApplicable(question: Question, facts: Facts, debtDimensionId: string | null): boolean {
  // Regla CORE #21: si ya sabemos que no tiene deudas, ninguna pregunta de
  // la dimensión Deuda se vuelve a hacer, sin importar lo que diga su propio
  // ASK_IF — algunas preguntas del banco solo miran "confidence < umbral" en
  // una variable de deuda, y esa confianza es 0 (desconocida) tanto si
  // nunca se preguntó por N/A como si simplemente no se ha llegado ahí
  // todavía. Sin este corte, esas preguntas se "colarían" igual.
  if (debtDimensionId && question.dimensionId === debtDimensionId && facts.get('DEBT_APPLICABILITY')?.state === 'NONE') {
    return false;
  }

  // Las preguntas de contexto (banco v4.1) traen su ASK_IF en inglés llano
  // ("user has not skipped optional context block") en vez de la gramática
  // que evaluateRule() entiende — como cualquier fragmento no reconocido,
  // evaluaría siempre a false y esas 7 preguntas nunca se preguntarían
  // (verificado con una simulación completa). Por eso no se evalúa su
  // ASK_IF de texto libre — su aplicabilidad la decide enteramente el rol
  // (ver getNextContextQuestion) y no esta función.
  if (question.role !== 'CONTEXT') {
    const askIf = question.askIfRule as { raw?: string } | null;
    if (askIf?.raw && !evaluateRule(askIf.raw, facts)) return false;
  }

  const skipIf = question.skipIfRule as { raw?: string } | null;
  if (skipIf?.raw && evaluateRule(skipIf.raw, facts)) return false;

  return true;
}

// GATE (ej. "¿tienes deudas?") siempre debe resolverse antes que preguntas
// ADAPTIVE que dependan de esa respuesta, aunque compartan basePriority —
// vimos en pruebas reales que si no se fuerza este orden, una pregunta de
// deuda podía dispararse antes de saber si la deuda aplica.
//
// CONTEXT queda FUERA de este orden a propósito: ya no es parte de la
// secuencia principal del diagnóstico financiero (ver getNextQuestion),
// sino un bloque aparte, opcional, que se ofrece después — con su propia
// pantalla de transición explicando por qué se pregunta (comparación con
// personas similares) y su propio botón de "ahora no" (ver
// (employee)/diagnostico/contexto/). Antes vivía mezclado en medio de
// FOLLOWUP/BEHAVIORAL sin ninguna explicación ni forma de saltarlo.
const ROLE_ORDER: Record<string, number> = {
  GATE: 0,
  ANCHOR: 1,
  ADAPTIVE: 2,
  FOLLOWUP: 3,
  BEHAVIORAL: 4
};

async function loadBankAndState(employeeId: string) {
  const [bank, facts, answeredVariables, debtDimension] = await Promise.all([
    prisma.questionBank.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        questions: {
          where: { status: 'ACTIVE' },
          include: { answerOptions: true }
        }
      }
    }),
    buildFacts(employeeId),
    prisma.variableState.findMany({ where: { employeeId }, select: { variableId: true } }),
    prisma.dimension.findFirst({ where: { code: 'DEBT' } })
  ]);

  // Consistency Resolution Engine (spec §20) — antes de decidir qué
  // preguntar, se marca CONSISTENCY_FLAG si los hechos ya conocidos son
  // contradictorios o anómalos entre sí (ver consistency.ts). Esto activa
  // las preguntas de aclaración que el propio banco ya tenía previstas
  // para este caso (CTRL-13/RES-08/DEBT-09).
  applyConsistencyFlags(facts);

  return {
    bank,
    facts,
    answeredSet: new Set(answeredVariables.map((v) => v.variableId)),
    debtDimensionId: debtDimension?.id ?? null
  };
}

// NBQ = Information Value + Decision Impact + Uncertainty Reduction −
// Redundancy − Burden (spec §22). "Decision Impact" no es un campo único
// en el banco — se compone de los cuatro que sí existen (scoring/routing/
// safety/rootCause value), cada uno mide cuánto mueve una decisión
// distinta (el score, el routing, una alerta de Safety, la causa raíz).
// "Redundancy" no se resta aparte: ya está cubierta por
// inferenceSubstitutionAllowed/SKIP_IF (una pregunta cuya respuesta ya se
// puede inferir con confianza suficiente ni siquiera llega a ser
// "aplicable", ver isApplicable) — restarla de nuevo aquí la penalizaría
// dos veces. burden es 1-5 en el banco (no 0-1 como el resto de los
// campos); se escala para que pese de forma comparable.
export function nbqScore(q: Question): number {
  return (
    q.informationValue +
    q.scoringValue +
    q.routingValue +
    q.safetyValue +
    q.rootCauseValue +
    q.uncertaintyReduction -
    q.burden * 0.2
  );
}

function sortByRoleThenPriority<T extends Question>(questions: T[]): T[] {
  return [...questions].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    if (roleDiff !== 0) return roleDiff;
    return nbqScore(b) - nbqScore(a);
  });
}

// ---- STOP ENGINE (spec §24) ----
//
// STOP cuando: confianza por dimensión suficiente; no queda condición de
// Safety sin resolver; no queda ninguna pregunta de alto valor sin
// responder; no hay inconsistencia crítica pendiente.
//
// De esas cuatro, la tercera ("no high-value unanswered question") es la
// que de verdad se implementa aquí, y las otras dos primeras quedan
// cubiertas COMO CONSECUENCIA de esa misma regla, sin necesitar lógica
// aparte:
// - Una dimensión con confianza insuficiente todavía tiene preguntas de
//   informationValue/uncertaintyReduction altos sin responder en esa
//   dimensión — por diseño del banco, "confianza suficiente" y "sin
//   preguntas de alto valor" describen la misma condición.
// - Una condición de Safety sin resolver es, en la práctica, una pregunta
//   con safetyValue alto sin responder — está en la MISMA lista que se
//   revisa acá (ver isHighValue), no en una lista aparte.
// La cuarta ("inconsistencia crítica pendiente") SÍ necesita un corte
// aparte, a diferencia de las dos anteriores: applyConsistencyFlags() (ver
// consistency.ts), llamado en loadBankAndState() antes de este punto, deja
// marcado CONSISTENCY_FLAG si hay una inconsistencia real, y eso vuelve
// aplicable la pregunta de aclaración correspondiente del banco — pero esa
// pregunta no siempre alcanza el umbral de "alto valor" por su cuenta (ej.
// CTRL-13 es 0.88/0.70, por debajo de HIGH_VALUE_THRESHOLD=0.9), así que
// getNextQuestion() la prioriza de forma explícita mientras
// CONSISTENCY_FLAG siga activo, antes de aplicar ese umbral.
//
// Los tres límites numéricos (target 8-12, soft max 15, hard max 18) son
// la red de seguridad de la spec: nunca menos de STOP_FLOOR (aunque todo
// ya "parezca" suficiente, según lo de arriba) y nunca más de
// STOP_HARD_MAX (aunque falte confianza). Editables desde
// /admin/metodologia/parametros (PlatformSettings) — global por ahora, no
// por cliente todavía (eso es de una fase posterior). Estas constantes
// quedan como default de referencia (y para tests que no tocan DB);
// getNextQuestion() usa el valor real de la configuración.
export const STOP_FLOOR = 8;
export const STOP_SOFT_MAX = 15;
export const STOP_HARD_MAX = 18;
// El banco real NO usa todo el rango 0..1 de manera pareja — verificado
// contra las 94 preguntas financieras activas: el mínimo de
// informationValue es 0.58 y la mediana 0.84 (GATE/ANCHOR rondan 1.0). Un
// umbral de 0.5 no filtraba nada (las 94 lo pasaban) — se calibró contra
// esa distribución real, no en abstracto.
export const HIGH_VALUE_THRESHOLD = 0.9;
// Pasado el soft max, solo lo verdaderamente importante justifica seguir.
export const HIGH_VALUE_THRESHOLD_SOFT = 0.97;

export function isHighValue(q: Question, threshold: number): boolean {
  return q.informationValue >= threshold || q.safetyValue >= threshold;
}

// Diagnóstico FINANCIERO (GATE/ANCHOR/ADAPTIVE/FOLLOWUP/BEHAVIORAL) — el
// bloque de contexto (CONTEXT) no es parte de esta secuencia, ver
// getNextContextQuestion() más abajo.
export async function getNextQuestion(employeeId: string): Promise<QuestionWithOptions | null> {
  const [{ bank, facts, answeredSet, debtDimensionId }, settings] = await Promise.all([
    loadBankAndState(employeeId),
    getPlatformSettings()
  ]);
  if (!bank) return null;

  const financialQuestions = sortByRoleThenPriority(bank.questions.filter((q) => q.role !== 'CONTEXT'));
  const answeredCount = financialQuestions.filter((q) => answeredSet.has(q.variableTargetId)).length;

  const applicableRemaining = financialQuestions.filter(
    (q) => !answeredSet.has(q.variableTargetId) && isApplicable(q, facts, debtDimensionId)
  );

  // Tope duro: para acá, sin excepción, aunque quede algo de alto valor o
  // una inconsistencia sin aclarar. Se revisa antes que nada porque, a
  // diferencia del resto, también debe cortar la ruta de aclaración de
  // abajo.
  if (answeredCount >= settings.stopHardMax) return null;

  // Consistency Resolution Engine (spec §20): una inconsistencia detectada
  // (ver consistency.ts) se resuelve SIEMPRE antes de parar, sin pasar por
  // el umbral de "alto valor" — no es una pregunta más de alto valor, es
  // su propia condición de STOP, al mismo nivel que el piso mínimo.
  //
  // Esta pregunta de aclaración NO pasa por applicableRemaining a
  // propósito, por dos motivos:
  // 1. Su VARIABLE_TARGET es la MISMA que la pregunta original que generó
  //    la inconsistencia (ej. CTRL-13 vuelve a apuntar a CTRL_CASHFLOW,
  //    igual que CTRL-01) — ya está en answeredSet en cuanto la
  //    inconsistencia es detectable (hacen falta ambos hechos conocidos),
  //    así que el filtro normal de "no respondida" siempre la excluiría.
  // 2. Su propio SKIP_IF ("confidence >= 0.80") también la bloquearía: el
  //    modelo de confianza hoy es binario (0 o 100, ver
  //    diagnostico/actions.ts) y una respuesta directa ya deja
  //    confidence=100 apenas se contesta — justo cuando la inconsistencia
  //    recién se vuelve detectable.
  // Por eso se busca directamente en financialQuestions (sin esos dos
  // filtros) — pero SOLO se ofrece una vez por empleado (ver
  // wasQuestionAnswered): sus propias opciones de respuesta incluyen los
  // mismos valores "ambiguos" que la generaron (ej. DEBT-09 permite
  // responder COMFORTABLE otra vez), así que sin este límite se le
  // volvería a preguntar en cada vuelta si la persona confirma su
  // respuesta original — Regla CORE #13: no exigir más certeza de la
  // necesaria. Una aclaración es suficiente; lo que responda ahí se
  // respeta, aunque la combinación le siga pareciendo atípica al motor.
  const activeConsistencyFlag = facts.get('CONSISTENCY_FLAG')?.state;
  if (activeConsistencyFlag) {
    const clarifying = financialQuestions.find((q) => {
      if (debtDimensionId && q.dimensionId === debtDimensionId && facts.get('DEBT_APPLICABILITY')?.state === 'NONE') {
        return false;
      }
      const raw = (q.askIfRule as { raw?: string } | null)?.raw ?? '';
      return raw.includes(`CONSISTENCY_FLAG = ${activeConsistencyFlag}`);
    });
    if (clarifying && !(await wasQuestionAnswered(employeeId, clarifying.id))) {
      return clarifying;
    }
  }

  if (applicableRemaining.length === 0) return null;

  // Antes del mínimo objetivo, seguimos preguntando lo mejor disponible
  // sin importar si su valor ya bajó del umbral — el piso de la spec
  // manda sobre el criterio de "alto valor".
  if (answeredCount < settings.stopFloor) return applicableRemaining[0];

  const threshold = answeredCount >= settings.stopSoftMax ? settings.highValueThresholdSoft : settings.highValueThreshold;
  const nextHighValue = applicableRemaining.find((q) => isHighValue(q, threshold));

  return nextHighValue ?? null;
}

export async function countAnsweredAndTotal(
  employeeId: string
): Promise<{ answered: number; total: number }> {
  const { bank, facts, answeredSet, debtDimensionId } = await loadBankAndState(employeeId);
  if (!bank) return { answered: 0, total: 0 };

  let answered = 0;
  let total = 0;

  for (const question of bank.questions) {
    if (question.role === 'CONTEXT') continue;
    const wasAnswered = answeredSet.has(question.variableTargetId);
    // Una pregunta ya respondida cuenta siempre, aunque una respuesta
    // posterior haya cambiado su ASK_IF/SKIP_IF — fue alcanzable cuando se
    // contestó. Una sin responder solo cuenta si hoy es aplicable.
    if (!wasAnswered && !isApplicable(question, facts, debtDimensionId)) continue;
    total += 1;
    if (wasAnswered) answered += 1;
  }

  return { answered, total };
}

// Bloque de CONTEXTO — opcional, se ofrece después de terminar el
// diagnóstico financiero (ver (employee)/diagnostico/contexto/). Todas las
// preguntas CONTEXT activas del banco se consideran aplicables (su ASK_IF
// de texto libre no se evalúa, ver isApplicable) — el único filtro real es
// "no respondida todavía".
export async function getNextContextQuestion(employeeId: string): Promise<QuestionWithOptions | null> {
  const { bank, answeredSet } = await loadBankAndState(employeeId);
  if (!bank) return null;

  const contextQuestions = sortByRoleThenPriority(bank.questions.filter((q) => q.role === 'CONTEXT'));
  for (const question of contextQuestions) {
    if (answeredSet.has(question.variableTargetId)) continue;
    return question;
  }

  return null;
}

export async function countContextAnsweredAndTotal(
  employeeId: string
): Promise<{ answered: number; total: number }> {
  const { bank, answeredSet } = await loadBankAndState(employeeId);
  if (!bank) return { answered: 0, total: 0 };

  let answered = 0;
  let total = 0;
  for (const question of bank.questions) {
    if (question.role !== 'CONTEXT') continue;
    total += 1;
    if (answeredSet.has(question.variableTargetId)) answered += 1;
  }

  return { answered, total };
}
