-- CreateEnum
CREATE TYPE "SocialComparisonPosition" AS ENUM ('SUPERIOR', 'SIMILAR', 'INFERIOR');

-- CreateTable
CREATE TABLE "social_comparison_snapshots" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "contextVariablesAnswered" TEXT[],
    "contextVariablesOmitted" TEXT[],
    "groupLevel" INTEGER,
    "groupVariablesUsed" TEXT[],
    "groupN" INTEGER,
    "dataSource" TEXT NOT NULL DEFAULT 'LIVE_EMPLOYEES',
    "cfhiScore" DOUBLE PRECISION NOT NULL,
    "progressTier" TEXT NOT NULL,
    "priorityDimension" TEXT,
    "comparisonDimension" TEXT,
    "percentile" INTEGER,
    "position" "SocialComparisonPosition",
    "shown" BOOLEAN NOT NULL DEFAULT false,
    "interventionId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_comparison_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_comparison_snapshots_employeeId_completedAt_key" ON "social_comparison_snapshots"("employeeId", "completedAt");

-- CreateIndex
CREATE INDEX "social_comparison_snapshots_employeeId_idx" ON "social_comparison_snapshots"("employeeId");

-- AddForeignKey
ALTER TABLE "social_comparison_snapshots" ADD CONSTRAINT "social_comparison_snapshots_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (CLAUDE.md: "la barrera no puede depender solo de la
-- lógica de aplicación"). Mismo patrón que notification_logs/
-- push_subscriptions: ligada por employeeId, sin tenantId propio.
ALTER TABLE "social_comparison_snapshots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "social_comparison_snapshots" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

-- AlterTable: parámetros del motor de comparación social (PlatformSettings,
-- singleton sin RLS — ver comentario en el schema).
ALTER TABLE "platform_settings"
  ADD COLUMN "socialComparisonEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "socialComparisonMinN" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "socialComparisonMinNRRHH" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "socialComparisonSuperiorCutoff" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "socialComparisonInferiorCutoff" INTEGER NOT NULL DEFAULT 40;
