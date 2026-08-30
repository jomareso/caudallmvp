// Motor de Comparación Social — spec "MOTOR DE COMPARACIÓN SOCIAL +
// NOTIFICACIÓN POST-DIAGNÓSTICO" (30 secciones, confirmado con Reynoso).
//
// Principio: la comparación CONTEXTUALIZA el resultado, nunca lo decide.
// Nunca modifica CFHI, dimension scores, ni el nivel Explorador/Navegante/
// Capitán (esos ya están calculados cuando este motor corre). Nunca es la
// única señal detrás de la próxima acción — reusa priority.ts y
// next-best-action.ts en vez de redecidir nada.
//
// Reemplaza a national-benchmark.ts (benchmark 2021-2024, gateado por la
// pregunta de consentimiento CTX-07/CTX_COMPARE_OPT_IN). CTX-07 fue
// retirada del banco activo (status RESERVA) porque el nuevo spec prohíbe
// explícitamente una segunda pregunta de consentimiento para comparar: la
// comparación es automática a partir de lo que el empleado ya respondió en
// el bloque de contexto, o se omite en silencio si no hay datos
// suficientes. national-benchmark.ts se deja intacto pero sin uso (no se
// borra código ni datos existentes).
import type { DimensionCode, Prisma } from '@prisma/client';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { getPlatformSettings } from '@/lib/settings/platform-settings';
import { scoreToProgressTier, type ProgressTier } from './scoring';
import { computePriority } from './priority';

// Mientras la base de empleados reales crece, el grupo comparable se
// completa con los Estudios de Salud Financiera 2021-2024
// (NationalBenchmarkRecord, 4,748 encuestas — ver national-benchmark.ts,
// retirado como pantalla propia pero cuyos datos siguen intactos en la
// tabla). Decisión explícita de Reynoso: mezclar ambas fuentes en el
// mismo grupo comparable en vez de esperar a tener volumen real, siempre
// que las variables de agrupación calcen.
//
// sex/dependents/employmentStatus/ageBand del estudio usan los MISMOS
// códigos que CTX_SEX/CTX_DEPENDENTS/CTX_EMPLOYMENT_STATUS/CTX_AGE_BAND
// del banco vivo (verificado 1:1 contra los datos reales) — se pueden
// comparar directo. El ingreso NO: el estudio usa sus propios rangos en
// pesos (instrumento distinto), así que cada rango se asigna a la banda
// INC_* del banco vivo con la que más se superpone (aproximación
// documentada, mismo criterio que los cortes provisionales de
// classifyPosition más abajo). "No estoy trabajando" no es un rango de
// ingreso — queda sin banda, fuera de la comparación por ingreso.
const INCOME_BAND_TO_RAW: Record<string, string[]> = {
  INC_LT_25K: ['Menos de RD$ 13,500', 'RD$ 13,501 -RD$ 27,000'],
  INC_25_49K: ['RD$ 27,001 -RD$ 40,500', 'RD$ 40,501 -RD$ 54,000'],
  INC_50_74K: ['RD$ 54,001 -RD$ 81,000'],
  INC_75_99K: ['RD$ 81,001 -RD$ 108,000'],
  INC_100_149K: ['RD$ 108,001 -RD$ 135,000'],
  INC_150_199K: ['RD$ 135,001 -RD$ 202,500'],
  INC_200K_PLUS: ['Más de RD$ 202,500']
};

// Resiliencia queda fuera a propósito: el instrumento del estudio la
// mezclaba con Ahorro (regla CORE #5, ver también el comentario en el
// modelo NationalBenchmarkRecord) — no hay score real que aportar ahí,
// así que el estudio simplemente no participa en esa comparación.
const DIMENSION_TO_BENCHMARK_FIELD: Partial<Record<DimensionCode, 'controlScore' | 'savingScore' | 'debtScore' | 'planningScore'>> = {
  CONTROL: 'controlScore',
  SAVING: 'savingScore',
  DEBT: 'debtScore',
  PLANNING: 'planningScore'
};

const DIMENSION_CODES: readonly DimensionCode[] = ['CONTROL', 'RESILIENCE', 'DEBT', 'SAVING', 'PLANNING'];
function isDimensionCode(value: string): value is DimensionCode {
  return (DIMENSION_CODES as readonly string[]).includes(value);
}

