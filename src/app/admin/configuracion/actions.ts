'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

async function requireAdm(): Promise<void> {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');
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
