-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "templateType" "NotificationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "days" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_rules_templateType_enabled_idx" ON "notification_rules"("templateType", "enabled");

-- Semilla: las 5 reglas ya vigentes hoy en notification-engine.ts, con IDs
-- fijos, para que el comportamiento en producción no cambie con este
-- deploy y para poder referenciarlas desde el backfill de abajo.
INSERT INTO "notification_rules" ("id", "templateType", "enabled", "title", "body", "days", "updatedAt") VALUES
  ('notifrule_commitment', 'COMMITMENT', true, '¿Ya lo hiciste?', 'Hoy es el día que elegiste para tu compromiso. Cuéntanos cómo te fue.', NULL, CURRENT_TIMESTAMP),
  ('notifrule_incomplete', 'INCOMPLETE', true, 'Tu diagnóstico quedó a la mitad', 'Termínalo en unos minutos y descubre tu salud financiera.', 3, CURRENT_TIMESTAMP),
  ('notifrule_result_updated', 'RESULT_UPDATED', true, 'Tu resultado se actualizó', 'Revisa cómo cambió tu salud financiera con tu diagnóstico más reciente.', NULL, CURRENT_TIMESTAMP),
  ('notifrule_new_step', 'NEW_STEP', true, 'Tienes un nuevo paso sugerido', 'Encontramos una recomendación para ti — toma un minuto verla.', NULL, CURRENT_TIMESTAMP),
  ('notifrule_license_expiring', 'LICENSE_EXPIRING', true, 'Tu acceso a Caudall está por vencer', 'Te quedan pocos días. Si quieres seguir usándolo, habla con tu equipo de RRHH.', 7, CURRENT_TIMESTAMP);

-- AlterTable: notification_logs pasa de "type" fijo a "ruleId" (FK), para
-- soportar varias instancias de una misma plantilla — el dedup tiene que
-- ser por instancia de regla, no por tipo fijo.
ALTER TABLE "notification_logs" ADD COLUMN "ruleId" TEXT;

UPDATE "notification_logs" SET "ruleId" = CASE "type"
  WHEN 'COMMITMENT' THEN 'notifrule_commitment'
  WHEN 'INCOMPLETE' THEN 'notifrule_incomplete'
  WHEN 'RESULT_UPDATED' THEN 'notifrule_result_updated'
  WHEN 'NEW_STEP' THEN 'notifrule_new_step'
  WHEN 'LICENSE_EXPIRING' THEN 'notifrule_license_expiring'
END;

ALTER TABLE "notification_logs" ALTER COLUMN "ruleId" SET NOT NULL;

DROP INDEX "notification_logs_employeeId_type_idx";

ALTER TABLE "notification_logs" DROP COLUMN "type";

-- CreateIndex
CREATE INDEX "notification_logs_employeeId_ruleId_idx" ON "notification_logs"("employeeId", "ruleId");

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "notification_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
