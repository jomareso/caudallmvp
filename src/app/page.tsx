import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getVisibleBlockContent } from '@/lib/landing/get-landing-content';
import { splitHighlightMarkup } from '@/lib/landing/blocks';

export const metadata: Metadata = {
  title: 'Caudall para empresas — Bienestar financiero con datos reales'
};

// El contenido sale de la base (LandingBlock) y puede cambiar en
// cualquier momento desde /admin/contenido — sin esto, Next intenta
// pre-renderizar la página como estática en build time (heurística: no
// usa cookies/headers) y queda congelada con el contenido de ese momento.
export const dynamic = 'force-dynamic';

// Landing pública para RRHH/empleadores, en el dominio raíz (decisión de
// Reynoso: este es el landing primario del modelo B2B2C). La entrada real
// del colaborador (código de licencia + magic link) vive en /acceso, no
// acá — se movió para no romper el start_url de la PWA ni la redirección
// de sesión (ver public/manifest.json y src/middleware.ts).
//
// Decisión 7: desktop-first, pero sigue siendo una pantalla real — tiene
// que verse bien en cualquier tamaño, no solo en el canvas de 1440px del
// mockup de diseño.
//
// Todo el copy viene de LandingBlock (slug EMPLEADOR), administrable
// desde /admin/contenido sin tocar código — igual que la landing
// colaborador (ver (employee)/acceso/brand-panel.tsx y landing-form.tsx).
// Cada sección se omite si el bloque no existe o un admin lo marcó no
// visible (Decisión 4: catálogo con overrides de activar/desactivar).
export default async function HomePage() {
  const [hero, reto, solucion, metodologia, privacidad, cierre, footer] = await Promise.all([
    getVisibleBlockContent('EMPLEADOR', 'empleador_hero'),
    getVisibleBlockContent('EMPLEADOR', 'empleador_reto'),
    getVisibleBlockContent('EMPLEADOR', 'empleador_solucion'),
    getVisibleBlockContent('EMPLEADOR', 'empleador_metodologia'),
    getVisibleBlockContent('EMPLEADOR', 'empleador_privacidad'),
    getVisibleBlockContent('EMPLEADOR', 'empleador_cierre'),
    getVisibleBlockContent('EMPLEADOR', 'empleador_footer')
  ]);

  // averageCfhiLabel y tiers ya existen para el dashboard real de RRHH
  // (/admin/empresa) — mismo concepto, se reutiliza en vez de duplicar
  // copy nuevo para este widget ilustrativo.
  const t = await getTranslations('landingEmpleador');
  const tEmpresa = await getTranslations('admin.empresa');

  return (
    <div className="bg-white text-quartz">
      <header className="border-b border-silver/40 bg-white/95 lg:sticky lg:top-0 lg:z-10 lg:backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between gap-4">
          {/* h-7: mismo tamaño que el logo en la barra de navegación
              persistente del resto del producto (admin, topbar del
              empleado). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
          <img src="/brand/caudall-logo-color.png" alt="Caudall" className="h-7 w-auto shrink-0" />
          {/* Solo desktop: en móvil no hay espacio para un menú sin
              competir con el CTA (ver el ancho del botón abajo), y la
              landing sigue siendo de una sola pantalla larga — no hace
              falta navegar por secciones ahí. */}
          <nav className="hidden lg:flex items-center gap-7 text-[13.5px] text-nickel">
            <a href="#solucion" className="hover:text-yale">
              Cómo funciona
            </a>
            <a href="#metodologia" className="hover:text-yale">
              Metodología
            </a>
            <a href="#privacidad" className="hover:text-yale">
              Privacidad
            </a>
          </nav>
          {hero ? <CtaButton href={hero.ctaUrl} label={hero.ctaLabel} variant="solid" /> : null}
        </div>
      </header>

      {hero ? (
        <section className="max-w-5xl mx-auto px-6 py-14 lg:py-16">
          <div className="flex flex-col items-center text-center gap-10 lg:grid lg:grid-cols-2 lg:items-center lg:text-left lg:gap-12">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <h1 className="text-3xl lg:text-[34px] font-semibold leading-snug text-balance">
                <Highlighted text={hero.headline} />
              </h1>
              <p className="mt-4 text-base lg:text-lg text-nickel max-w-lg">{hero.subtitle}</p>
              <div className="mt-6">
                <CtaButton href={hero.ctaUrl} label={hero.ctaLabel} variant="solid" size="lg" />
              </div>
            </div>

            <div className="w-full max-w-2xl bg-[#F4F5F7] border border-silver/40 rounded-2xl p-5 flex flex-col gap-2">
              <p className="text-[11px] text-nickel text-left">{t('illustrativeLabel')}</p>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-4 text-left">
                <div className="flex-1 bg-white border border-silver/50 rounded-xl p-5">
                  <p className="text-[11.5px] text-nickel">{tEmpresa('averageCfhiLabel')}</p>
                  <p className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-semibold leading-none">47</span>
                    <span className="text-xs text-nickel">{t('cfhiOutOf')}</span>
                  </p>
                  <p className="text-[11px] text-bad mt-1">{t('cfhiVsNational')}</p>
                </div>
                <div className="flex-1 bg-white border border-silver/50 rounded-xl p-5 flex flex-col gap-2">
                  <p className="text-[11.5px] text-nickel">{t('teamDistributionLabel')}</p>
                  <SegmentBar label={tEmpresa('tiers.LOW')} pct={35} color="#791F1F" />
                  <SegmentBar label={tEmpresa('tiers.MID')} pct={45} color="#854F0B" />
                  <SegmentBar label={tEmpresa('tiers.HIGH')} pct={20} color="#3B6D11" />
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {reto ? (
        <section className="border-t border-silver/40">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 lg:py-12 flex flex-col gap-3">
            <span className="w-9 h-9 rounded-full bg-[#F4F5F7] flex items-center justify-center text-base" aria-hidden>
              🧭
            </span>
            <h2 className="text-xl lg:text-2xl font-semibold">{reto.title}</h2>
            <p className="text-[15px] text-nickel leading-relaxed">{reto.body}</p>
          </div>
        </section>
      ) : null}

      {solucion ? (
        <section id="solucion" className="border-t border-silver/40 scroll-mt-20">
          <div className="max-w-3xl mx-auto px-6 lg:px-10 py-10 lg:py-12 flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl lg:text-2xl font-semibold">{solucion.title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {solucion.tags.map((tag, i) => (
                  <span key={tag} className="flex items-center gap-2">
                    {i > 0 ? <span className="text-silver text-sm">+</span> : null}
                    <span
                      className="text-xs font-bold px-3 py-1.5 rounded-full"
                      style={{
                        color: [ '#0F5499', '#0783D9', '#34C1EE'][i % 3],
                        background: ['rgba(15,84,153,0.08)', 'rgba(7,131,217,0.08)', 'rgba(52,193,238,0.12)'][i % 3]
                      }}
                    >
                      {tag}
                    </span>
                  </span>
                ))}
              </div>
              <p className="text-[15px] text-nickel leading-relaxed">{solucion.body}</p>
            </div>
            {/* Cada paso agrupado con su flecha en un solo span
                (whitespace-nowrap): si envuelve en mobile, envuelve la
                unidad completa — evita que una flecha quede huérfana al
                inicio de línea. */}
            <div className="flex items-center gap-3.5 flex-wrap text-base font-semibold">
              {solucion.steps.map((step, i) => (
                <span key={step} className="whitespace-nowrap">
                  {i > 0 ? <span className="text-cola text-sm mr-3.5">→</span> : null}
                  {step}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {metodologia ? (
        <section id="metodologia" className="border-t border-silver/40 scroll-mt-20">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-14 flex flex-col gap-8">
            <div className="flex flex-col gap-3 max-w-xl">
              <p className="text-xs font-semibold tracking-wide uppercase text-cola">{metodologia.eyebrow}</p>
              <h2 className="text-xl lg:text-2xl font-semibold">{metodologia.title}</h2>
              <p className="text-sm text-nickel leading-relaxed">{metodologia.body}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
              <div className="hidden sm:block absolute top-[5px] left-0 right-0 h-px bg-silver/50" />
              {metodologia.milestones.map((milestone, i) => (
                <div key={i} className="flex flex-col gap-3.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: ['#0F5499', '#0783D9', '#34C1EE'][i % 3] }} />
                  <div>
                    <p className="text-xl font-bold">{milestone.year}</p>
                    <p className="text-[13px] text-nickel">{milestone.title}</p>
                  </div>
                  <div className="w-full aspect-[4/3] rounded-lg bg-[#F4F5F7] border border-silver/40 overflow-hidden">
                    {milestone.mediaAssetId ? (
                      // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
                      <img src={`/api/media/${milestone.mediaAssetId}`} alt={milestone.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-end justify-center gap-1 p-4">
                        <div className="w-1.5 rounded-[1px]" style={{ height: '18px', background: 'rgba(15,84,153,0.35)' }} />
                        <div className="w-1.5 rounded-[1px]" style={{ height: '32px', background: 'rgba(7,131,217,0.35)' }} />
                        <div className="w-1.5 rounded-[1px]" style={{ height: '12px', background: 'rgba(52,193,238,0.35)' }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm italic text-nickel text-center">{metodologia.closingLine}</p>
          </div>
        </section>
      ) : null}

      {privacidad ? (
        <section id="privacidad" className="border-t border-silver/40 scroll-mt-20">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-14">
            <div className="bg-[#F4F5F7] rounded-2xl p-7 lg:p-9 flex gap-4 items-start">
              <span className="text-lg" aria-hidden>
                🛡️
              </span>
              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold">{privacidad.title}</p>
                <p className="text-sm text-nickel leading-relaxed max-w-2xl">{privacidad.body}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {cierre && hero ? (
        <section className="border-t border-silver/40">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
            <div className="rounded-[20px] p-8 lg:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-gradient-to-br from-yale to-cola">
              <div className="flex flex-col gap-2 max-w-md">
                <p className="text-xl lg:text-2xl font-semibold text-white leading-snug">{cierre.title}</p>
                <p className="text-sm text-white/85">{cierre.body}</p>
              </div>
              <CtaButton href={hero.ctaUrl} label={cierre.ctaLabel} variant="inverse" size="lg" />
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-silver/40">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo estático propio del bundle, no necesita el optimizador de next/image */}
            <img src="/brand/caudall-logo-color.png" alt="Caudall" className="h-5 w-auto" />
            <span className="text-nickel text-[12.5px]">© {new Date().getFullYear()} caudall. Todos los derechos reservados.</span>
          </div>
          {/* Sin contacto todavía (ver empleador_footer en blocks.ts) —
              se omite en vez de mostrar un placeholder vacío a un
              visitante real. */}
          {footer?.contactEmail ? (
            <a href={`mailto:${footer.contactEmail}`} className="text-[12.5px] text-yale hover:underline">
              {footer.contactEmail}
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {splitHighlightMarkup(text).map((part, index) =>
        part.highlighted ? (
          <span key={index} className="bg-gradient-to-r from-yale to-cola bg-clip-text text-transparent">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

function CtaButton({
  href,
  label,
  variant,
  size = 'md'
}: {
  href: string;
  label: string;
  variant: 'solid' | 'inverse';
  size?: 'md' | 'lg';
}) {
  // md en móvil se achica un poco (padding y tipografía): a 390px de
  // ancho, el logo + "Solicitar una demostración" a tamaño completo no
  // cabían en una sola fila y desbordaban horizontalmente — encontrado
  // verificando la PR anterior con Playwright a 390px.
  const sizeClass = size === 'lg' ? 'px-6 py-3 text-[14.5px]' : 'px-3.5 py-2 text-[13px] sm:px-5 sm:py-2.5 sm:text-sm';
  const variantClass = variant === 'solid' ? 'bg-yale text-white' : 'bg-white text-yale';
  return (
    <a href={href} className={`inline-flex items-center justify-center rounded-lg font-semibold shrink-0 ${sizeClass} ${variantClass}`}>
      {label}
    </a>
  );
}

function SegmentBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] shrink-0">{label}</span>
      <span className="flex-1 h-1.5 rounded bg-black/5 overflow-hidden">
        <span className="block h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  );
}
