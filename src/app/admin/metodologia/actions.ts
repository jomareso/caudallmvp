'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { syncBancoMaestro, type SyncBancoMaestroSummary } from '@/lib/seed/sync-banco-maestro';

// Reemplaza el flujo manual de "genera un SQL y pídele a Reynoso que lo
// corra en Neon" para cada actualización del Excel del banco de preguntas:
// el JSON convertido (prisma/seed-data/banco-maestro-v3.json) ya viaja con
// el código de la app en cada deploy, así que este botón solo necesita
// aplicar exactamente la misma lógica que `prisma db seed` corre en local
// — misma función compartida (src/lib/seed/sync-banco-maestro.ts), sin
// tocar el catálogo de intervenciones, el tenant demo ni el admin
// fundador, que no cambian con cada revisión del Excel.
export async function syncBancoMaestroContent(): Promise<
  { ok: true; summary: SyncBancoMaestroSummary } | { ok: false; message: string }
> {
  const admin = await requireAdm();
  const t = await getTranslations('admin.metodologia');

  let summary: SyncBancoMaestroSummary;
  try {
    // El sync opera sobre catálogo compartido (sin dueño de tenant), fuera de
    // cualquier contexto de RLS — el cast es solo una limitante de tipos de
    // las extensiones de Prisma (ver src/lib/db/prisma.ts), no cambia el
    // comportamiento real en runtime.
    summary = await syncBancoMaestro(prisma as unknown as import('@prisma/client').PrismaClient);
  } catch (error) {
    console.error('[syncBancoMaestroContent] fallo al sincronizar', error);
    return { ok: false, message: t('syncError') };
  }

  await prisma.auditLog.create({
    data: {
      whoId: admin.id,
      whoData: { email: admin.email, profileType: admin.profileType },
      what: 'SYNC_BANCO_MAESTRO',
      entityType: 'QuestionBank',
      entityId: summary.questionBankVersion,
      newValue: summary
    }
  });

  revalidatePath('/diagnostico');
  revalidatePath('/admin/metodologia');
  return { ok: true, summary };
}
