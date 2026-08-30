import { NextResponse } from 'next/server';
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
    // de eso, cae al archivo estático que ya usan las pantallas del
    // empleado (ver src/app/(employee)/acceso/brand-panel.tsx): admin
    // siempre tiene un logo real por defecto, y quien suba uno propio
    // desde Configuración lo sigue reemplazando igual que antes.
    const fallback = NextResponse.redirect(new URL('/brand/caudall-logo-color.png', request.url));
    fallback.headers.set('Cache-Control', 'public, max-age=300, must-revalidate');
    return fallback;
  }

  return new Response(new Uint8Array(settings.logoData), {
    headers: {
      'Content-Type': settings.logoMimeType,
      'Cache-Control': 'public, max-age=300, must-revalidate'
    }
  });
}
