'use server';

import { prisma } from '@/lib/db/prisma';
import { requireEmployeeWithContext } from '@/lib/auth/employee-context';

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function subscribeToPush(input: PushSubscriptionInput): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.endpoint || !input.keys?.p256dh || !input.keys?.auth) {
    return { ok: false, message: 'Suscripción inválida.' };
  }

  return requireEmployeeWithContext(async (employee) => {
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      // Un mismo endpoint (navegador/dispositivo) puede haber quedado
      // asociado a otro empleado antes (ej. sesión compartida en un
      // equipo público) — al re-suscribirse, pasa a ser de quien lo pide
      // ahora.
      update: { employeeId: employee.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
      create: {
        employeeId: employee.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth
      }
    });
    return { ok: true };
  });
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!endpoint) return { ok: false, message: 'Falta el endpoint.' };

  return requireEmployeeWithContext(async () => {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  });
}
