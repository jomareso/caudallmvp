-- Duración y cantidad de preguntas de la parte FINANCIERA del diagnóstico
-- (GATE/ANCHOR/ADAPTIVE/FOLLOWUP/BEHAVIORAL) — el bloque de contexto es
-- aparte y no cuenta acá. Se usan para dar un estimado real de "cuánto
-- toma" en la pantalla de bienvenida, en vez del número fijo actual (ver
-- src/lib/engines/diagnostic-stats.ts).
ALTER TABLE "financial_states" ADD COLUMN     "diagnosticDurationSeconds" INTEGER,
ADD COLUMN     "diagnosticStartedAt" TIMESTAMP(3),
ADD COLUMN     "questionsAnsweredCount" INTEGER;
