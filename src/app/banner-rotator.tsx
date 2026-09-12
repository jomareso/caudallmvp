'use client';

import { useEffect, useState } from 'react';

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
// object-contain, no object-cover: una foto de evento real (varias
// personas, banners a los lados) no siempre tiene la proporción 21/7 del
// marco — recortarla (cover) le cortaba contenido real a algunas fotos
// (encontrado con una foto de panel: quedaba tan encimada que perdía el
// logo y la pantalla). contain siempre muestra la foto completa, sin
// adivinar dónde recortar.
//
// El margen que deja contain (foto vertical en un marco 21/7 bien ancho)
// no se rellena con un color plano — se ve a medio hacer, como si algo
// faltara. En vez de eso, atrás va la misma foto ampliada y desenfocada
// (mismo patrón que carátulas de Spotify/Apple TV que no calzan con su
// marco): dos <img> por slide, la de atrás en object-cover + blur, la de
// adelante en object-contain nítida encima.
export function BannerRotator({ imageIds }: { imageIds: string[] }) {
  const n = imageIds.length;
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
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-silver/40 bg-[#F4F5F7]"
        style={{ aspectRatio: '21 / 7' }}
      >
        {imageIds.map((id, i) => (
          <div key={id} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === index ? 1 : 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable */}
            <img
              src={`/api/media/${id}`}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-75 saturate-150"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable */}
            <img src={`/api/media/${id}`} alt="" className="absolute inset-0 w-full h-full object-contain" />
          </div>
        ))}
      </div>
      {n > 1 ? (
        <div className="flex items-center gap-2" role="tablist" aria-label="Fotos del banner">
          {imageIds.map((id, i) => (
            <button
              key={id}
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
