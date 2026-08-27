import { Prisma, VersionStatus } from '@prisma/client';
import type { DimensionCode, QuestionRole, InferenceType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import bancoMaestro from '../../../prisma/seed-data/banco-maestro-v3.json';

// Lógica compartida entre prisma/seed.ts (CLI, para desarrollo local) y el
// botón "Sincronizar banco de preguntas" en /admin/configuracion (para
// producción) — ambos deben aplicar exactamente lo mismo, por eso vive acá
// y no duplicada. Solo cubre el Banco Maestro (constructos, variables,
// preguntas+opciones, reglas de inferencia, QA, técnicas conductuales,
// mapa de sesgos): el catálogo de intervenciones, el tenant demo y el
// admin fundador son bootstrap de una sola vez, no contenido que la
// fundadora actualice seguido — esos se quedan solo en seed.ts.
//
// Corre como server action en producción (Netlify), no como script de
// CLI — con ~2000 filas totales, hacerlo con un upsert de Prisma por fila
// (como hacía la primera versión, correcta pero lenta) tarda minutos
// contra la latencia real de Neon y se pasa del límite de una función
// serverless síncrona. Por eso los bloques grandes (constructos,
// variables, preguntas, opciones) usan INSERT ... ON CONFLICT en lote
// (una sola consulta por tabla) en vez de un round-trip por fila.

const CORE_DIMENSIONS: { code: DimensionCode; weight: number }[] = [
  { code: 'CONTROL', weight: 20 },
  { code: 'RESILIENCE', weight: 20 },
  { code: 'DEBT', weight: 20 },
  { code: 'SAVING', weight: 20 },
  { code: 'PLANNING', weight: 20 }
];

function toQuestionRole(raw: string): QuestionRole {
  const known: QuestionRole[] = ['ANCHOR', 'ADAPTIVE', 'GATE', 'BEHAVIORAL', 'CONTEXT', 'FOLLOWUP'];
  return (known as string[]).includes(raw) ? (raw as QuestionRole) : 'ADAPTIVE';
}

// El banco v3.6 introduce ítems "reserve" (variantes de respaldo de un
// sesgo conductual, solo por si el ítem primario/confirmatorio no encaja
// en el contexto) marcados DRAFT en el Excel — no deben ofrecerse en un
// diagnóstico real todavía. loadBankAndState() ya filtra por
// `status: 'ACTIVE'`, así que basta con no forzar ACTIVE a todo: cualquier
// valor que no sea el "ACTIVA" del Excel se trata como DRAFT (por defecto
// seguro, igual que toQuestionRole).
function toQuestionStatus(raw: string): VersionStatus {
  return raw === 'ACTIVA' ? VersionStatus.ACTIVE : VersionStatus.DRAFT;
}

function jsonb(value: unknown): Prisma.Sql {
  if (value === null || value === undefined) return Prisma.sql`NULL`;
  return Prisma.sql`${JSON.stringify(value)}::jsonb`;
}

export type SyncBancoMaestroSummary = {
  methodologyVersion: string;
  questionBankVersion: string;
  constructs: number;
  variables: number;
  questionsActive: number;
  questionsDraft: number;
  questionsSkipped: string[];
  inferenceRules: number;
  forbiddenInferences: number;
  qaScenarios: number;
  behavioralTechniques: number;
  behavioralBiasMap: number;
};

export async function syncBancoMaestro(prisma: PrismaClient): Promise<SyncBancoMaestroSummary> {
  const methodology = await prisma.methodology.upsert({
    where: { version: bancoMaestro.methodologyVersion },
    update: { status: VersionStatus.ACTIVE, publishedAt: new Date() },
    create: { version: bancoMaestro.methodologyVersion, status: VersionStatus.ACTIVE, publishedAt: new Date() }
  });

  const dimensionIdByCode = new Map<string, string>();
  for (const d of CORE_DIMENSIONS) {
    const dimension = await prisma.dimension.upsert({
      where: { methodologyId_code: { methodologyId: methodology.id, code: d.code } },
      update: { weight: d.weight },
      create: {
        methodologyId: methodology.id,
        code: d.code,
        nameI18nKey: `diagnostic.dimensions.${d.code}`,
        descriptionI18nKey: `diagnostic.dimensions.descriptions.${d.code}`,
        weight: d.weight
      }
    });
    dimensionIdByCode.set(d.code, dimension.id);
  }

  // ---- Constructos (lote) ----
  if (bancoMaestro.constructs.length > 0) {
    const rows = bancoMaestro.constructs.map((c) => {
      const dimensionId = c.dimension ? dimensionIdByCode.get(c.dimension) ?? null : null;
      return Prisma.sql`(${`c_${randomUUID()}`}, ${dimensionId}, ${c.code}, ${`admin.constructs.${c.code}.name`}, ${c.weightWithinDimension}, ${c.contributesToCfhi})`;
    });
    await prisma.$executeRaw`
      INSERT INTO constructs (id, "dimensionId", code, "nameI18nKey", "weightWithinDimension", "contributesToCfhi")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT (code) DO UPDATE SET
        "dimensionId" = EXCLUDED."dimensionId",
        "nameI18nKey" = EXCLUDED."nameI18nKey",
        "weightWithinDimension" = EXCLUDED."weightWithinDimension",
        "contributesToCfhi" = EXCLUDED."contributesToCfhi"
    `;
  }

  const constructIdByCode = new Map(
    (await prisma.construct.findMany({ select: { id: true, code: true } })).map((c) => [c.code, c.id])
  );

  // ---- Variables (lote) ----
  if (bancoMaestro.variables.length > 0) {
    const rows = bancoMaestro.variables.map((v) => {
      const dimensionId = v.dimension ? dimensionIdByCode.get(v.dimension) ?? null : null;
      const primaryOwnerConstructId = v.construct ? constructIdByCode.get(v.construct) ?? null : null;
      const variableType = v.rawType?.startsWith('SCORE')
        ? 'SCORE'
        : v.rawType === 'CONTEXT' || v.rawType === 'CONTEXT/BEHAVIORAL'
          ? 'CONTEXT'
          : v.rawType === 'BEHAVIORAL'
            ? 'BEHAVIORAL'
            : v.rawType === 'DERIVED'
              ? 'DERIVED'
              : 'CONTEXT';
      return Prisma.sql`(${`v_${randomUUID()}`}, ${v.code}, ${variableType}::"VariableType", ${dimensionId}, ${jsonb(v.states)}, ${primaryOwnerConstructId}, ${v.rawType}, ${v.affectsCfhiNote})`;
    });
    await prisma.$executeRaw`
      INSERT INTO variables (id, code, "variableType", "dimensionId", "possibleStates", "primaryOwnerConstructId", "rawType", "affectsCfhiNote")
      VALUES ${Prisma.join(rows)}
      ON CONFLICT (code) DO UPDATE SET
        "variableType" = EXCLUDED."variableType",
        "dimensionId" = EXCLUDED."dimensionId",
        "possibleStates" = EXCLUDED."possibleStates",
        "primaryOwnerConstructId" = EXCLUDED."primaryOwnerConstructId",
        "rawType" = EXCLUDED."rawType",
        "affectsCfhiNote" = EXCLUDED."affectsCfhiNote"
    `;
  }

  const variableIdByCode = new Map(
    (await prisma.variable.findMany({ select: { id: true, code: true } })).map((v) => [v.code, v.id])
  );

  // ---- Banco de preguntas ----
  const questionBank = await prisma.questionBank.upsert({
    where: { version: bancoMaestro.questionBankVersion },
    update: { status: VersionStatus.ACTIVE },
    create: { version: bancoMaestro.questionBankVersion, status: VersionStatus.ACTIVE }
  });

  let questionsActive = 0;
  let questionsDraft = 0;
  const questionsSkipped: string[] = [];
  const loadableQuestions = bancoMaestro.questions.filter((q) => {
    if (variableIdByCode.has(q.variable)) return true;
    questionsSkipped.push(q.id);
    return false;
  });

  if (loadableQuestions.length > 0) {
    const rows = loadableQuestions.map((q) => {
      const dimensionId = q.dimension ? dimensionIdByCode.get(q.dimension) ?? null : null;
      const variableId = variableIdByCode.get(q.variable)!;
      const constructId = q.construct ? constructIdByCode.get(q.construct) ?? null : null;
      const status = toQuestionStatus(q.status);
      if (status === VersionStatus.ACTIVE) questionsActive += 1;
      else questionsDraft += 1;

      return Prisma.sql`(
        ${`q_${randomUUID()}`}, ${questionBank.id}, ${q.id}, ${`diagnostic.questions.${q.id}.text`},
        ${dimensionId}, ${variableId}, ${constructId}, ${toQuestionRole(q.role)}::"QuestionRole",
        ${q.whyAsk ? `diagnostic.questions.${q.id}.whyAsk` : null},
        ${jsonb(q.askIfRaw ? { raw: q.askIfRaw } : null)}, ${jsonb(q.skipIfRaw ? { raw: q.skipIfRaw } : null)},
        ${q.basePriority}, ${q.informationValue ?? 0.5}, ${q.safetyValue ?? 0}, ${q.scoringValue ?? 0.5},
        ${q.routingValue ?? 0.5}, ${q.rootCauseValue ?? 0}, ${q.uncertaintyReduction ?? 0.5}, ${q.burden},
        ${q.inferenceSubstitutionAllowed}, ${q.minConfidenceToSkip}, ${q.frictionTarget},
        ${q.aiRegenerationAllowed}, ${q.coreLogicEditable}, ${q.benchmarkSource}, ${q.methodologicalFunction},
        ${q.behavioralConstruct}, ${status}::"VersionStatus"
      )`;
    });

    await prisma.$executeRaw`
      INSERT INTO questions (
        id, "bankId", code, "textI18nKey", "dimensionId", "variableTargetId", "constructTargetId", role,
        "whyAskI18nKey", "askIfRule", "skipIfRule", "basePriority", "informationValue", "safetyValue",
        "scoringValue", "routingValue", "rootCauseValue", "uncertaintyReduction", burden,
        "inferenceSubstitutionAllowed", "minConfidenceToSkip", "frictionTargetCode", "aiRegenerationAllowed",
        "coreLogicEditable", "benchmarkSource", "methodologicalFunction", "behavioralConstructCode", status
      )
      VALUES ${Prisma.join(rows)}
      ON CONFLICT ("bankId", code) DO UPDATE SET
        "textI18nKey" = EXCLUDED."textI18nKey", "dimensionId" = EXCLUDED."dimensionId",
        "variableTargetId" = EXCLUDED."variableTargetId", "constructTargetId" = EXCLUDED."constructTargetId",
        role = EXCLUDED.role, "whyAskI18nKey" = EXCLUDED."whyAskI18nKey", "askIfRule" = EXCLUDED."askIfRule",
        "skipIfRule" = EXCLUDED."skipIfRule", "basePriority" = EXCLUDED."basePriority",
        "informationValue" = EXCLUDED."informationValue", "safetyValue" = EXCLUDED."safetyValue",
        "scoringValue" = EXCLUDED."scoringValue", "routingValue" = EXCLUDED."routingValue",
        "rootCauseValue" = EXCLUDED."rootCauseValue", "uncertaintyReduction" = EXCLUDED."uncertaintyReduction",
        burden = EXCLUDED.burden, "inferenceSubstitutionAllowed" = EXCLUDED."inferenceSubstitutionAllowed",
        "minConfidenceToSkip" = EXCLUDED."minConfidenceToSkip", "frictionTargetCode" = EXCLUDED."frictionTargetCode",
        "aiRegenerationAllowed" = EXCLUDED."aiRegenerationAllowed", "coreLogicEditable" = EXCLUDED."coreLogicEditable",
        "benchmarkSource" = EXCLUDED."benchmarkSource", "methodologicalFunction" = EXCLUDED."methodologicalFunction",
        "behavioralConstructCode" = EXCLUDED."behavioralConstructCode", status = EXCLUDED.status
    `;
  }

  // ---- Opciones: reemplazo completo por pregunta (lote) ----
  const questionIdByCode = new Map(
    (await prisma.question.findMany({ where: { bankId: questionBank.id }, select: { id: true, code: true } })).map(
      (q) => [q.code, q.id]
    )
  );

  const loadableQuestionIds = loadableQuestions.map((q) => questionIdByCode.get(q.id)).filter((id): id is string => Boolean(id));
  if (loadableQuestionIds.length > 0) {
    await prisma.answerOption.deleteMany({ where: { questionId: { in: loadableQuestionIds } } });
  }

  const optionRows = loadableQuestions.flatMap((q) => {
    const questionId = questionIdByCode.get(q.id);
    if (!questionId) return [];
    return q.options.map((o) => {
      const evidenceProduced = {
        variableCode: q.variable,
        state: o.state,
        ...(typeof o.score === 'number' ? { score: o.score } : {})
      };
      return Prisma.sql`(
        ${`opt_${randomUUID()}`}, ${questionId}, ${o.order}, ${`diagnostic.questions.${q.id}.options.${o.state}`},
        ${jsonb(evidenceProduced)}, ${o.secondaryUpdates}, ${o.friction}, ${o.nextCandidates}, ${o.notes}
      )`;
    });
  });

  if (optionRows.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO answer_options (
        id, "questionId", "order", "textI18nKey", "evidenceProduced", "secondaryUpdatesNote", "frictionCode",
        "nextCandidatesRaw", notes
      )
      VALUES ${Prisma.join(optionRows)}
    `;
  }

  // ---- Inferencias prohibidas y permitidas (pocas filas, upsert simple) ----
  for (const f of bancoMaestro.forbiddenInferences) {
    await prisma.forbiddenInference.upsert({
      where: {
        sourceVariableCode_sourceValue_targetVariableCode_targetValue: {
          sourceVariableCode: f.sourceVariableCode,
          sourceValue: f.sourceValue,
          targetVariableCode: f.targetVariableCode,
          targetValue: f.targetValue
        }
      },
      update: { reason: f.reason },
      create: {
        sourceVariableCode: f.sourceVariableCode,
        sourceValue: f.sourceValue,
        targetVariableCode: f.targetVariableCode,
        targetValue: f.targetValue,
        reason: f.reason
      }
    });
  }

  for (const inf of bancoMaestro.inferenceRules) {
    await prisma.inferenceRule.upsert({
      where: { code: inf.code },
      update: {
        type: inf.type as InferenceType,
        sourceConditionRaw: inf.sourceConditionRaw,
        targetVariableCode: inf.targetVariableCode,
        targetValue: inf.targetValue,
        confidence: inf.confidence,
        canSubstituteQuestion: inf.canSubstituteQuestion,
        affectedQuestionCodes: inf.affectedQuestionCodes,
        notes: inf.notes
      },
      create: {
        code: inf.code,
        type: inf.type as InferenceType,
        sourceConditionRaw: inf.sourceConditionRaw,
        targetVariableCode: inf.targetVariableCode,
        targetValue: inf.targetValue,
        confidence: inf.confidence,
        canSubstituteQuestion: inf.canSubstituteQuestion,
        affectedQuestionCodes: inf.affectedQuestionCodes,
        notes: inf.notes
      }
    });
  }

  // ---- QA, técnicas conductuales, mapa de sesgos: se reemplazan completos ----
  await prisma.methodologyQaScenario.deleteMany({});
  await prisma.methodologyQaScenario.createMany({
    data: bancoMaestro.qaScenarios.map((qa) => ({
      code: qa.code,
      scenario: qa.scenario,
      precondition: qa.precondition,
      expectedResult: qa.expectedResult,
      severity: qa.severity
    }))
  });

  await prisma.behavioralTechnique.deleteMany({});
  await prisma.behavioralTechnique.createMany({
    data: bancoMaestro.behavioralTechniques.map((t) => ({
      frictionCode: t.frictionCode,
      technique: t.technique,
      useWhen: t.useWhen,
      avoidWhen: t.avoidWhen,
      copyTransformation: t.copyTransformation,
      example: t.example
    }))
  });

  await prisma.behavioralBiasMap.deleteMany({});
  await prisma.behavioralBiasMap.createMany({
    data: bancoMaestro.behavioralBiasMap.map((b) => ({
      construct: b.construct,
      whatItDetects: b.whatItDetects,
      whenToAsk: b.whenToAsk,
      whatNotToConclude: b.whatNotToConclude,
      candidateIntervention: b.candidateIntervention,
      benchmarks: b.benchmarks
    }))
  });

  return {
    methodologyVersion: methodology.version,
    questionBankVersion: questionBank.version,
    constructs: bancoMaestro.constructs.length,
    variables: bancoMaestro.variables.length,
    questionsActive,
    questionsDraft,
    questionsSkipped,
    inferenceRules: bancoMaestro.inferenceRules.length,
    forbiddenInferences: bancoMaestro.forbiddenInferences.length,
    qaScenarios: bancoMaestro.qaScenarios.length,
    behavioralTechniques: bancoMaestro.behavioralTechniques.length,
    behavioralBiasMap: bancoMaestro.behavioralBiasMap.length
  };
}
