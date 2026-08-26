-- Row-Level Security — Decisión 1 / CLAUDE.md: "la barrera se enforce a
-- nivel de base de datos... no solo de UI [ni de query]". Hasta ahora el
-- aislamiento entre empresas dependía por completo de que cada query de
-- Prisma incluyera `where: { tenantId }` a mano. Esta migración agrega la
-- capa de respaldo: si algún día una query se escribe sin ese filtro, la
-- base de datos igual no entrega filas de otro tenant.
--
-- RLS solo protege si la app deja de conectarse como dueña de las tablas
-- (ver prisma/rls/create-app-role.sql — Postgres ignora RLS para el
-- dueño). Esta migración solo agrega las políticas; no cambia todavía qué
-- rol usa DATABASE_URL, así que no rompe nada hasta el corte final.
--
-- Tres variables de sesión controlan qué ve cada conexión (ver
-- src/lib/db/tenant-context.ts, que las fija con set_config() al inicio
-- de cada transacción):
--   app.is_platform_admin  — 'true' para un ADM (ve todo, cualquier tenant)
--   app.tenant_id          — el tenant de la empresa/empleado actual
--   app.session_subject_id — el id de la fila del propio admin/empleado
--     autenticado. Necesario porque la PRIMERA consulta de cada request
--     es "¿quién es este id de sesión?" — antes de esa respuesta todavía
--     no se sabe el tenant, así que no puede depender del filtro por
--     tenant. Es seguro: ese id viene del JWT firmado de la sesión, no de
--     algo que el usuario pueda escribir a mano.
--
-- Sin ninguna de las tres fijada, current_setting(..., true) devuelve
-- NULL y toda comparación de igualdad es falsa — por diseño, sin
-- contexto no se ve ninguna fila (fail-closed), nunca "todo visible por
-- error".

CREATE OR REPLACE FUNCTION app_is_platform_admin() RETURNS boolean AS $$
  SELECT current_setting('app.is_platform_admin', true) = 'true'
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS text AS $$
  SELECT current_setting('app.tenant_id', true)
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_session_subject_id() RETURNS text AS $$
  SELECT current_setting('app.session_subject_id', true)
$$ LANGUAGE sql STABLE;

-- ---- Tablas con tenantId propio ----

-- WITH CHECK incluye id = session-subject igual que USING (y que
-- admin_users más abajo): sin eso, el propio UPDATE de status/lastActiveAt
-- que hace auth.ts al iniciar sesión del empleado (bajo contexto
-- session-subject, antes de conocer el tenant) viola la política —
-- encontrado al probar el login real de un empleado bajo RLS.
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employees" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id() OR id = app_session_subject_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id() OR id = app_session_subject_id());

ALTER TABLE "licenses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "licenses" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id());

ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "evidence" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id());

ALTER TABLE "segments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "segments" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id());

ALTER TABLE "learning_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learning_events" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id());

ALTER TABLE "tenant_intervention_overrides" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_intervention_overrides" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id());

-- admin_users: tenantId es NULL para perfiles ADM/FUNCIONAL (no
-- pertenecen a ninguna empresa) — la comparación de igualdad con NULL ya
-- los excluye correctamente de cualquier contexto de tenant sin necesitar
-- una condición aparte. id = session_subject_id() es lo que permite que
-- un ADM se autentique (resolver su propia fila) antes de que exista
-- ningún contexto de tenant.
ALTER TABLE "admin_users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "admin_users" FOR ALL
  USING (app_is_platform_admin() OR "tenantId" = app_tenant_id() OR id = app_session_subject_id())
  WITH CHECK (app_is_platform_admin() OR "tenantId" = app_tenant_id() OR id = app_session_subject_id());

-- ---- Tablas sin tenantId propio, ligadas por employeeId ----

ALTER TABLE "variable_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "variable_states" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

ALTER TABLE "construct_scores" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "construct_scores" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

ALTER TABLE "dimension_scores" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "dimension_scores" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

ALTER TABLE "financial_states" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "financial_states" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

ALTER TABLE "safety_flags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "safety_flags" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

ALTER TABLE "employee_interventions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employee_interventions" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));

ALTER TABLE "employee_segments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employee_segments" FOR ALL
  USING (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()))
  WITH CHECK (app_is_platform_admin() OR "employeeId" = app_session_subject_id() OR "employeeId" IN (SELECT id FROM "employees" WHERE "tenantId" = app_tenant_id()));
