import { headers } from 'next/headers';

// Los magic links deben apuntar a donde realmente se pidieron, no a una URL
// fija: en Netlify cada Deploy Preview de PR vive en su propio subdominio
// (deploy-preview-N--...), y NEXT_PUBLIC_APP_URL es un solo valor por
// contexto (no uno por PR) — si se usara para armar el link, todos los
// previews activos mandarían al mismo sitio fijo en vez del que originó
// la petición.
export function getRequestOrigin(): string {
  const headerList = headers();
  const host = headerList.get('host');
  if (!host) return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const proto = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
