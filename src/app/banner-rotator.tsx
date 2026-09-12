'use client';

import { useEffect, useState } from 'react';
import type { LandingBannerSlot } from '@/lib/landing/blocks';

type BannerSlot = { assetId: string; focalY: LandingBannerSlot['focalY'] };

const OBJECT_POSITION: Record<LandingBannerSlot['focalY'], string> = {
  top: 'center top',
  center: 'center center',
  bottom: 'center bottom'
};

// Banner de fotos genéricas del trabajo de campo, sin atarse a un año
// (distinto de los milestones/informes, que sí son por año). Se omite del
// todo si no hay ninguna foto cargada — no muestra un placeholder vacío a
// un visitante real.
//
// Los puntos debajo de la foto avisan que hay más de una Y dejan avanzar
// manualmente — antes el crossfade era @keyframes en CSS puro (sin
// cliente), pero eso no permite reaccionar a un click. El auto-avance se
// reinicia cada vez que cambia `index` (manual o automático), así un
// click no queda "compitiendo" con el timer.
//
// object-cover, con object-position según `focalY` (elegido por foto
// desde /admin/contenido, ver bannerSlotSchema en blocks.ts). No hay un
// único punto de recorte que funcione para cualquier foto de evento —
// una necesita "arriba" para no perder cabezas, otra "centro" para no
// perder el escenario. Antes probamos object-contain (foto completa,
// pero con margen vacío) y después ese margen relleno con un fondo
// desenfocado — ninguno de los dos daba la sensación de foto "llena"
// que se buscaba; dejar elegir el encuadre por foto es lo que la resuelve
// sin volver a perder contenido real (como pasaba con un recorte fijo).
export function BannerRotator({ slots }: { slots: BannerSlot[] }) {
  const n = slots.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (n <= 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % n), 4000);
    return () => clearInterval(id);
  }, [n, index]);

  if (n === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full rounded-2xl overflow-hidden border border-silver/40 bg-[#F4F5F7]" style={{ aspectRatio: '21 / 7' }}>
        {slots.map((slot, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
          <img
            key={slot.assetId}
            src={`/api/media/${slot.assetId}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            style={{ opacity: i === index ? 1 : 0, objectPosition: OBJECT_POSITION[slot.focalY] }}
          />
        ))}
      </div>
      {n > 1 ? (
        <div className="flex items-center gap-2" role="tablist" aria-label="Fotos del banner">
          {slots.map((slot, i) => (
            <button
              key={slot.assetId}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Foto ${i + 1} de ${n}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-yale' : 'w-1.5 bg-silver/70 hover:bg-silver'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
