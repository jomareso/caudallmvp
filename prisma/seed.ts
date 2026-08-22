// Datos semilla de metodología v2.0.0 — docs/spec-v2.md.
//
// Ámbito deliberado (ver docs/prototype/ y la conversación de producto):
// - Los CONSTRUCTOS de las 5 dimensiones se siembran completos, con los
//   pesos exactos de la spec §5 — así el reparto de peso interno queda fiel
//   desde el día 1, aunque todavía no todos tengan una pregunta detrás.
// - Solo se siembra UNA variable/pregunta "primaria" por dimensión (la del
//   constructo de mayor peso), para tener el pipeline real funcionando
//   Evidence → Variable → Constructo → Dimensión → CFHI de punta a punta.
//   Profundizar (más variables/preguntas por dimensión) queda para
//   siguientes sesiones.
// - El banco de preguntas real está descrito en la spec (§22) como "ya
//   existente y auditado" — este banco de 6 preguntas es contenido de
//   desarrollo/demo, NO el banco final. Debe reemplazarse antes de
//   lanzar con usuarios reales.
//
// Seguro de correr varias veces (usa upsert en todo).

import { PrismaClient, DimensionCode, VariableType, VersionStatus } from '@prisma/client';

const prisma = new PrismaClient();

type ConstructSeed = { code: string; weightWithinDimension: number };

const CONSTRUCTS_BY_DIMENSION: Record<DimensionCode, ConstructSeed[]> = {
  CONTROL: [
    { code: 'CTRL_MARGIN', weightWithinDimension: 45 },
    { code: 'CTRL_COMPLIANCE', weightWithinDimension: 35 },
    { code: 'CTRL_STABILITY', weightWithinDimension: 20 }
  ],
  RESILIENCE: [
    { code: 'RES_COVERAGE_CONSTRUCT', weightWithinDimension: 45 },
    { code: 'RES_SHOCK_CONSTRUCT', weightWithinDimension: 35 },
    { code: 'RES_EFFECTIVENESS', weightWithinDimension: 20 }
  ],
  DEBT: [
    { code: 'DEBT_PAYMENT_CONSTRUCT', weightWithinDimension: 45 },
    { code: 'DEBT_PRESSURE_CONSTRUCT', weightWithinDimension: 35 },
    { code: 'DEBT_STRESS_CONSTRUCT', weightWithinDimension: 20 }
  ],
  SAVING: [
    { code: 'SAV_FREQUENCY_CONSTRUCT', weightWithinDimension: 40 },
    { code: 'SAV_CONSISTENCY_CONSTRUCT', weightWithinDimension: 35 },
    { code: 'SAV_SUSTAINABILITY', weightWithinDimension: 25 }
  ],
  PLANNING: [
    { code: 'PLAN_DIRECTION', weightWithinDimension: 20 },
    { code: 'PLAN_DEFINITION', weightWithinDimension: 20 },
    { code: 'PLAN_ACTION_CONSTRUCT', weightWithinDimension: 25 },
    { code: 'PLAN_EXECUTION_CONSTRUCT', weightWithinDimension: 25 },
    { code: 'PLAN_MONITORING', weightWithinDimension: 10 }
  ]
};

type AnswerOptionSeed = { state: string; score?: number };

type QuestionSeed = {
  code: string;
  dimension: DimensionCode;
  variableCode: string;
  variableType: VariableType;
  primaryOwnerConstructCode: string | null;
  basePriority: number;
  askIfRule: { variableCode: string; equals: string } | null;
  options: AnswerOptionSeed[];
};

