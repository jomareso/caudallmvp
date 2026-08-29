import { prisma } from '@/lib/db/prisma';

// spec-v2.md §30 (COMMITMENT): TRIGGER + DATE son los dos campos que
// realmente cambian la probabilidad de que un compromiso se cumpla
// (implementation intentions — spec §28, PROCRASTINATION → Implementation
// intention). AMOUNT/FREQUENCY/DURATION quedan fuera a propósito: ya suelen
// venir explícitos en actionText de la intervención (ej. "aparta un monto
// pequeño"), y pedirlos todos junto con trigger+fecha en el mismo paso
// sería fricción extra en el momento exacto que se busca reducir.
//
// Las opciones de trigger en sí (código/ícono/texto) ya no son una lista
// fija en código — viven en CommitmentTriggerOption, editables desde
// /admin/metodologia/conductual (auditoría de valores hardcodeados, 29
// ago). Esto solo trae/valida contra esa tabla.

export type CommitmentTriggerOption = { code: string; icon: string; label: string };

export async function getEnabledCommitmentTriggers(): Promise<CommitmentTriggerOption[]> {
  const rows = await prisma.commitmentTriggerOption.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: 'asc' }
  });
  return rows.map((r) => ({ code: r.code, icon: r.icon, label: r.label }));
}

// Un Server Action es un endpoint público — no basta con que el cliente
// solo ofrezca opciones activas, hay que revalidar acá. Un trigger
// desactivado deja de aceptarse para compromisos NUEVOS, aunque los ya
// guardados con ese código sigan mostrando su label (ver
// getCommitmentTriggerLabel).
export async function isCommitmentTrigger(value: string): Promise<boolean> {
  const row = await prisma.commitmentTriggerOption.findUnique({ where: { code: value } });
  return row?.enabled ?? false;
}

// Para mostrar el label de un compromiso YA guardado (ej. "con mi próximo
// ingreso") sin importar si esa opción se desactivó después — el código
// nunca se recicla (ver comentario en el modelo), así que sigue
// resolviendo mientras la fila exista.
export async function getCommitmentTriggerLabel(code: string): Promise<string | null> {
  const row = await prisma.commitmentTriggerOption.findUnique({ where: { code } });
  return row?.label ?? null;
}
