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
    // /acceso pide el correo primero, no el código (ver landing-form.tsx,
    // resolveAccessByEmail) — el código solo aparece si ese correo no
    // tiene cuenta todavía. Este texto es contenido administrable (no
    // vuelve a sincronizarse solo si ya existe la fila en producción, ver
    // comentario de INITIAL_CONTENT arriba) — una instalación en
    // producción de antes de este cambio necesita editarse a mano desde
    // /admin/contenido.
    formSubtitle: 'Ingresa tu correo para comenzar.',
    timeEstimate: 'Toma aproximadamente 5–8 minutos.'
  },
  colaborador_trust: {
    privacyGuarantee:
      'Tus respuestas son privadas. Tu empresa no verá tus respuestas individuales ni tu diagnóstico personal — solo información agregada y anónima.'
  },
  empleador_hero: {
    headline: 'Convierte la salud financiera de tus colaboradores en **decisiones de bienestar**.',
    subtitle:
      'Más de 4,500 diagnósticos reales de República Dominicana dicen que 84% de los empleados está en condición vulnerable o sobreviviendo.',
    ctaLabel: 'Solicitar una demostración',
    // Todavía no hay un mecanismo real de contacto — placeholder hasta
    // que se cargue un enlace real desde /admin/contenido.
    ctaUrl: '#'
  },
  empleador_reto: {
    title: 'Invertir en bienestar financiero sin datos es intervenir a ciegas.',
    body: 'Sin una lectura clara de la salud financiera de tu equipo, terminas invirtiendo en bienestar por intuición, no por evidencia.'
  },
  empleador_solucion: {
    title: 'Tres capas que casi nadie mira juntas.',
    tags: ['Finanzas', 'Comportamiento', 'Contexto'],
    body: 'Caudall cruza estas tres capas para mostrarte en qué grupos se concentran los problemas y dónde conviene intervenir primero.',
    steps: ['Diagnostica', 'Entiende', 'Actúa', 'Mide']
  },
  empleador_metodologia: {
    eyebrow: 'Respaldo metodológico',
    title: 'Metodología respaldada por evidencia real',
    body: 'Construida sobre tres Estudios de Salud Financiera (2021, 2022, 2024), con muestra representativa a nivel nacional.',
    bannerImages: [null, null, null],
    // Calculados directo de prisma/seed-data/national-benchmark.json
    // (4,508 registros "Nacional" de los 3 estudios) — no son cifras
    // inventadas. Si el dataset cambia, hay que recalcular y actualizar
    // a mano (no hay cálculo en vivo, ver comentario en blocks.ts).
    findings: [
      'El ahorro es la dimensión más débil del país, por debajo de deuda y planificación',
      'El puntaje promedio nacional subió de 53.7 a 60.4 entre 2021 y 2024',
      'Solo 15% de la población alcanza el nivel "Saludable"'
    ],
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
  },
  // contactEmail vacío a propósito — ver el comentario en blocks.ts.
  empleador_footer: {}
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
