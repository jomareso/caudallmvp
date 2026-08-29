import { getVisibleBlockContent } from '@/lib/landing/get-landing-content';
import { splitHighlightMarkup } from '@/lib/landing/blocks';

// Panel de marca para el lado izquierdo de las pantallas cortas del
// empleado en escritorio (Decisión 7: "se diseña primero para móvil y se
// adapta a pantallas más grandes" — esta es esa adaptación). Oculto por
// completo debajo de `lg`, así que no cambia nada del layout mobile-first
// ya existente.
//
// El copy (títulos, subtítulo, garantía de privacidad) viene de
// LandingBlock — administrable desde /admin/contenido sin tocar código
// (mismo criterio que Question/Intervention: contenido de plataforma en
// base de datos, no en archivos de traducción). La estructura de esta
// pantalla no cambia desde el panel, solo su texto.
export async function BrandPanel() {
  const hero = await getVisibleBlockContent('COLABORADOR', 'colaborador_hero');
  const trust = await getVisibleBlockContent('COLABORADOR', 'colaborador_trust');

  return (
    <div className="hidden lg:flex lg:flex-col lg:justify-center bg-gradient-to-br from-yale to-cola text-white px-16 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
      <img src="/brand/caudall-logo-white.png" alt="Caudall" className="h-8 w-auto self-start mb-8" />
      {hero ? (
        <>
          {/* text-2xl (no text-4xl): a 36px "Entiende tu salud financiera."
              no cabe en una sola línea dentro de max-w-md — 24px es el
              tamaño real del mockup (.brand-panel h3) y sí calza cada
              línea completa sin partirse. */}
          <h2 className="text-2xl font-medium leading-snug mb-4 max-w-md text-balance">
            <span className="block text-white">{hero.titleLine1}</span>
            <span className="block text-picton">{hero.titleLine2}</span>
          </h2>
          <p className="text-white/80 text-lg max-w-lg leading-relaxed mb-8">
            {splitHighlightMarkup(hero.subtitle).map((part, index) =>
              part.highlighted ? (
                <span key={index} className="text-picton font-semibold">
                  {part.text}
                </span>
              ) : (
                <span key={index}>{part.text}</span>
              )
            )}
          </p>
        </>
      ) : null}
      {trust ? (
        <p className="text-white/70 text-sm max-w-lg leading-relaxed flex items-start gap-2">
          <span aria-hidden>🔒</span>
          <span>{trust.privacyGuarantee}</span>
        </p>
      ) : null}
    </div>
  );
}
