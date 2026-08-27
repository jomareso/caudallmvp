-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_employeeId_idx" ON "push_subscriptions"("employeeId");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (spec CLAUDE.md: "la barrera no puede depender solo
-- de la lógica de aplicación"). Mismo patrón que variable_states/
-- construct_scores/dimension_scores (ver 20260826225832_enable_rls):
-- ligada por employeeId, sin tenantId propio.
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "push_subscriptions" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

