import { prisma } from '@/lib/db/prisma';

// Mismo patrón que /api/branding/logo: fuerza resolución en cada request
// (usa la base de datos, no puede pre-renderizarse en build time).
export const dynamic = 'force-dynamic';

// Público a propósito: las imágenes del banco de medios se usan en
// landings públicas (ej. la línea de tiempo de metodología), antes de
// cualquier login.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });

  if (!asset) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
