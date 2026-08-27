'use server';

import { z } from 'zod';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { sendPushToEmployee } from '@/lib/push/send';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido.'),
  title: z.string().trim().min(1, 'Falta el título.'),
  body: z.string().trim().min(1, 'Falta el mensaje.')
});

// Solo ADM: herramienta de verificación de la infraestructura de push
// (spec/Decisión 9), no una función de producto — enviar recordatorios de
// verdad (ej. diagnóstico incompleto, compromiso pendiente) necesita un
// programador de tareas que hoy no existe, y sobre todo, una decisión de
// PRODUCTO sobre cuándo interrumpir al empleado (regla CORE #19: la
// fricción real primero, la técnica después) — no se inventa acá.
export async function sendTestPushNotification(
  formData: FormData
): Promise<{ ok: true; sent: number; expired: number } | { ok: false; message: string }> {
  await requireAdm();

  const parsed = schema.safeParse({
    email: formData.get('email'),
    title: formData.get('title'),
    body: formData.get('body')
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos ingresados.' };
  }

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const employee = await prisma.employee.findFirst({ where: { personalEmail: parsed.data.email } });
    if (!employee) {
      return { ok: false, message: 'No encontramos ningún empleado con ese correo.' };
    }

    const subscriptionCount = await prisma.pushSubscription.count({ where: { employeeId: employee.id } });
    if (subscriptionCount === 0) {
      return { ok: false, message: 'Ese empleado no tiene notificaciones activadas todavía.' };
    }

    try {
      const result = await sendPushToEmployee(employee.id, { title: parsed.data.title, body: parsed.data.body });
      return { ok: true, sent: result.sent, expired: result.expired };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido enviando la notificación.';
      return { ok: false, message };
    }
  });
}
