import sharp from 'sharp';
import { prisma } from '@/lib/db/prisma';

// Mismo patrón que /api/branding/logo: fuerza resolución en cada request
// (usa la base de datos, no puede pre-renderizarse en build time).
export const dynamic = 'force-dynamic';

// Público a propósito: las imágenes del banco de medios se usan en
// landings públicas (ej. la línea de tiempo de metodología), antes de
// cualquier login.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });

  if (!asset) return new Response(null, { status: 404 });

  // ?trim=1: recorta el margen blanco/transparente alrededor del logo
  // antes de servirlo — usado por el carrusel de instituciones (ver
  // institutions-carousel.tsx). Los logos institucionales llegan con
  // cantidades de "aire" muy distintas entre sí (algunos recortados al
  // borde de la marca, otros con mucho margen alrededor), así que a
  // igual altura de caja terminan viéndose de tamaños muy distintos. El
  // archivo original en el banco de medios NUNCA se modifica — esto solo
  // afecta lo que se sirve para esta URL puntual. No aplica a PDF (los
  // informes de metodología se enlazan, no se pintan como imagen).
  const trim = new URL(request.url).searchParams.get('trim') === '1';
  if (trim && asset.mimeType !== 'application/pdf') {
    const trimmed = await sharp(asset.data).trim().png().toBuffer();
    return new Response(new Uint8Array(trimmed), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  }

  return new Response(new Uint8Array(asset.data), {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
