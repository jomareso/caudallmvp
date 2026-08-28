-- CreateTable
CREATE TABLE "notification_preferences" (
    "employeeId" TEXT NOT NULL,
    "emailChannelEnabled" BOOLEAN NOT NULL DEFAULT true,
    "commitment" BOOLEAN NOT NULL DEFAULT true,
    "incomplete" BOOLEAN NOT NULL DEFAULT true,
    "resultUpdated" BOOLEAN NOT NULL DEFAULT true,
    "newStep" BOOLEAN NOT NULL DEFAULT true,
    "licenseExpiring" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("employeeId")
);

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (spec CLAUDE.md: "la barrera no puede depender solo
-- de la lógica de aplicación"). Mismo patrón que push_subscriptions
-- (20260827180000_add_push_subscriptions): ligada por employeeId (PK),
-- sin tenantId propio.
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_preferences" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));
