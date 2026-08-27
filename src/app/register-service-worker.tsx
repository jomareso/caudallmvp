'use client';

import { useEffect } from 'react';

// next-pwa (v5.6.0) intenta auto-registrar el service worker inyectándose
// en el entry `main.js` de webpack — eso existe en Pages Router, pero el
// App Router de Next.js no genera ese entry con ese nombre, así que la
// inyección de next-pwa no hace nada (sin error, sin log: entries['main.js']
// simplemente no existe y el injection se salta en silencio). Verificado:
// con next-pwa "configurado", el navegador nunca llegaba a registrar
// /sw.js — sin service worker registrado, ni el prompt de instalación del
// PWA ni las notificaciones push (que dependen del mismo registration)
// funcionaban, pese a que manifest.json y sw.js se generaban bien.
//
// Fix estándar para next-pwa + App Router: registrar el service worker a
// mano desde un Client Component montado una vez en el root layout.
export function RegisterServiceWorker() {
  useEffect(() => {
    // next-pwa solo genera /sw.js en producción (`disable:
    // NODE_ENV === 'development'` en next.config.js) — en dev ese archivo
    // no existe, registrarlo ahí solo generaría un 404 sin ningún beneficio.
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[RegisterServiceWorker] fallo al registrar', error);
    });
  }, []);

  return null;
}