const QUESTIONS: QuestionSeed[] = [
  {
    code: 'CTRL-01',
    dimension: 'CONTROL',
    variableCode: 'CTRL_CASHFLOW',
    variableType: 'SCORE',
    primaryOwnerConstructCode: 'CTRL_MARGIN',
    basePriority: 100,
    askIfRule: null,
    options: [
      { state: 'HIGH', score: 95 },
      { state: 'POSITIVE', score: 78 },
      { state: 'EVEN', score: 55 },
      { state: 'NEGATIVE', score: 28 },
      { state: 'CRITICAL', score: 8 }
    ]
  },
  {
    code: 'RES-01',
    dimension: 'RESILIENCE',
    variableCode: 'RES_COVERAGE',
    variableType: 'SCORE',
    primaryOwnerConstructCode: 'RES_COVERAGE_CONSTRUCT',
    basePriority: 90,
    askIfRule: null,
    options: [
      { state: 'STRONG', score: 95 },
      { state: 'GOOD', score: 78 },
      { state: 'PARTIAL', score: 52 },
      { state: 'LOW', score: 25 },
      { state: 'VERY_LOW', score: 5 }
    ]
  },
  {
    code: 'DEBT-01',
    dimension: 'DEBT',
    variableCode: 'DEBT_APPLICABILITY',
    // CONTEXT: gatea la rama de Deuda (spec §12 / regla CORE #21), no puntúa por sí misma.
    variableType: 'CONTEXT',
    primaryOwnerConstructCode: null,
    basePriority: 80,
    askIfRule: null,
    options: [{ state: 'NONE' }, { state: 'APPLICABLE' }]
  },
  {
    code: 'DEBT-02',
    dimension: 'DEBT',
    variableCode: 'DEBT_PAYMENT_CAPACITY',
    variableType: 'SCORE',
    primaryOwnerConstructCode: 'DEBT_PAYMENT_CONSTRUCT',
    basePriority: 75,
    askIfRule: { variableCode: 'DEBT_APPLICABILITY', equals: 'APPLICABLE' },
    options: [
      { state: 'COMFORTABLE', score: 95 },
      { state: 'MANAGEABLE', score: 75 },
      { state: 'TIGHT', score: 50 },
      { state: 'DIFFICULT', score: 25 },
      { state: 'UNMANAGEABLE', score: 5 }
    ]
  },
  {
    code: 'SAV-01',
    dimension: 'SAVING',
    variableCode: 'SAV_FREQUENCY',
    variableType: 'SCORE',
    primaryOwnerConstructCode: 'SAV_FREQUENCY_CONSTRUCT',
    basePriority: 70,
    askIfRule: null,
    options: [
      { state: 'EVERY_MONTH', score: 95 },
      { state: 'MOST_MONTHS', score: 75 },
      { state: 'SOMETIMES', score: 50 },
      { state: 'RARELY', score: 22 },
      { state: 'NEVER', score: 5 }
    ]
  },
  {
    code: 'PLAN-01',
    dimension: 'PLANNING',
    variableCode: 'PLAN_STAGE',
    variableType: 'SCORE',
    primaryOwnerConstructCode: 'PLAN_ACTION_CONSTRUCT',
    basePriority: 60,
    askIfRule: null,
    options: [
      { state: 'NO_DIRECTION', score: 8 },
      { state: 'ASPIRATION', score: 30 },
      { state: 'GOAL_DEFINED', score: 50 },
      { state: 'PLAN_DEFINED', score: 65 },
      { state: 'STARTED', score: 88 }
    ]
  }
];

