'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { syncBancoMaestro, type SyncBancoMaestroSummary } from '@/lib/seed/sync-banco-maestro';

async function requireAdm() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
  return admin;
}

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

  let summary: SyncBancoMaestroSummary;
  try {
    summary = await syncBancoMaestro(prisma);
  } catch (error) {
    console.error('[syncBancoMaestroContent] fallo al sincronizar', error);
    return { ok: false, message: 'No pudimos sincronizar el banco de preguntas. Intenta de nuevo.' };
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
