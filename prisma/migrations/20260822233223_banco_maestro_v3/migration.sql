-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PILOT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('DEPARTMENT', 'LOCATION', 'ROLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('MAGIC_LINK', 'GOOGLE_OAUTH');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "TenantAdminRole" AS ENUM ('VIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_OWNER', 'METHODOLOGIST', 'PRODUCT_ADMIN', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'ACTIVE', 'DEPRECATED', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "DimensionCode" AS ENUM ('CONTROL', 'RESILIENCE', 'DEBT', 'SAVING', 'PLANNING');

-- CreateEnum
CREATE TYPE "VariableType" AS ENUM ('SCORE', 'CONTEXT', 'BEHAVIORAL', 'READINESS', 'DERIVED');

-- CreateEnum
CREATE TYPE "QuestionRole" AS ENUM ('ANCHOR', 'ADAPTIVE', 'GATE', 'BEHAVIORAL', 'CONTEXT', 'FOLLOWUP');

-- CreateEnum
CREATE TYPE "InferenceType" AS ENUM ('STRONG', 'WEAK');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('QUESTION', 'INFERENCE', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "Reliability" AS ENUM ('DIRECT', 'STRONG_INFERENCE', 'WEAK_INFERENCE');

-- CreateEnum
CREATE TYPE "DimensionState" AS ENUM ('MET', 'PARTIAL', 'UNMET', 'CRITICAL', 'NA');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('EDUCATIONAL_CONTENT', 'BEHAVIORAL_ACTION', 'COMMITMENT', 'REMINDER');

-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "EmployeeInterventionStatus" AS ENUM ('SUGGESTED', 'COMMITTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "InterventionOutcome" AS ENUM ('ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('QUESTION_SHOWN', 'QUESTION_ANSWERED', 'QUESTION_ABANDONED', 'DIAGNOSTIC_COMPLETED', 'INTERVENTION_SUGGESTED', 'INTERVENTION_COMMITTED', 'INTERVENTION_COMPLETED', 'OUTCOME_REPORTED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enrollmentCode" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0F5499',
    "secondaryColor" TEXT,
    "aggregationMinSegmentSize" INTEGER NOT NULL DEFAULT 5,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'es',
    "status" "TenantStatus" NOT NULL DEFAULT 'PILOT',
    "corporateEmailDomain" TEXT,
    "methodologyVersionId" TEXT,
    "questionBankVersionId" TEXT,
    "scoringVersionId" TEXT,
    "interventionCatalogVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SegmentType" NOT NULL,
    "parentSegmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "enrollmentCodeUsed" TEXT NOT NULL,
    "authMethod" "AuthMethod" NOT NULL,
    "demographicData" JSONB,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_segments" (
    "employeeId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_segments_pkey" PRIMARY KEY ("employeeId","segmentId")
);

-- CreateTable
CREATE TABLE "tenant_admins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantAdminRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "tenant_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "methodologies" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "methodologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimensions" (
    "id" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "code" "DimensionCode" NOT NULL,
    "nameI18nKey" TEXT NOT NULL,
    "descriptionI18nKey" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 20.0,

    CONSTRAINT "dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constructs" (
    "id" TEXT NOT NULL,
    "dimensionId" TEXT,
    "code" TEXT NOT NULL,
    "nameI18nKey" TEXT NOT NULL,
    "weightWithinDimension" DOUBLE PRECISION NOT NULL,
    "contributesToCfhi" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "constructs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variables" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "variableType" "VariableType" NOT NULL,
    "dimensionId" TEXT,
    "possibleStates" JSONB NOT NULL,
    "primaryOwnerConstructId" TEXT,
    "rawType" TEXT,
    "affectsCfhiNote" TEXT,

    CONSTRAINT "variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "textI18nKey" TEXT NOT NULL,
    "dimensionId" TEXT,
    "variableTargetId" TEXT NOT NULL,
    "constructTargetId" TEXT,
    "role" "QuestionRole" NOT NULL DEFAULT 'ADAPTIVE',
    "whyAskI18nKey" TEXT,
    "askIfRule" JSONB,
    "skipIfRule" JSONB,
    "doNotAskIfRule" JSONB,
    "basePriority" INTEGER NOT NULL DEFAULT 50,
    "informationValue" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "safetyValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "scoringValue" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "routingValue" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "rootCauseValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "uncertaintyReduction" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "burden" INTEGER NOT NULL DEFAULT 3,
    "inferenceSubstitutionAllowed" BOOLEAN NOT NULL DEFAULT true,
    "minConfidenceToSkip" INTEGER NOT NULL DEFAULT 80,
    "frictionTargetCode" TEXT,
    "aiRegenerationAllowed" BOOLEAN NOT NULL DEFAULT true,
    "coreLogicEditable" BOOLEAN NOT NULL DEFAULT true,
    "benchmarkSource" TEXT,
    "methodologicalFunction" TEXT,
    "behavioralConstructCode" TEXT,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER,
    "textI18nKey" TEXT NOT NULL,
    "evidenceProduced" JSONB NOT NULL,
    "secondaryUpdatesNote" TEXT,
    "frictionCode" TEXT,
    "nextCandidatesRaw" TEXT,
    "notes" TEXT,

    CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_configs" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "dimensionWeights" JSONB NOT NULL,
    "constructWeights" JSONB NOT NULL,
    "naRedistributionRule" JSONB NOT NULL,

    CONSTRAINT "scoring_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forbidden_inferences" (
    "id" TEXT NOT NULL,
    "sourceVariableCode" TEXT NOT NULL,
    "sourceValue" TEXT NOT NULL,
    "targetVariableCode" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "forbidden_inferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inference_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "InferenceType" NOT NULL,
    "sourceConditionRaw" TEXT NOT NULL,
    "targetVariableCode" TEXT NOT NULL,
    "targetValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "canSubstituteQuestion" BOOLEAN NOT NULL DEFAULT false,
    "affectedQuestionCodes" TEXT[],
    "notes" TEXT,

    CONSTRAINT "inference_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "methodology_qa_scenarios" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "precondition" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "severity" TEXT NOT NULL,

    CONSTRAINT "methodology_qa_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_techniques" (
    "id" TEXT NOT NULL,
    "frictionCode" TEXT NOT NULL,
    "technique" TEXT NOT NULL,
    "useWhen" TEXT NOT NULL,
    "avoidWhen" TEXT NOT NULL,
    "copyTransformation" TEXT NOT NULL,
    "example" TEXT,

    CONSTRAINT "behavioral_techniques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_bias_map" (
    "id" TEXT NOT NULL,
    "construct" TEXT NOT NULL,
    "whatItDetects" TEXT NOT NULL,
    "whenToAsk" TEXT NOT NULL,
    "whatNotToConclude" TEXT NOT NULL,
    "candidateIntervention" TEXT NOT NULL,
    "benchmarks" TEXT,

    CONSTRAINT "behavioral_bias_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "questionId" TEXT,
    "answerOptionId" TEXT,
    "variableId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "reliability" "Reliability" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "primaryOwnerConstructId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period" TIMESTAMP(3),
    "methodologyVersionId" TEXT NOT NULL,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable_states" (
    "employeeId" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "confidence" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "derivedFromEvidenceIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variable_states_pkey" PRIMARY KEY ("employeeId","variableId")
);

-- CreateTable
CREATE TABLE "construct_scores" (
    "employeeId" TEXT NOT NULL,
    "constructId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "confidence" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "construct_scores_pkey" PRIMARY KEY ("employeeId","constructId")
);

-- CreateTable
CREATE TABLE "dimension_scores" (
    "employeeId" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "state" "DimensionState" NOT NULL,
    "confidence" INTEGER NOT NULL,
    "driverVariableId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dimension_scores_pkey" PRIMARY KEY ("employeeId","dimensionId")
);

-- CreateTable
CREATE TABLE "financial_states" (
    "employeeId" TEXT NOT NULL,
    "cfhiScore" DOUBLE PRECISION NOT NULL,
    "cfhiConfidence" INTEGER NOT NULL,
    "userGoal" JSONB,
    "systemPriority" TEXT,
    "rootCause" TEXT,
    "eligibility" JSONB,
    "finReadiness" TEXT,
    "behReadiness" TEXT,
    "lastDiagnosticCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_states_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "safety_flags" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "flagCode" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceIds" TEXT[],
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "safety_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intervention_catalogs" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intervention_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "appliesToStates" TEXT[],
    "appliesToStages" TEXT[],
    "financialReadinessRequired" TEXT,
    "behavioralReadinessRequired" TEXT,
    "behavioralTechniqueCode" TEXT,
    "titleI18nKey" TEXT NOT NULL,
    "descriptionI18nKey" TEXT NOT NULL,
    "actionTextI18nKey" TEXT,
    "whyThisStepI18nKey" TEXT,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_intervention_overrides" (
    "tenantId" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "status" "OverrideStatus" NOT NULL,

    CONSTRAINT "tenant_intervention_overrides_pkey" PRIMARY KEY ("tenantId","interventionId")
);

-- CreateTable
CREATE TABLE "employee_interventions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EmployeeInterventionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "commitmentData" JSONB,
    "completedAt" TIMESTAMP(3),
    "outcome" "InterventionOutcome",
    "feedback" JSONB,

    CONSTRAINT "employee_interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "whoId" TEXT NOT NULL,
    "whoData" JSONB NOT NULL,
    "what" TEXT NOT NULL,
    "when" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousValue" JSONB,
    "newValue" JSONB,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" TEXT NOT NULL,
    "eventType" "LearningEventType" NOT NULL,
    "employeeId" TEXT,
    "tenantId" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_enrollmentCode_key" ON "tenants"("enrollmentCode");

-- CreateIndex
CREATE INDEX "segments_tenantId_idx" ON "segments"("tenantId");

-- CreateIndex
CREATE INDEX "employees_tenantId_idx" ON "employees"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenantId_personalEmail_key" ON "employees"("tenantId", "personalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_admins_email_key" ON "tenant_admins"("email");

-- CreateIndex
CREATE INDEX "tenant_admins_tenantId_idx" ON "tenant_admins"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "methodologies_version_key" ON "methodologies"("version");

-- CreateIndex
CREATE UNIQUE INDEX "dimensions_methodologyId_code_key" ON "dimensions"("methodologyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "constructs_code_key" ON "constructs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "variables_code_key" ON "variables"("code");

-- CreateIndex
CREATE UNIQUE INDEX "question_banks_version_key" ON "question_banks"("version");

-- CreateIndex
CREATE INDEX "questions_dimensionId_idx" ON "questions"("dimensionId");

-- CreateIndex
CREATE UNIQUE INDEX "questions_bankId_code_key" ON "questions"("bankId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_configs_version_key" ON "scoring_configs"("version");

-- CreateIndex
CREATE UNIQUE INDEX "forbidden_inferences_sourceVariableCode_sourceValue_targetV_key" ON "forbidden_inferences"("sourceVariableCode", "sourceValue", "targetVariableCode", "targetValue");

-- CreateIndex
CREATE UNIQUE INDEX "inference_rules_code_key" ON "inference_rules"("code");

-- CreateIndex
CREATE UNIQUE INDEX "methodology_qa_scenarios_code_key" ON "methodology_qa_scenarios"("code");

-- CreateIndex
CREATE INDEX "evidence_tenantId_employeeId_idx" ON "evidence"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "evidence_employeeId_variableId_idx" ON "evidence"("employeeId", "variableId");

-- CreateIndex
CREATE INDEX "safety_flags_employeeId_idx" ON "safety_flags"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "intervention_catalogs_version_key" ON "intervention_catalogs"("version");

-- CreateIndex
CREATE INDEX "employee_interventions_employeeId_idx" ON "employee_interventions"("employeeId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "learning_events_tenantId_timestamp_idx" ON "learning_events"("tenantId", "timestamp");

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_parentSegmentId_fkey" FOREIGN KEY ("parentSegmentId") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_segments" ADD CONSTRAINT "employee_segments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_segments" ADD CONSTRAINT "employee_segments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_admins" ADD CONSTRAINT "tenant_admins_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimensions" ADD CONSTRAINT "dimensions_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "methodologies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constructs" ADD CONSTRAINT "constructs_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variables" ADD CONSTRAINT "variables_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variables" ADD CONSTRAINT "variables_primaryOwnerConstructId_fkey" FOREIGN KEY ("primaryOwnerConstructId") REFERENCES "constructs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "question_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "dimensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_variableTargetId_fkey" FOREIGN KEY ("variableTargetId") REFERENCES "variables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_constructTargetId_fkey" FOREIGN KEY ("constructTargetId") REFERENCES "constructs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_answerOptionId_fkey" FOREIGN KEY ("answerOptionId") REFERENCES "answer_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES "variables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_primaryOwnerConstructId_fkey" FOREIGN KEY ("primaryOwnerConstructId") REFERENCES "constructs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable_states" ADD CONSTRAINT "variable_states_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variable_states" ADD CONSTRAINT "variable_states_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES "variables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construct_scores" ADD CONSTRAINT "construct_scores_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construct_scores" ADD CONSTRAINT "construct_scores_constructId_fkey" FOREIGN KEY ("constructId") REFERENCES "constructs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_scores" ADD CONSTRAINT "dimension_scores_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_states" ADD CONSTRAINT "financial_states_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "intervention_catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_intervention_overrides" ADD CONSTRAINT "tenant_intervention_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_intervention_overrides" ADD CONSTRAINT "tenant_intervention_overrides_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "interventions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_interventions" ADD CONSTRAINT "employee_interventions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_interventions" ADD CONSTRAINT "employee_interventions_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "interventions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_whoId_fkey" FOREIGN KEY ("whoId") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
