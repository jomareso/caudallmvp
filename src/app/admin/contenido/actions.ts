'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import type { Prisma } from '@prisma/client';
import { MediaCategory } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { isLandingBlockType, parseLandingBlockContent } from '@/lib/landing/blocks';

type ActionResult = { ok: true } | { ok: false; message: string };

export async function updateBlockContent(blockId: string, content: unknown): Promise<ActionResult> {
  await requireAdm();
  const t = await getTranslations('admin.content');

  const block = await prisma.landingBlock.findUnique({ where: { id: blockId } });
  if (!block || !isLandingBlockType(block.type)) return { ok: false, message: t('blockNotFound') };

  let parsed: Prisma.InputJsonValue;
  try {
    // El resultado de zod ya matchea la forma exacta del tipo de bloque —
    // el cast es solo porque Prisma.InputJsonValue no puede expresarse en
    // términos del union genérico que devuelve parseLandingBlockContent.
    parsed = parseLandingBlockContent(block.type, content) as Prisma.InputJsonValue;
  } catch {
    return { ok: false, message: t('invalidContent') };
  }

  await prisma.landingBlock.update({ where: { id: blockId }, data: { content: parsed } });
  revalidatePath('/admin/contenido');
  revalidatePath('/');
  return { ok: true };
}

export async function toggleBlockVisible(blockId: string, visible: boolean): Promise<ActionResult> {
  await requireAdm();
  const t = await getTranslations('admin.content');

  const block = await prisma.landingBlock.findUnique({ where: { id: blockId } });
  if (!block) return { ok: false, message: t('blockNotFound') };

  await prisma.landingBlock.update({ where: { id: blockId }, data: { visible } });
  revalidatePath('/admin/contenido');
  revalidatePath('/');
  return { ok: true };
}

// Reordena moviendo el bloque un lugar hacia arriba/abajo dentro de su
// propia landing — intercambia `order` con el vecino inmediato en esa
// dirección. No hay drag-and-drop en fase 1.
export async function moveBlock(blockId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  await requireAdm();
  const t = await getTranslations('admin.content');

  const block = await prisma.landingBlock.findUnique({ where: { id: blockId } });
  if (!block) return { ok: false, message: t('blockNotFound') };

  const siblings = await prisma.landingBlock.findMany({
    where: { landingPageId: block.landingPageId },
    orderBy: { order: 'asc' }
  });
  const index = siblings.findIndex((b) => b.id === blockId);
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= siblings.length) return { ok: true };

  const sibling = siblings[swapIndex];
  await prisma.$transaction([
    prisma.landingBlock.update({ where: { id: block.id }, data: { order: sibling.order } }),
    prisma.landingBlock.update({ where: { id: sibling.id }, data: { order: block.order } })
  ]);

  revalidatePath('/admin/contenido');
  revalidatePath('/');
  return { ok: true };
}

// application/pdf: para los informes de metodología (ver milestones en
// blocks.ts) — antes solo se podían subir imágenes, así que la sección
// de metodología no podía enlazar los estudios reales.
// image/gif: logos de instituciones a veces llegan solo en ese formato.
const ALLOWED_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
// 10MB: 4MB alcanzaba para fotos pero se quedaba corto para un informe
// real de varias páginas.
const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024;

export async function uploadMediaAsset(formData: FormData): Promise<ActionResult> {
  await requireAdm();
  const t = await getTranslations('admin.content.media');

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: t('uploadErrorType') };
  if (!ALLOWED_MEDIA_TYPES.has(file.type)) return { ok: false, message: t('uploadErrorType') };
  if (file.size > MAX_MEDIA_SIZE_BYTES) return { ok: false, message: t('uploadErrorSize') };

  const category = formData.get('category');
  if (typeof category !== 'string' || !(category in MediaCategory)) {
    return { ok: false, message: t('uploadErrorCategory') };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.mediaAsset.create({
    data: { filename: file.name, mimeType: file.type, data: bytes, size: file.size, category: category as MediaCategory }
  });

  revalidatePath('/admin/contenido');
  return { ok: true };
}

// Reclasificar un archivo ya subido — el banco de medios existía antes de
// tener categorías (ver migración media_asset_category), así que los
// archivos viejos necesitan poder asignarse desde la UI, no solo al
// volver a subirlos.
export async function updateMediaAssetCategory(id: string, category: string): Promise<ActionResult> {
  await requireAdm();
  const t = await getTranslations('admin.content.media');

  if (!(category in MediaCategory)) return { ok: false, message: t('uploadErrorCategory') };

  await prisma.mediaAsset.update({ where: { id }, data: { category: category as MediaCategory } }).catch(() => null);
  revalidatePath('/admin/contenido');
  return { ok: true };
}

export async function deleteMediaAsset(id: string): Promise<ActionResult> {
  await requireAdm();
  await prisma.mediaAsset.delete({ where: { id } }).catch(() => null);
  revalidatePath('/admin/contenido');
  return { ok: true };
}
