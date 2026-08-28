import { getTranslations } from 'next-intl/server';
import type { LandingBlock } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { ContentAdminClient } from './content-admin-client';

// `content` siempre es un objeto (ver LANDING_BLOCK_FIELDS/contentSchemas
// en src/lib/landing/blocks.ts) — Prisma solo puede tipar la columna como
// Json genérico, no como el objeto específico de cada `type` de bloque.
function toBlockDTO(block: LandingBlock) {
  return { ...block, content: block.content as Record<string, unknown> };
}

export default async function AdminContenidoPage() {
  // Solo ADM: el contenido de landings es de plataforma (empleador y
  // colaborador), no de un tenant — igual criterio que /admin/configuracion.
  await requireAdm();

  const [empleador, colaborador, media] = await Promise.all([
    prisma.landingPage.findUnique({ where: { slug: 'EMPLEADOR' }, include: { blocks: { orderBy: { order: 'asc' } } } }),
    prisma.landingPage.findUnique({ where: { slug: 'COLABORADOR' }, include: { blocks: { orderBy: { order: 'asc' } } } }),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, filename: true, mimeType: true, size: true, createdAt: true }
    })
  ]);

  const t = await getTranslations('admin.content');
  const labels = {
    title: t('title'),
    tabEmpleador: t('tabEmpleador'),
    tabColaborador: t('tabColaborador'),
    tabMedia: t('tabMedia'),
    visibleLabel: t('visibleLabel'),
    hiddenLabel: t('hiddenLabel'),
    moveUp: t('moveUp'),
    moveDown: t('moveDown'),
    edit: t('edit'),
    save: t('save'),
    saving: t('saving'),
    cancel: t('cancel'),
    saveSuccess: t('saveSuccess'),
    saveError: t('saveError'),
    highlightHelp: t('highlightHelp'),
    oneLinePerItem: t('oneLinePerItem'),
    ctaUrlHelp: t('ctaUrlHelp'),
    milestoneYear: t('milestoneYear'),
    milestoneTitle: t('milestoneTitle'),
    milestoneDescription: t('milestoneDescription'),
    milestoneImage: t('milestoneImage'),
    milestoneImageNone: t('milestoneImageNone'),
    addMilestone: t('addMilestone'),
    removeMilestone: t('removeMilestone'),
    fields: t.raw('fields') as Record<string, string>,
    blockTypeLabels: t.raw('blockTypeLabels') as Record<string, string>,
    media: t.raw('media') as Record<string, string>
  };

  return (
    <main className="flex-1 p-6">
      <div className="w-full max-w-3xl">
        <h1 className="text-lg font-medium text-quartz mb-6">{labels.title}</h1>
        <ContentAdminClient
          empleadorBlocks={(empleador?.blocks ?? []).map(toBlockDTO)}
          colaboradorBlocks={(colaborador?.blocks ?? []).map(toBlockDTO)}
          media={media.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          labels={labels}
        />
      </div>
    </main>
  );
}
