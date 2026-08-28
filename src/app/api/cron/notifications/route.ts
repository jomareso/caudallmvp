import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runNotificationEngine } from '@/lib/push/notification-engine';

// Disparado una vez al día por netlify/functions/notifications-cron.mts
// (Netlify Scheduled Function) — ver ese archivo para el horario. Protegido
// por CRON_SECRET porque, a diferencia de las Server Actions del resto de
// la app, esta ruta no tiene una sesión de usuario detrás: cualquiera que
// conozca la URL podría dispararla y vaciar el catálogo de notificaciones
// pendientes antes de que le toquen a los empleados reales.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: 'No autorizado.' }, { status: 401 });
  }

  try {
    const summary = await runNotificationEngine();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido en el motor de notificaciones.';
    console.error('[cron/notifications] fallo el barrido', error);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
