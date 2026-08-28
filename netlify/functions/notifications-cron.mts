// Netlify Scheduled Function (Decisión 9 / ítem 7 de la auditoría UX).
//
// Vive fuera de src/ y usa la extensión .mts a propósito: los Netlify
// Functions v2 la reconocen por convención, y tsconfig.json de la app solo
// incluye **/*.ts — así este archivo no entra al `tsc --noEmit` ni al
// linter de la app (que exige estar dentro de src/), evitando arrastrar
// tipos de @netlify/functions como dependencia nueva solo para esto.
//
// La lógica real vive en la app (POST /api/cron/notifications ->
// src/lib/push/notification-engine.ts) — esta función solo decide CUÁNDO
// (el `schedule` de abajo) y dispara esa ruta con el secreto compartido.
// Netlify inyecta las variables de entorno del sitio (incluida
// CRON_SECRET) también en las Functions, así que no hace falta duplicarlas
// acá.
export default async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;

  if (!appUrl || !secret) {
    console.error('[notifications-cron] faltan NEXT_PUBLIC_APP_URL o CRON_SECRET');
    return new Response('Configuración incompleta', { status: 500 });
  }

  const response = await fetch(new URL('/api/cron/notifications', appUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` }
  });

  const body = await response.text();
  if (!response.ok) {
    console.error('[notifications-cron] el motor respondió con error', response.status, body);
    return new Response(body, { status: response.status });
  }

  console.log('[notifications-cron] barrido completo', body);
  return new Response(body, { status: 200 });
};

// Una vez al día, 12:00 UTC (8:00am en RD, UTC-4) — suficiente margen de
// mañana sin ser tan temprano que interrumpa el sueño de nadie.
export const config = { schedule: '0 12 * * *' };
