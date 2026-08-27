import webpush from 'web-push';
import { prisma } from '@/lib/db/prisma';

// Decisión 9: notificaciones push del PWA. Esta pieza solo sabe ENVIAR a
// las suscripciones ya guardadas de un empleado — decidir CUÁNDO enviar
// (recordatorios de diagnóstico incompleto, de un compromiso pendiente,
// etc.) es una decisión de producto/conductual aparte (regla CORE #19:
// FRICTION -> TECHNIQUE, no al revés) que todavía no está definida, y
// además requeriría un programador de tareas que hoy no existe en el
// proyecto. Por ahora el único llamador real es el envío manual de prueba
// desde Admin (ver admin/notificaciones/actions.ts).

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      'Notificaciones push no configuradas: faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT. Ver .env.example.'
    );
  }
  return { publicKey, privateKey, subject };
}

// Llama SIEMPRE dentro de runWithTenantContext del caller — esta función,
// como el resto de los engines, no gestiona su propio contexto de RLS.
export async function sendPushToEmployee(
  employeeId: string,
  payload: PushPayload
): Promise<{ sent: number; expired: number }> {
  const { publicKey, privateKey, subject } = getVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subscriptions = await prisma.pushSubscription.findMany({ where: { employeeId } });

  let sent = 0;
  let expired = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (error) {
      // 404/410 = el navegador ya no reconoce esta suscripción (el
      // usuario la revocó, borró datos del sitio, etc.) — se limpia en
      // vez de seguir intentando enviarle para siempre.
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        expired += 1;
      } else {
        throw error;
      }
    }
  }

  return { sent, expired };
}