// Las 5 variables contextuales del MVP (spec §4/§5): estrictamente
// contextuales — nunca puntúan CFHI, nunca deciden dimensión, nivel o
// recomendación. Solo sirven para (a) formar grupos comparables y (b)
// alimentar la segmentación del dashboard RRHH.
export const CTX_VARIABLE_CODES = {
  age: 'CTX_AGE_BAND',
  income: 'CTX_INCOME_BAND',
  dependents: 'CTX_DEPENDENTS',
  employment: 'CTX_EMPLOYMENT_STATUS',
  sex: 'CTX_SEX'
} as const;

export type CtxKey = keyof typeof CTX_VARIABLE_CODES;

export type CtxValues = Partial<Record<CtxKey, string>>;

// Jerarquía de niveles de comparabilidad (spec §8), de más específico a
// menos específico. Exportada como constante documentada — no enterrada en
// lógica anidada — para que sea auditable y quede claro cuál es el orden
// sin tener que leer el cuerpo de una función. Prioriza EDAD+INGRESO como
// núcleo; DEPENDIENTES+SITUACIÓN+SEXO como refinamiento cuando la muestra
// alcanza (spec: "encontrar el grupo comparable más específico posible sin
// sacrificar tamaño de muestra, estabilidad o privacidad").
export const GROUP_HIERARCHY: readonly { level: number; variables: readonly CtxKey[] }[] = [
  { level: 1, variables: ['age', 'income', 'dependents', 'employment', 'sex'] },
  { level: 2, variables: ['age', 'income', 'dependents', 'employment'] },
  { level: 3, variables: ['age', 'income', 'dependents'] },
  { level: 4, variables: ['age', 'income'] },
  { level: 5, variables: ['income'] }
] as const;

export type SocialComparisonPosition = 'SUPERIOR' | 'SIMILAR' | 'INFERIOR';

// Percentil "rank-mid": cuenta los pares estrictamente por debajo más la
// mitad de los empatados, sobre el total de pares (sin incluir al propio
// empleado). Evita que un empate arbitrario decida SUPERIOR vs INFERIOR.
// Pura — sin acceso a datos, fácil de probar (ver social-comparison.test.ts).
export function calculatePercentile(ownScore: number, peerScores: number[]): number | null {
  if (peerScores.length === 0) return null;
  const below = peerScores.filter((s) => s < ownScore).length;
  const equal = peerScores.filter((s) => s === ownScore).length;
  const rank = (below + equal / 2) / peerScores.length;
  return Math.round(rank * 100);
}

// Cortes simples, configurables, documentados como provisionales (spec
// §12: "clasificación con cortes simples, configurables, documentados como
// provisionales"). Editables desde /admin/metodologia/parametros
// (PlatformSettings.socialComparisonSuperiorCutoff/InferiorCutoff).
export function classifyPosition(
  percentile: number,
  cutoffs: { superior: number; inferior: number }
): SocialComparisonPosition {
  if (percentile >= cutoffs.superior) return 'SUPERIOR';
  if (percentile <= cutoffs.inferior) return 'INFERIOR';
  return 'SIMILAR';
}

// De los 5 niveles, cuáles son alcanzables con lo que el empleado
// efectivamente respondió — un nivel que necesita una variable que el
// empleado omitió (saltó el bloque de contexto, o dejó una pregunta sin
// responder) no es candidato, sin importar cuánta gente más haya en la
// plataforma con esa combinación. Pura, se prueba sin DB.
export function selectableLevels(
  answeredKeys: ReadonlySet<CtxKey>
): readonly { level: number; variables: readonly CtxKey[] }[] {
  return GROUP_HIERARCHY.filter((entry) => entry.variables.every((key) => answeredKeys.has(key)));
}

async function getEmployeeCtxValues(
  employeeId: string,
  varIdByKey: Map<CtxKey, string>
): Promise<CtxValues> {
  const variableIds = [...varIdByKey.values()];
  const states = await prisma.variableState.findMany({
    where: { employeeId, variableId: { in: variableIds } },
    select: { variableId: true, state: true }
  });
  const stateByVarId = new Map(states.map((s) => [s.variableId, s.state]));

  const values: CtxValues = {};
  for (const [key, varId] of varIdByKey) {
    const state = stateByVarId.get(varId);
    if (state) values[key] = state;
  }
  return values;
}

