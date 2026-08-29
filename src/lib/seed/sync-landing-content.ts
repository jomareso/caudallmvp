import type { PrismaClient } from '@prisma/client';
import { LANDING_BLOCK_TYPES_BY_SLUG, parseLandingBlockContent, type LandingBlockType } from '../landing/blocks';

// Contenido inicial de las dos landings, editable después desde
// /admin/contenido. Mismo patrón que sync-banco-maestro.ts/
// sync-national-benchmark.ts: este código solo siembra el estado inicial,
// corre seguro varias veces.
//
// Solo CREA bloques que todavía no existen (por landingPageId+type) — si
// un admin ya editó un bloque, volver a correr el seed no lo pisa.
//
// COLABORADOR: copy real ya en producción (ver messages/es.json
// employee.landing, antes de esta migración a contenido administrable).
// EMPLEADOR: copy aprobado del mockup de diseño (RRHH.dc.html) — todavía
// no existe una página pública real para esta landing, así que este
// contenido queda listo para cuando se construya esa página en una fase
// posterior.
const INITIAL_CONTENT: Record<LandingBlockType, unknown> = {
  colaborador_hero: {
    titleLine1: 'Entiende tu salud financiera.',
    titleLine2: 'Descubre qué hacer después.',
    subtitle: 'Conoce mejor tu situación financiera y recibe **una orientación clara** sobre cuál podría ser tu próximo paso.'
  },
  colaborador_form_intro: {
    formTitle: 'Tu espacio privado de salud financiera.',
    formSubtitle: 'Ingresa el código que te proporcionó tu empresa para comenzar.',
    timeEstimate: 'Toma aproximadamente 5–8 minutos.'
  },
  colaborador_trust: {
    privacyGuarantee:
      'Tus respuestas son privadas. Tu empresa no verá tus respuestas individuales ni tu diagnóstico personal — solo información agregada y anónima.'
  },
  empleador_hero: {
    headline: 'Convierte la salud financiera de tus colaboradores en **decisiones de bienestar**.',
    subtitle: 'Identifica brechas, entiende qué grupos necesitan más apoyo y prioriza mejor.',
    ctaLabel: 'Solicitar una demostración',
    // Todavía no hay un mecanismo real de contacto — placeholder hasta
    // que se cargue un enlace real desde /admin/contenido.
    ctaUrl: '#'
  },
  empleador_reto: {
    title: 'Invertir en bienestar financiero sin datos es intervenir a ciegas.',
    body: 'Sin una lectura clara de la salud financiera de tus colaboradores, es difícil saber dónde están las principales brechas y qué iniciativas conviene priorizar.'
  },
  empleador_solucion: {
    title: 'Una visión más completa para decidir mejor.',
    tags: ['Finanzas', 'Comportamiento', 'Contexto'],
    body: 'Caudall combina estas tres capas para identificar dónde están las principales brechas, en qué grupos se concentran y dónde conviene enfocar los esfuerzos.',
    steps: ['Diagnostica', 'Entiende', 'Prioriza', 'Mide']
  },
  empleador_metodologia: {
    eyebrow: 'Respaldo metodológico',
    title: 'Metodología respaldada por evidencia real',
    body: 'Caudall se construye sobre evidencia real, con estudios realizados en 2021, 2022 y 2024 bajo criterios de rigor estadístico, diseño muestral y representatividad.',
    milestones: [
      { year: '2021', title: 'Estudio base', description: 'Estudio base', mediaAssetId: null },
      { year: '2022', title: 'Profundización de hallazgos', description: 'Profundización de hallazgos', mediaAssetId: null },
      { year: '2024', title: 'Actualización de evidencia', description: 'Actualización de evidencia', mediaAssetId: null }
    ],
    closingLine: 'Tres momentos de estudio. Una metodología que sigue aprendiendo.'
  },
  empleador_privacidad: {
    title: 'Datos agregados. Personas protegidas.',
    body: 'RRHH accede a información agregada y gobernada, nunca a respuestas individuales. El diagnóstico personal de cada colaborador se mantiene privado.'
  },
  empleador_cierre: {
    title: 'Dale a tu programa de bienestar la información que le falta.',
    body: 'Decide con más claridad dónde enfocar tus iniciativas de bienestar.',
    ctaLabel: 'Solicitar una demostración'
  }
};

export async function syncLandingContent(prisma: PrismaClient): Promise<{ pagesCreated: number; blocksCreated: number }> {
  let pagesCreated = 0;
  let blocksCreated = 0;

  for (const slug of ['EMPLEADOR', 'COLABORADOR'] as const) {
    const existingPage = await prisma.landingPage.findUnique({ where: { slug } });
    const page = existingPage ?? (await prisma.landingPage.create({ data: { slug } }));
    if (!existingPage) pagesCreated += 1;

    const types = LANDING_BLOCK_TYPES_BY_SLUG[slug];
    for (const [order, type] of types.entries()) {
      const existing = await prisma.landingBlock.findUnique({
        where: { landingPageId_type: { landingPageId: page.id, type } }
      });
      if (existing) continue;

      const content = parseLandingBlockContent(type, INITIAL_CONTENT[type]);
      await prisma.landingBlock.create({
        data: { landingPageId: page.id, type, order, visible: true, content }
      });
      blocksCreated += 1;
    }
  }

  return { pagesCreated, blocksCreated };
}
