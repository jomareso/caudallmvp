import { prisma } from '@/lib/db/prisma';

// Sin esto, Next.js intenta pre-renderizar esta ruta en build time (no usa
// cookies/headers, así que su heurística la marca como estática) — eso
// intenta consultar la base de datos durante el build, que puede no ser
// alcanzable ahí. Tiene que resolverse en cada request real.
export const dynamic = 'force-dynamic';

// Público a propósito: el logo tiene que verse en la pantalla de entrada
// del empleado, antes de cualquier login.
export async function GET(request: Request) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });

  if (!settings?.logoData || !settings.logoMimeType) {
    // Sin logo subido desde Configuración (ej. nunca se hizo en
    // producción), esta ruta devolvía 404 y todo lo que la consume
    // (sidebar, menú móvil, login de admin) caía al texto genérico
    // "caudall" — el panel de Caudall no mostraba su propio logo. En vez
    // de eso, sirve el mismo archivo estático que ya usan las pantallas
    // del empleado (ver (employee)/acceso/brand-panel.tsx): admin
    // siempre tiene un logo real por defecto, y quien suba uno propio
    // desde Configuración lo sigue reemplazando igual que antes.
    //
    // Un 200 con los bytes acá (no un redirect a /brand/...png): el
    // service worker del PWA cachea /api/* con NetworkFirst (ver
    // next-pwa/cache.js, regla "apis") — un redirect (3xx) es una forma
    // de respuesta nueva para esta ruta que nunca se probó contra esa
    // capa de caché, y la manera más segura de no depender de cómo la
    // maneja es no generarla: la ruta responde siempre con la imagen
    // directa, como ya hacía en la rama de logo subido.
    const staticLogo = await fetch(new URL('/brand/caudall-logo-color.png', request.url));
    return new Response(staticLogo.body, {
      headers: {
        'Content-Type': staticLogo.headers.get('Content-Type') ?? 'image/png',
        'Cache-Control': 'public, max-age=300, must-revalidate'
      }
    });
  }

  return new Response(new Uint8Array(settings.logoData), {
    headers: {
      'Content-Type': settings.logoMimeType,
      'Cache-Control': 'public, max-age=300, must-revalidate'
    }
  });
}
