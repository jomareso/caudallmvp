import { prisma } from '@/lib/db/prisma';

// spec-v2.md §29 (BEHAVIORAL DESIGN) / regla CORE 19: la economía conductual
// resuelve una fricción identificada, nunca al revés (FRICTION → TECHNIQUE).
// Capturar por qué un compromiso quedó en "en parte" o "todavía no" es la
// fricción real que alimenta al Learning Engine (regla CORE 20) — sin esto,
// OUTCOME_REPORTED solo sabe *que* no se logró, no *por qué*, y no hay nada
// de dónde aprender.
//
// Los motivos en sí (código/texto) ya no son una lista fija en código —
// viven en OutcomeReasonOption, editables desde
// /admin/metodologia/conductual (auditoría de valores hardcodeados, 29
// ago). Esto solo trae/valida contra esa tabla.

export type OutcomeReasonOption = { code: string; label: string };

export async function getEnabledOutcomeReasons(): Promise<OutcomeReasonOption[]> {
  const rows = await prisma.outcomeReasonOption.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' }
  });
  return rows.map((r) => ({ code: r.code, label: r.label }));
}

// Un Server Action es un endpoint público — no basta con que el cliente
// solo ofrezca opciones activas, hay que revalidar acá.
export async function isOutcomeReason(value: string): Promise<boolean> {
  const row = await prisma.outcomeReasonOption.findUnique({ where: { code: value } });
  return row?.enabled ?? false;
}
