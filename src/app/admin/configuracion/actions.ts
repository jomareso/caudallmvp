'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { syncBancoMaestro, type SyncBancoMaestroSummary } from '@/lib/seed/sync-banco-maestro';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

async function requireAdm() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
  return admin;
}

export async function uploadLogo(formData: FormData): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireAdm();
  const t = await getTranslations('admin.settings');

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: t('uploadErrorType') };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, message: t('uploadErrorType') };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, message: t('uploadErrorSize') };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: { logoData: bytes, logoMimeType: file.type },
    create: { id: 'singleton', logoData: bytes, logoMimeType: file.type }
  });

  revalidatePath('/');
  revalidatePath('/admin/configuracion');
  return { ok: true };
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
  return { ok: true, summary };
}
