import { prisma } from '@/lib/db/prisma';

// Sin esto, Next.js intenta pre-renderizar esta ruta en build time (no usa
// cookies/headers, así que su heurística la marca como estática) — eso
// intenta consultar la base de datos durante el build, que puede no ser
// alcanzable ahí. Tiene que resolverse en cada request real.
export const dynamic = 'force-dynamic';

// Público a propósito: el logo tiene que verse en la pantalla de entrada
// del empleado, antes de cualquier login.
export async function GET() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'singleton' } });

  if (!settings?.logoData || !settings.logoMimeType) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(settings.logoData), {
    headers: {
      'Content-Type': settings.logoMimeType,
      'Cache-Control': 'public, max-age=300, must-revalidate'
    }
  });
}