async function main() {
  const methodology = await prisma.methodology.upsert({
    where: { version: '2.0.0' },
    update: { status: VersionStatus.ACTIVE, publishedAt: new Date() },
    create: { version: '2.0.0', status: VersionStatus.ACTIVE, publishedAt: new Date() }
  });

  const dimensionIdByCode = new Map<DimensionCode, string>();
  for (const code of Object.keys(CONSTRUCTS_BY_DIMENSION) as DimensionCode[]) {
    const dimension = await prisma.dimension.upsert({
      where: { methodologyId_code: { methodologyId: methodology.id, code } },
      update: { weight: 20 },
      create: {
        methodologyId: methodology.id,
        code,
        nameI18nKey: `diagnostic.dimensions.${code}`,
        descriptionI18nKey: `diagnostic.dimensions.descriptions.${code}`,
        weight: 20
      }
    });
    dimensionIdByCode.set(code, dimension.id);
  }

  const constructIdByCode = new Map<string, string>();
  for (const [dimCode, constructs] of Object.entries(CONSTRUCTS_BY_DIMENSION) as [
    DimensionCode,
    ConstructSeed[]
  ][]) {
    const dimensionId = dimensionIdByCode.get(dimCode);
    if (!dimensionId) continue;

    for (const c of constructs) {
      const construct = await prisma.construct.upsert({
        where: { dimensionId_code: { dimensionId, code: c.code } },
        update: { weightWithinDimension: c.weightWithinDimension },
        create: {
          dimensionId,
          code: c.code,
          nameI18nKey: `admin.constructs.${c.code}.name`,
          weightWithinDimension: c.weightWithinDimension
        }
      });
      constructIdByCode.set(c.code, construct.id);
    }
  }

  const questionBank = await prisma.questionBank.upsert({
    where: { version: '1.0.0' },
    update: { status: VersionStatus.ACTIVE },
    create: { version: '1.0.0', status: VersionStatus.ACTIVE }
  });

  const variableIdByCode = new Map<string, string>();

  for (const q of QUESTIONS) {
    const dimensionId = dimensionIdByCode.get(q.dimension);
    if (!dimensionId) throw new Error(`Dimensión no sembrada: ${q.dimension}`);

    const primaryOwnerConstructId = q.primaryOwnerConstructCode
      ? (constructIdByCode.get(q.primaryOwnerConstructCode) ?? null)
      : null;

    const variable = await prisma.variable.upsert({
      where: { code: q.variableCode },
      update: {
        dimensionId,
        variableType: q.variableType,
        possibleStates: q.options.map((o) => o.state),
        primaryOwnerConstructId
      },
      create: {
        code: q.variableCode,
        dimensionId,
        variableType: q.variableType,
        possibleStates: q.options.map((o) => o.state),
        primaryOwnerConstructId
      }
    });
    variableIdByCode.set(q.variableCode, variable.id);

    const question = await prisma.question.upsert({
      where: { bankId_code: { bankId: questionBank.id, code: q.code } },
      update: {
        textI18nKey: `diagnostic.questions.${q.code}.text`,
        dimensionId,
        variableTargetId: variable.id,
        constructTargetId: primaryOwnerConstructId,
        askIfRule: q.askIfRule ?? undefined,
        basePriority: q.basePriority,
        status: VersionStatus.ACTIVE
      },
      create: {
        bankId: questionBank.id,
        code: q.code,
        textI18nKey: `diagnostic.questions.${q.code}.text`,
        dimensionId,
        variableTargetId: variable.id,
        constructTargetId: primaryOwnerConstructId,
        askIfRule: q.askIfRule ?? undefined,
        basePriority: q.basePriority,
        status: VersionStatus.ACTIVE
      }
    });

    for (const option of q.options) {
      const existing = await prisma.answerOption.findFirst({
        where: { questionId: question.id, textI18nKey: `diagnostic.questions.${q.code}.options.${option.state}` }
      });

      const evidenceProduced = {
        variableCode: q.variableCode,
        state: option.state,
        ...(option.score !== undefined ? { score: option.score } : {})
      };

      if (existing) {
        await prisma.answerOption.update({ where: { id: existing.id }, data: { evidenceProduced } });
      } else {
        await prisma.answerOption.create({
          data: {
            questionId: question.id,
            textI18nKey: `diagnostic.questions.${q.code}.options.${option.state}`,
            evidenceProduced
          }
        });
      }
    }
  }

  const dimensionWeights = Object.fromEntries(
    Array.from(dimensionIdByCode.keys()).map((code) => [code, 20])
  );
  const constructWeights = Object.fromEntries(
    Object.entries(CONSTRUCTS_BY_DIMENSION).flatMap(([, constructs]) =>
      constructs.map((c) => [c.code, c.weightWithinDimension])
    )
  );

  await prisma.scoringConfig.upsert({
    where: { version: '1.0.0' },
    update: {
      status: VersionStatus.ACTIVE,
      dimensionWeights,
      constructWeights,
      naRedistributionRule: {
        dimension: 'DEBT',
        condition: 'DEBT_APPLICABILITY=NONE',
        action: 'exclude_from_cfhi_and_redistribute_weight_proportionally'
      }
    },
    create: {
      version: '1.0.0',
      status: VersionStatus.ACTIVE,
      dimensionWeights,
      constructWeights,
      naRedistributionRule: {
        dimension: 'DEBT',
        condition: 'DEBT_APPLICABILITY=NONE',
        action: 'exclude_from_cfhi_and_redistribute_weight_proportionally'
      }
    }
  });

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

  console.log('Seed listo:');
  console.log(`- Methodology ${methodology.version} (ACTIVE)`);
  console.log(`- QuestionBank ${questionBank.version} con ${QUESTIONS.length} preguntas`);
  console.log(`- Tenant demo: ${tenant.name} (código ${tenant.enrollmentCode})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
