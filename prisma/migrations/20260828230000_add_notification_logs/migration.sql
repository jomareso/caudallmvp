-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COMMITMENT', 'INCOMPLETE', 'RESULT_UPDATED', 'NEW_STEP', 'LICENSE_EXPIRING');

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "refId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_logs_employeeId_type_idx" ON "notification_logs"("employeeId", "type");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (spec CLAUDE.md: "la barrera no puede depender solo
-- de la lógica de aplicación"). Mismo patrón que push_subscriptions/
-- notification_preferences: ligada por employeeId, sin tenantId propio.
ALTER TABLE "notification_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_logs" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));
