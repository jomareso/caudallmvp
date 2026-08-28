import { z } from 'zod';

// Definición de los tipos de bloque de contenido de las landings
// (empleador/RRHH y colaborador) — fuente de verdad única para: la
// validación del contenido guardado en LandingBlock.content (Json), y los
// campos que arma el formulario genérico de /admin/contenido.
//
// Fase 1: cada landing tiene un conjunto fijo de tipos de bloque (uno por
// sección) — no hay todavía UI para crear tipos de bloque nuevos ni para
// repetir un tipo. Ver LandingBlock.@@unique([landingPageId, type]).

const milestoneSchema = z.object({
  year: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  mediaAssetId: z.string().nullable()
});
export type LandingMilestone = z.infer<typeof milestoneSchema>;

const contentSchemas = {
  colaborador_hero: z.object({
    titleLine1: z.string().min(1),
    titleLine2: z.string().min(1),
    subtitle: z.string().min(1)
  }),
  colaborador_form_intro: z.object({
    formTitle: z.string().min(1),
    formSubtitle: z.string().min(1),
    timeEstimate: z.string().min(1)
  }),
  colaborador_trust: z.object({
    privacyGuarantee: z.string().min(1)
  }),
  empleador_hero: z.object({
    headline: z.string().min(1),
    subtitle: z.string().min(1),
    ctaLabel: z.string().min(1),
    // Destino del botón "Solicitar una demostración" (barra superior,
    // hero y cierre lo comparten — ver empresas/page.tsx) — todavía no
    // hay un mecanismo real de contacto/CRM (Decisión 2 no lo cubre, es
    // el journey de la empresa, no del empleado), así que arranca en "#"
    // hasta que se cargue un enlace real desde /admin/contenido.
    ctaUrl: z.string().min(1)
  }),
  empleador_reto: z.object({
    title: z.string().min(1),
    body: z.string().min(1)
  }),
  empleador_solucion: z.object({
    title: z.string().min(1),
    tags: z.array(z.string().min(1)),
    body: z.string().min(1),
    steps: z.array(z.string().min(1))
  }),
  empleador_metodologia: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    milestones: z.array(milestoneSchema),
    closingLine: z.string().min(1)
  }),
  empleador_privacidad: z.object({
    title: z.string().min(1),
    body: z.string().min(1)
  }),
  empleador_cierre: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    ctaLabel: z.string().min(1)
  })
} as const;

export type LandingBlockType = keyof typeof contentSchemas;

export type LandingBlockContent<T extends LandingBlockType> = z.infer<(typeof contentSchemas)[T]>;

export const LANDING_BLOCK_TYPES_BY_SLUG: Record<'EMPLEADOR' | 'COLABORADOR', LandingBlockType[]> = {
  COLABORADOR: ['colaborador_hero', 'colaborador_form_intro', 'colaborador_trust'],
  EMPLEADOR: [
    'empleador_hero',
    'empleador_reto',
    'empleador_solucion',
    'empleador_metodologia',
    'empleador_privacidad',
    'empleador_cierre'
  ]
};

export function isLandingBlockType(value: string): value is LandingBlockType {
  return value in contentSchemas;
}

// Valida `content` según el `type` del bloque. Tira si no matchea — se usa
// tanto al guardar desde el admin como al leer en el seed, para no dejar
// nunca un bloque con una forma inválida en la base.
export function parseLandingBlockContent<T extends LandingBlockType>(type: T, content: unknown): LandingBlockContent<T> {
  return contentSchemas[type].parse(content) as LandingBlockContent<T>;
}

// Descriptores de campo para el formulario genérico de /admin/contenido.
// `key` referencia un campo del content de ese `type` (ver contentSchemas
// arriba) — mantenerlos en sync es responsabilidad de quien edite este
// archivo, no hay generación automática desde el schema de zod porque los
// tipos de campo (texto vs. lista vs. hitos) no se pueden inferir de zod
// solo con `z.string()`/`z.array()`.
export type LandingFieldKind = 'text' | 'textarea' | 'list' | 'milestones';

export type LandingFieldDescriptor = {
  key: string;
  kind: LandingFieldKind;
  labelKey: string;
  helpKey?: string;
};

export const LANDING_BLOCK_FIELDS: Record<LandingBlockType, LandingFieldDescriptor[]> = {
  colaborador_hero: [
    { key: 'titleLine1', kind: 'text', labelKey: 'titleLine1' },
    { key: 'titleLine2', kind: 'text', labelKey: 'titleLine2' },
    { key: 'subtitle', kind: 'textarea', labelKey: 'subtitle', helpKey: 'highlightHelp' }
  ],
  colaborador_form_intro: [
    { key: 'formTitle', kind: 'text', labelKey: 'formTitle' },
    { key: 'formSubtitle', kind: 'text', labelKey: 'formSubtitle' },
    { key: 'timeEstimate', kind: 'text', labelKey: 'timeEstimate' }
  ],
  colaborador_trust: [{ key: 'privacyGuarantee', kind: 'textarea', labelKey: 'privacyGuarantee' }],
  empleador_hero: [
    { key: 'headline', kind: 'textarea', labelKey: 'headline', helpKey: 'highlightHelp' },
    { key: 'subtitle', kind: 'textarea', labelKey: 'subtitle' },
    { key: 'ctaLabel', kind: 'text', labelKey: 'ctaLabel' },
    { key: 'ctaUrl', kind: 'text', labelKey: 'ctaUrl', helpKey: 'ctaUrlHelp' }
  ],
  empleador_reto: [
    { key: 'title', kind: 'textarea', labelKey: 'title' },
    { key: 'body', kind: 'textarea', labelKey: 'body' }
  ],
  empleador_solucion: [
    { key: 'title', kind: 'text', labelKey: 'title' },
    { key: 'tags', kind: 'list', labelKey: 'tags', helpKey: 'oneLinePerItem' },
    { key: 'body', kind: 'textarea', labelKey: 'body' },
    { key: 'steps', kind: 'list', labelKey: 'steps', helpKey: 'oneLinePerItem' }
  ],
  empleador_metodologia: [
    { key: 'eyebrow', kind: 'text', labelKey: 'eyebrow' },
    { key: 'title', kind: 'text', labelKey: 'title' },
    { key: 'body', kind: 'textarea', labelKey: 'body' },
    { key: 'milestones', kind: 'milestones', labelKey: 'milestones' },
    { key: 'closingLine', kind: 'text', labelKey: 'closingLine' }
  ],
  empleador_privacidad: [
    { key: 'title', kind: 'text', labelKey: 'title' },
    { key: 'body', kind: 'textarea', labelKey: 'body' }
  ],
  empleador_cierre: [
    { key: 'title', kind: 'textarea', labelKey: 'title' },
    { key: 'body', kind: 'textarea', labelKey: 'body' },
    { key: 'ctaLabel', kind: 'text', labelKey: 'ctaLabel' }
  ]
};

// Marca de resaltado con los colores de marca dentro de un texto: admin
// escribe **así** y el render (ver render-highlight.tsx) lo convierte en
// un <span> con el color/gradiente institucional — mismo resultado visual
// que t.rich('em', ...) usaba antes, pero editable desde contenido en vez
// de código.
export function splitHighlightMarkup(text: string): Array<{ text: string; highlighted: boolean }> {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, index) => ({ text: part, highlighted: index % 2 === 1 })).filter((p) => p.text.length > 0);
}
