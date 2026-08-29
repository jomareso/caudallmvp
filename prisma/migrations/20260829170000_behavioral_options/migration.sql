-- CreateTable
CREATE TABLE "commitment_trigger_options" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commitment_trigger_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commitment_trigger_options_code_key" ON "commitment_trigger_options"("code");

-- CreateTable
CREATE TABLE "outcome_reason_options" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outcome_reason_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outcome_reason_options_code_key" ON "outcome_reason_options"("code");

-- Semilla: las opciones ya vigentes hoy en commitment-triggers.ts /
-- outcome-reasons.ts, con los mismos códigos, íconos y textos — el
-- comportamiento en producción no cambia con este deploy.
INSERT INTO "commitment_trigger_options" ("id", "code", "icon", "label", "sortOrder", "updatedAt") VALUES
  ('trigopt_proximo_ingreso', 'PROXIMO_INGRESO', '💰', 'Con mi próximo ingreso', 0, CURRENT_TIMESTAMP),
  ('trigopt_dia_especifico', 'DIA_ESPECIFICO', '📅', 'Un día que yo elija', 1, CURRENT_TIMESTAMP),
  ('trigopt_despues_gastos_fijos', 'DESPUES_GASTOS_FIJOS', '🧾', 'Después de pagar mis gastos fijos', 2, CURRENT_TIMESTAMP),
  ('trigopt_primera_hora_dia', 'PRIMERA_HORA_DIA', '☀️', 'A primera hora del día', 3, CURRENT_TIMESTAMP),
  ('trigopt_fin_de_semana', 'FIN_DE_SEMANA', '🗓️', 'Este fin de semana', 4, CURRENT_TIMESTAMP);

INSERT INTO "outcome_reason_options" ("id", "code", "label", "sortOrder", "updatedAt") VALUES
  ('reasonopt_no_time', 'NO_TIME', 'No tuve tiempo', 0, CURRENT_TIMESTAMP),
  ('reasonopt_too_hard', 'TOO_HARD', 'Fue más difícil de lo que pensé', 1, CURRENT_TIMESTAMP),
  ('reasonopt_changed_mind', 'CHANGED_MIND', 'Cambié de opinión', 2, CURRENT_TIMESTAMP);