// Intersección de empleados que comparten el mismo valor, para cada
// variable del nivel, con el propio empleado — construida variable por
// variable en vez de un único query EAV porque VariableState es una fila
// por (empleado, variable): no hay forma de expresar "N condiciones sobre
// N filas distintas del mismo empleado" en un solo where de Prisma sin SQL
// crudo, y a esta escala (empresas PyME, no millones de filas) intersectar
// sets en memoria es simple, legible y suficientemente rápido.
async function intersectComparableEmployeeIds(
  keys: readonly CtxKey[],
  varIdByKey: Map<CtxKey, string>,
  ownValues: CtxValues
): Promise<Set<string>> {
  let result: Set<string> | null = null;

  for (const key of keys) {
    const variableId = varIdByKey.get(key);
    const targetState = ownValues[key];
    if (!variableId || !targetState) return new Set();

    const rows = await prisma.variableState.findMany({
      where: { variableId, state: targetState },
      select: { employeeId: true }
    });
    const ids = new Set(rows.map((r) => r.employeeId));

    if (result === null) {
      result = ids;
    } else {
      const next = new Set<string>();
      result.forEach((id) => {
        if (ids.has(id)) next.add(id);
      });
      result = next;
    }
    if (result.size === 0) return result;
  }

  return result ?? new Set();
}

const CTX_TO_BENCHMARK_FIELD: Record<Exclude<CtxKey, 'income'>, 'sex' | 'ageBand' | 'dependents' | 'employmentStatus'> = {
  age: 'ageBand',
  dependents: 'dependents',
  employment: 'employmentStatus',
  sex: 'sex'
};

// Devuelve los scores de la dimensión pedida entre los encuestados del
// estudio que calzan con el mismo grupo — null si la dimensión no tiene
// equivalente en el estudio (Resiliencia) o si el ingreso propio no tiene
// banda mapeada (DECLINED, o directamente sin responder). `version` fija
// el estudio más reciente (por si en el futuro se agrega uno nuevo sin
// retirar el actual — hoy solo existe "2021-2024").
async function matchingBenchmarkScores(
  levelKeys: readonly CtxKey[],
  ownValues: CtxValues,
  benchmarkField: 'controlScore' | 'savingScore' | 'debtScore' | 'planningScore',
  version: string
): Promise<number[]> {
  const where: Prisma.NationalBenchmarkRecordWhereInput = { version };

  for (const key of levelKeys) {
    const value = ownValues[key];
    if (!value) return [];

    if (key === 'income') {
      const rawValues = INCOME_BAND_TO_RAW[value];
      if (!rawValues) return [];
      where.incomeRangeRaw = { in: rawValues };
    } else {
      where[CTX_TO_BENCHMARK_FIELD[key]] = value;
    }
  }

  // Ver comentario en computeGroupAverages (national-benchmark.ts):
  // debtScore=100 en el estudio significa "no tenía deuda", no "score
  // perfecto" — confirmado por Reynoso, quien dirigió el estudio. Regla
  // CORE #7 prohíbe tratar Debt N/A como 100; se excluye igual acá.
  if (benchmarkField === 'debtScore') {
    where.debtScore = { not: 100 };
  }

  const records = await prisma.nationalBenchmarkRecord.findMany({ where, select: { [benchmarkField]: true } });
  return records.map((r) => r[benchmarkField]);
}

export type SocialComparisonResult =
  | {
      shown: false;
      reason: 'DISABLED' | 'NO_CONTEXT_DATA' | 'INSUFFICIENT_SAMPLE' | 'NO_PRIORITY_DIMENSION';
      contextVariablesAnswered: CtxKey[];
      contextVariablesOmitted: CtxKey[];
      cfhiScore: number;
      progressTier: ProgressTier;
      priorityDimension: string | null;
    }
  | {
      shown: true;
      groupLevel: number;
      groupVariablesUsed: CtxKey[];
      groupN: number;
      contextVariablesAnswered: CtxKey[];
      contextVariablesOmitted: CtxKey[];
      comparisonDimension: string;
      percentile: number;
      position: SocialComparisonPosition;
      cfhiScore: number;
      progressTier: ProgressTier;
      priorityDimension: string | null;
      // Regla crítica del spec (§13/§14): NUNCA normalizar una conducta
      // desfavorable, y a veces es mejor omitir la comparación numérica por
      // completo en vez de mostrarla en tono de vergüenza. Se resuelve acá,
      // una sola vez, de forma auditable: en posición INFERIOR nunca se
      // arma la frase con percentil/posición — solo REFUERZO + PRÓXIMO
      // PASO (ver post-diagnostic-message.ts, que lee este flag en vez de
      // reinterpretar `position` por su cuenta).
      includeNumericComparison: boolean;
      // Auditoría de qué alimentó esta comparación puntual (spec: "fuente
      // de datos") — LIVE_EMPLOYEES cuando el grupo se completó solo con
      // empleados reales, HISTORICAL_STUDY cuando el estudio 2021-2024
      // fue la única fuente disponible, MIXED cuando ambos aportaron.
      dataSource: 'LIVE_EMPLOYEES' | 'HISTORICAL_STUDY' | 'MIXED';
    };

