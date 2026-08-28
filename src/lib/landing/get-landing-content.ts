import { prisma } from '@/lib/db/prisma';
import type { LandingBlockContent, LandingBlockType } from './blocks';

// Lee el contenido de UN bloque, ya validado por su `type` — devuelve null
// si el bloque no existe todavía (DB sin sembrar) o si un admin lo marcó
// no visible desde /admin/contenido (ver Decisión 4: catálogo con
// overrides de activar/desactivar, mismo principio aplicado acá a
// secciones de landing).
export async function getVisibleBlockContent<T extends LandingBlockType>(
  slug: 'EMPLEADOR' | 'COLABORADOR',
  type: T
): Promise<LandingBlockContent<T> | null> {
  const block = await prisma.landingBlock.findFirst({ where: { landingPage: { slug }, type, visible: true } });
  if (!block) return null;
  return block.content as LandingBlockContent<T>;
}
