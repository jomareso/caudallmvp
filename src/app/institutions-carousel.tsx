'use client';

import { useEffect, useRef } from 'react';

type Institution = { assetId: string; name: string };

// Carrusel de logos de instituciones que respaldaron un estudio o evento
// puntual de Caudall — nunca "clientes" ni instituciones que respaldan a
// Caudall en general (ver el disclaimer que page.tsx siempre muestra
// junto a este carrusel). Se omite del todo si no hay ningún logo
// cargado — mismo criterio que el banner de fotos, nunca un carrusel
// vacío a un visitante real.
//
// Desplazamiento automático continuo vía CSS puro (@keyframes translateX
// sobre la lista duplicada una vez, ver `loop`) — no hay un loop de JS/
// requestAnimationFrame corriendo, así que no compite por CPU con el
// resto de la página. Se pausa en hover/foco (CSS) y mientras el
// visitante toca la pantalla (JS, sólo relevante en móvil, donde no hay
// hover) — así un swipe manual nunca "pelea" contra la animación.
// prefers-reduced-motion apaga el auto-scroll del todo; el scroll
// horizontal manual (mouse o swipe) sigue disponible siempre, animación
// corriendo o no.
export function InstitutionsCarousel({ institutions }: { institutions: Institution[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;
    const pause = () => track.classList.add('is-paused');
    const resume = () => track.classList.remove('is-paused');
    scroller.addEventListener('touchstart', pause, { passive: true });
    scroller.addEventListener('touchend', resume);
    scroller.addEventListener('touchcancel', resume);
    return () => {
      scroller.removeEventListener('touchstart', pause);
      scroller.removeEventListener('touchend', resume);
      scroller.removeEventListener('touchcancel', resume);
    };
  }, []);

  if (institutions.length === 0) return null;

  // Duplicada una vez para el loop continuo: translateX(-50%) sobre el
  // doble de la lista vuelve exactamente al punto visual de partida, sin
  // salto. Con pocos logos esto también evita un hueco vacío al final
  // antes de que el loop reinicie.
  const loop = [...institutions, ...institutions];

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Instituciones"
      className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        ref={trackRef}
        className="caudall-institutions-track flex items-center gap-12 w-max py-2 hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
      >
        {loop.map((institution, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
          <img
            key={`${institution.assetId}-${i}`}
            src={`/api/media/${institution.assetId}?trim=1`}
            alt={institution.name}
            title={institution.name}
            aria-hidden={i >= institutions.length}
            className="h-11 md:h-14 w-auto object-contain shrink-0"
          />
        ))}
      </div>
      <style>{`
        .caudall-institutions-track { animation: caudall-institutions-scroll 28s linear infinite; }
        .caudall-institutions-track.is-paused { animation-play-state: paused; }
        @keyframes caudall-institutions-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .caudall-institutions-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
