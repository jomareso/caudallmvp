// Carga el Banco Maestro Caudall v3.0 (prisma/seed-data/banco-maestro-v3.json),
// convertido desde el Excel real que diseñó la fundadora — no es contenido de
// desarrollo. Ver prisma/seed-data/README.md para el origen y las 220
// preguntas de sesgos conductuales que quedaron fuera (falta su construct/
// variable en el catálogo).
//
// Seguro de correr varias veces (usa upsert en todo).

import { PrismaClient, DimensionCode, VersionStatus, QuestionRole, InferenceType } from '@prisma/client';
import bancoMaestro from './seed-data/banco-maestro-v3.json';
import interventionCatalogDraft from './seed-data/intervention-catalog-draft.json';

const prisma = new PrismaClient();

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

async function main() {
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

  // ---- Constructos ----
  const constructIdByCode = new Map<string, string>();
  for (const c of bancoMaestro.constructs) {
    const dimensionId = c.dimension ? dimensionIdByCode.get(c.dimension) ?? null : null;
    const construct = await prisma.construct.upsert({
      where: { code: c.code },
      update: {
        dimensionId,
        nameI18nKey: `admin.constructs.${c.code}.name`,
        weightWithinDimension: c.weightWithinDimension,
        contributesToCfhi: c.contributesToCfhi
      },
      create: {
        code: c.code,
        dimensionId,
        nameI18nKey: `admin.constructs.${c.code}.name`,
        weightWithinDimension: c.weightWithinDimension,
        contributesToCfhi: c.contributesToCfhi
      }
    });
    constructIdByCode.set(c.code, construct.id);
  }

  // ---- Variables ----
  const variableIdByCode = new Map<string, string>();
  for (const v of bancoMaestro.variables) {
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

    const variable = await prisma.variable.upsert({
      where: { code: v.code },
      update: {
        dimensionId,
        variableType,
        possibleStates: v.states,
        primaryOwnerConstructId,
        rawType: v.rawType,
        affectsCfhiNote: v.affectsCfhiNote
      },
      create: {
        code: v.code,
        dimensionId,
        variableType,
        possibleStates: v.states,
        primaryOwnerConstructId,
        rawType: v.rawType,
        affectsCfhiNote: v.affectsCfhiNote
      }
    });
    variableIdByCode.set(v.code, variable.id);
  }

  // ---- Banco de preguntas + opciones ----
  const questionBank = await prisma.questionBank.upsert({
    where: { version: bancoMaestro.questionBankVersion },
    update: { status: VersionStatus.ACTIVE },
    create: { version: bancoMaestro.questionBankVersion, status: VersionStatus.ACTIVE }
  });

  for (const q of bancoMaestro.questions) {
    const dimensionId = q.dimension ? dimensionIdByCode.get(q.dimension) ?? null : null;
    const variableId = variableIdByCode.get(q.variable);
    const constructId = q.construct ? constructIdByCode.get(q.construct) ?? null : null;
    if (!variableId) {
      console.warn(`Saltando ${q.id}: variable ${q.variable} no encontrada`);
      continue;
    }

    const question = await prisma.question.upsert({
      where: { bankId_code: { bankId: questionBank.id, code: q.id } },
      update: {
        textI18nKey: `diagnostic.questions.${q.id}.text`,
        dimensionId,
        variableTargetId: variableId,
        constructTargetId: constructId,
        role: toQuestionRole(q.role),
        whyAskI18nKey: q.whyAsk ? `diagnostic.questions.${q.id}.whyAsk` : null,
        askIfRule: q.askIfRaw ? { raw: q.askIfRaw } : undefined,
        skipIfRule: q.skipIfRaw ? { raw: q.skipIfRaw } : undefined,
        basePriority: q.basePriority,
        informationValue: q.informationValue ?? 0.5,
        safetyValue: q.safetyValue ?? 0,
        scoringValue: q.scoringValue ?? 0.5,
        routingValue: q.routingValue ?? 0.5,
        rootCauseValue: q.rootCauseValue ?? 0,
        uncertaintyReduction: q.uncertaintyReduction ?? 0.5,
        burden: q.burden,
        inferenceSubstitutionAllowed: q.inferenceSubstitutionAllowed,
        minConfidenceToSkip: q.minConfidenceToSkip,
        frictionTargetCode: q.frictionTarget,
        aiRegenerationAllowed: q.aiRegenerationAllowed,
        coreLogicEditable: q.coreLogicEditable,
        benchmarkSource: q.benchmarkSource,
        methodologicalFunction: q.methodologicalFunction,
        behavioralConstructCode: q.behavioralConstruct,
        status: VersionStatus.ACTIVE
      },
      create: {
        bankId: questionBank.id,
        code: q.id,
        textI18nKey: `diagnostic.questions.${q.id}.text`,
        dimensionId,
        variableTargetId: variableId,
        constructTargetId: constructId,
        role: toQuestionRole(q.role),
        whyAskI18nKey: q.whyAsk ? `diagnostic.questions.${q.id}.whyAsk` : null,
        askIfRule: q.askIfRaw ? { raw: q.askIfRaw } : undefined,
        skipIfRule: q.skipIfRaw ? { raw: q.skipIfRaw } : undefined,
        basePriority: q.basePriority,
        informationValue: q.informationValue ?? 0.5,
        safetyValue: q.safetyValue ?? 0,
        scoringValue: q.scoringValue ?? 0.5,
        routingValue: q.routingValue ?? 0.5,
        rootCauseValue: q.rootCauseValue ?? 0,
        uncertaintyReduction: q.uncertaintyReduction ?? 0.5,
        burden: q.burden,
        inferenceSubstitutionAllowed: q.inferenceSubstitutionAllowed,
        minConfidenceToSkip: q.minConfidenceToSkip,
        frictionTargetCode: q.frictionTarget,
        aiRegenerationAllowed: q.aiRegenerationAllowed,
        coreLogicEditable: q.coreLogicEditable,
        benchmarkSource: q.benchmarkSource,
        methodologicalFunction: q.methodologicalFunction,
        behavioralConstructCode: q.behavioralConstruct,
        status: VersionStatus.ACTIVE
      }
    });

    // Reemplazar opciones existentes de esta pregunta (idempotente y simple:
    // el banco de 314 preguntas cambia por versión completa, no por parches).
    await prisma.answerOption.deleteMany({ where: { questionId: question.id } });
    for (const o of q.options) {
      const evidenceProduced = {
        variableCode: q.variable,
        state: o.state,
        ...(typeof o.score === 'number' ? { score: o.score } : {})
      };
      await prisma.answerOption.create({
        data: {
          questionId: question.id,
          order: o.order,
          textI18nKey: `diagnostic.questions.${q.id}.options.${o.state}`,
          evidenceProduced,
          secondaryUpdatesNote: o.secondaryUpdates,
          frictionCode: o.friction,
          nextCandidatesRaw: o.nextCandidates,
          notes: o.notes
        }
      });
    }
  }

  // ---- Inferencias permitidas (STRONG/WEAK), prohibidas, QA, técnicas conductuales, mapa de sesgos ----
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

  await prisma.methodologyQaScenario.deleteMany({});
  for (const qa of bancoMaestro.qaScenarios) {
    await prisma.methodologyQaScenario.create({
      data: {
        code: qa.code,
        scenario: qa.scenario,
        precondition: qa.precondition,
        expectedResult: qa.expectedResult,
        severity: qa.severity
      }
    });
  }

  await prisma.behavioralTechnique.deleteMany({});
  for (const t of bancoMaestro.behavioralTechniques) {
    await prisma.behavioralTechnique.create({
      data: {
        frictionCode: t.frictionCode,
        technique: t.technique,
        useWhen: t.useWhen,
        avoidWhen: t.avoidWhen,
        copyTransformation: t.copyTransformation,
        example: t.example
      }
    });
  }

  await prisma.behavioralBiasMap.deleteMany({});
  for (const b of bancoMaestro.behavioralBiasMap) {
    await prisma.behavioralBiasMap.create({
      data: {
        construct: b.construct,
        whatItDetects: b.whatItDetects,
        whenToAsk: b.whenToAsk,
        whatNotToConclude: b.whatNotToConclude,
        candidateIntervention: b.candidateIntervention,
        benchmarks: b.benchmarks
      }
    });
  }

  // Catálogo de intervenciones — BORRADOR (spec §28/Decisión 2: contenido
  // educativo/conductual, no productos financieros). Redactado a partir de
  // los ejemplos reales de BehavioralTechnique.example de la fundadora, no
  // inventado desde cero. Status DRAFT a propósito: no se activa solo por
  // estar cargado, queda pendiente de que Reynoso lo revise y apruebe
  // antes de promoverlo a ACTIVE (ver prisma/seed-data/README.md).
  const interventionCatalog = await prisma.interventionCatalog.upsert({
    where: { version: interventionCatalogDraft.version },
    update: { status: 'DRAFT' },
    create: { version: interventionCatalogDraft.version, status: 'DRAFT' }
  });

  for (const i of interventionCatalogDraft.interventions) {
    const dimensionId = dimensionIdByCode.get(i.dimension);
    if (!dimensionId) continue;

    const existing = await prisma.intervention.findFirst({
      where: { catalogId: interventionCatalog.id, titleI18nKey: `interventions.${i.i18nKeyBase}.title` }
    });

    const data = {
      catalogId: interventionCatalog.id,
      type: i.type as 'BEHAVIORAL_ACTION',
      dimensionId,
      appliesToStates: i.appliesToStates,
      appliesToStages: [] as string[],
      financialReadinessRequired: i.financialReadinessRequired,
      behavioralReadinessRequired: null,
      behavioralTechniqueCode: i.frictionCode,
      titleI18nKey: `interventions.${i.i18nKeyBase}.title`,
      descriptionI18nKey: `interventions.${i.i18nKeyBase}.description`,
      actionTextI18nKey: `interventions.${i.i18nKeyBase}.actionText`,
      whyThisStepI18nKey: `interventions.${i.i18nKeyBase}.whyThisStep`
    };

    if (existing) {
      await prisma.intervention.update({ where: { id: existing.id }, data });
    } else {
      await prisma.intervention.create({ data });
    }
  }

  const tenant = await prisma.tenant.upsert({
    where: { enrollmentCode: 'ACME2026' },
    update: {
      methodologyVersionId: methodology.version,
      questionBankVersionId: questionBank.version
    },
    create: {
      name: 'Empresa Acme',
      enrollmentCode: 'ACME2026',
      methodologyVersionId: methodology.version,
      questionBankVersionId: questionBank.version
    }
  });

  // Bootstrap del primer admin: sin autoregistro (a diferencia del
  // empleado), un AdminUser solo existe si alguien lo crea a mano. Este es
  // el ADM inicial para poder entrar al panel administrativo.
  const founderAdmin = await prisma.adminUser.upsert({
    where: { email: 'reynososoler@gmail.com' },
    update: {},
    create: { email: 'reynososoler@gmail.com', profileType: 'ADM' }
  });

  console.log('Seed del Banco Maestro v3.0 listo:');
  console.log(`- Methodology ${methodology.version} (ACTIVE)`);
  console.log(`- ${bancoMaestro.constructs.length} constructos, ${bancoMaestro.variables.length} variables`);
  console.log(`- QuestionBank ${questionBank.version} con ${bancoMaestro.questions.length} preguntas cargadas`);
  console.log(`  (${bancoMaestro.questionsPendingIds.length} preguntas de sesgos conductuales pendientes — ver README)`);
  console.log(
    `- ${bancoMaestro.inferenceRules.length} inference rules, ${bancoMaestro.forbiddenInferences.length} forbidden inferences, ${bancoMaestro.qaScenarios.length} QA scenarios`
  );
  console.log(`- Tenant demo: ${tenant.name} (código ${tenant.enrollmentCode})`);
  console.log(
    `- Catálogo de intervenciones ${interventionCatalog.version} (${interventionCatalog.status}) con ${interventionCatalogDraft.interventions.length} intervenciones — pendiente de tu revisión`
  );
  console.log(`- Admin inicial (ADM): ${founderAdmin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