// Orquestador con acceso a datos. Corre bajo el contexto de tenant de quien
// llama para leer los datos propios del empleado, y abre un contexto
// platform-admin interno (mismo patrón que diagnostic-stats.ts) solo para
// el tramo que necesita mirar más allá del propio tenant: construir el
// grupo comparable con empleados de toda la plataforma. No hay dato
// individual de otra empresa expuesto al llamador — de ese grupo solo
// salen conteos y percentiles agregados.
export async function computeSocialComparison(employeeId: string): Promise<SocialComparisonResult> {
  const settings = await getPlatformSettings();

  const [financialState, priorityResult] = await Promise.all([
    prisma.financialState.findUnique({ where: { employeeId } }),
    computePriority(employeeId)
  ]);

  const cfhiScore = financialState?.cfhiScore ?? 0;
  const progressTier = scoreToProgressTier(cfhiScore, {
    mid: settings.progressTierMidCutoff,
    high: settings.progressTierHighCutoff
  });
  const priorityDimension = priorityResult.dimensionCode;

  const variables = await prisma.variable.findMany({
    where: { code: { in: Object.values(CTX_VARIABLE_CODES) } },
    select: { id: true, code: true }
  });
  const varIdByKey = new Map<CtxKey, string>();
  for (const [key, code] of Object.entries(CTX_VARIABLE_CODES) as [CtxKey, string][]) {
    const found = variables.find((v) => v.code === code);
    if (found) varIdByKey.set(key, found.id);
  }

  const ownValues = await getEmployeeCtxValues(employeeId, varIdByKey);
  const contextVariablesAnswered = (Object.keys(CTX_VARIABLE_CODES) as CtxKey[]).filter((k) => ownValues[k]);
  const contextVariablesOmitted = (Object.keys(CTX_VARIABLE_CODES) as CtxKey[]).filter((k) => !ownValues[k]);

  const baseResult = { contextVariablesAnswered, contextVariablesOmitted, cfhiScore, progressTier, priorityDimension };

  if (!settings.socialComparisonEnabled) {
    return { shown: false, reason: 'DISABLED', ...baseResult };
  }

  // Reusa priority.ts sin redecidirlo (spec: "no re-decide la dimensión
  // prioritaria") — es la dimensión que ya gobierna el próximo paso, así
  // que es la más útil para reforzar con una comparación relevante en vez
  // de mostrar CFHI global o una dimensión al azar.
  if (!priorityDimension) {
    return { shown: false, reason: 'NO_PRIORITY_DIMENSION', ...baseResult };
  }

  const levels = selectableLevels(new Set(contextVariablesAnswered));
  if (levels.length === 0) {
    return { shown: false, reason: 'NO_CONTEXT_DATA', ...baseResult };
  }

  // priorityDimension viene de computePriority(), que a su vez lo lee de
  // filas Dimension reales (ver priority.ts) — si esto alguna vez no
  // resuelve, es un dato inconsistente, no un caso normal de "sin
  // suficiente muestra": se trata igual que "no hay dimensión prioritaria"
  // en vez de seguir con un filtro roto.
  const dimension = isDimensionCode(priorityDimension)
    ? await prisma.dimension.findFirst({ where: { code: priorityDimension } })
    : null;
  if (!dimension) {
    return { shown: false, reason: 'NO_PRIORITY_DIMENSION', ...baseResult };
  }

  // Estudio más reciente disponible (hoy solo existe "2021-2024") — se
  // resuelve una vez acá, no por nivel, porque no cambia entre niveles.
  const latestBenchmark = await prisma.nationalBenchmarkRecord.findFirst({
    select: { version: true },
    orderBy: { createdAt: 'desc' }
  });
  const benchmarkField = isDimensionCode(priorityDimension) ? DIMENSION_TO_BENCHMARK_FIELD[priorityDimension] : undefined;

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    for (const { level, variables: levelKeys } of levels) {
      const candidateIds = await intersectComparableEmployeeIds(levelKeys, varIdByKey, ownValues);

      const historicalScores =
        benchmarkField && latestBenchmark
          ? await matchingBenchmarkScores(levelKeys, ownValues, benchmarkField, latestBenchmark.version)
          : [];

      const completedStates =
        candidateIds.size > 0
          ? await prisma.financialState.findMany({
              where: { employeeId: { in: [...candidateIds] }, lastDiagnosticCompletedAt: { not: null } },
              select: { employeeId: true }
            })
          : [];
      const completedIds = completedStates.map((s) => s.employeeId);

      // Umbral de N sobre el total combinado (empleados reales +
      // encuestados del estudio) — es justo el punto de este cambio:
      // mientras la base de empleados reales es chica, el estudio la
      // completa; cuando ya alcance sola, esto no cambia nada.
      if (completedIds.length + historicalScores.length < settings.socialComparisonMinN) continue;

      const livePeerScores = (
        completedIds.length > 0
          ? await prisma.dimensionScore.findMany({
              where: { employeeId: { in: completedIds }, dimensionId: dimension.id, state: { not: 'NA' } },
              select: { employeeId: true, score: true }
            })
          : []
      )
        .filter((row) => row.employeeId !== employeeId)
        .map((row) => row.score);

      const peerScores = [...livePeerScores, ...historicalScores];

      // El umbral de arriba ya se cumplió con el total combinado; esto
      // solo cubre el caso defensivo de que, tras excluir al propio
      // empleado y los NA de esta dimensión, no quede ningún par real.
      if (peerScores.length === 0) continue;

      const ownDimensionScore = await prisma.dimensionScore.findFirst({
        where: { employeeId, dimensionId: dimension.id }
      });
      if (!ownDimensionScore || ownDimensionScore.state === 'NA') continue;

      const percentile = calculatePercentile(ownDimensionScore.score, peerScores);
      if (percentile == null) continue;

      const position = classifyPosition(percentile, {
        superior: settings.socialComparisonSuperiorCutoff,
        inferior: settings.socialComparisonInferiorCutoff
      });

      const dataSource: 'LIVE_EMPLOYEES' | 'HISTORICAL_STUDY' | 'MIXED' =
        historicalScores.length === 0 ? 'LIVE_EMPLOYEES' : livePeerScores.length === 0 ? 'HISTORICAL_STUDY' : 'MIXED';

      return {
        shown: true,
        groupLevel: level,
        groupVariablesUsed: [...levelKeys],
        groupN: peerScores.length + 1,
        comparisonDimension: priorityDimension,
        percentile,
        position,
        includeNumericComparison: position !== 'INFERIOR',
        dataSource,
        ...baseResult
      };
    }

    return { shown: false, reason: 'INSUFFICIENT_SAMPLE', ...baseResult };
  });
}

