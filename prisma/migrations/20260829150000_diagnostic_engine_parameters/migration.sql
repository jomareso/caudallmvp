-- AlterTable: parámetros del motor de diagnóstico (STOP ENGINE) y de las
-- bandas de nivel (antes constantes en diagnostic.ts/scoring.ts) — defaults
-- iguales a los valores que ya estaban hardcodeados, así que el
-- comportamiento en producción no cambia con este deploy.
ALTER TABLE "platform_settings"
  ADD COLUMN "stopFloor" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "stopSoftMax" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "stopHardMax" INTEGER NOT NULL DEFAULT 18,
  ADD COLUMN "highValueThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
  ADD COLUMN "highValueThresholdSoft" DOUBLE PRECISION NOT NULL DEFAULT 0.97,
  ADD COLUMN "progressTarget" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "progressTierMidCutoff" INTEGER NOT NULL DEFAULT 41,
  ADD COLUMN "progressTierHighCutoff" INTEGER NOT NULL DEFAULT 71;
