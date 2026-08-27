'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

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

  // platform_settings es un singleton global sin tenantId, no lleva RLS.
  await prisma.platformSettings.upsert({
    where: { id: 'singleton' },
    update: { logoData: bytes, logoMimeType: file.type },
    create: { id: 'singleton', logoData: bytes, logoMimeType: file.type }
  });

  revalidatePath('/');
  revalidatePath('/admin/configuracion');
  return { ok: true };
}