// Persiste el snapshot para auditoría/aprendizaje futuro (spec §19: "no
// construir aprendizaje en el MVP, pero sí capturar evidencia"). Se llama
// una sola vez por diagnóstico completado — el llamador (resultado/page.tsx)
// hace el dedup contra el unique([employeeId, completedAt]).
export async function recordSocialComparisonSnapshot(
  employeeId: string,
  completedAt: Date,
  result: SocialComparisonResult
): Promise<void> {
  const shared = {
    employeeId,
    completedAt,
    contextVariablesAnswered: result.contextVariablesAnswered,
    contextVariablesOmitted: result.contextVariablesOmitted,
    cfhiScore: result.cfhiScore,
    progressTier: result.progressTier,
    priorityDimension: result.priorityDimension,
    shown: result.shown
  };

  if (result.shown) {
    await prisma.socialComparisonSnapshot.upsert({
      where: { employeeId_completedAt: { employeeId, completedAt } },
      update: {},
      create: {
        ...shared,
        groupLevel: result.groupLevel,
        groupVariablesUsed: result.groupVariablesUsed,
        groupN: result.groupN,
        comparisonDimension: result.comparisonDimension,
        percentile: result.percentile,
        position: result.position,
        dataSource: result.dataSource
      }
    });
    return;
  }

  await prisma.socialComparisonSnapshot.upsert({
    where: { employeeId_completedAt: { employeeId, completedAt } },
    update: {},
    create: shared
  });
}
