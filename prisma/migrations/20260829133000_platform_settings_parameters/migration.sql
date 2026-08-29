-- AlterTable: parámetros globales de plataforma (antes constantes en
-- código) — defaults iguales a los valores que ya estaban hardcodeados,
-- así que el comportamiento en producción no cambia con este deploy.
ALTER TABLE "platform_settings"
  ADD COLUMN "followupInviteAfterDays" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN "showInterventionVideos" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "licenseDurationsMonths" INTEGER[] NOT NULL DEFAULT ARRAY[3, 6, 12]::INTEGER[],
  ADD COLUMN "minCohortSize" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "minSampleSize" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "magicLinkTtlMinutes" INTEGER NOT NULL DEFAULT 15;

-- La fila 'singleton' puede no existir todavía (nadie subió un logo) — la
-- garantizamos acá para que getPlatformSettings() siempre encuentre una
-- fila real en vez de depender de un fallback en el código de la app.
INSERT INTO "platform_settings" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
