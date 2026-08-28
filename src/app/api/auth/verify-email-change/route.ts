import { NextResponse } from 'next/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { verifyMagicLinkToken } from '@/lib/auth/magic-link';

// No inicia sesión (a diferencia de /api/auth/verify) — solo aplica el
// cambio de correo y manda de vuelta a Configuración. Requiere sesión
// activa del mismo empleado: un token de email-change interceptado no
// sirve por sí solo para tocar la cuenta si el navegador de quien lo abre
// no tiene ya esa sesión.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/registro/invalido', request.url));
  }

  const payload = await verifyMagicLinkToken(token);
  if (!payload || payload.type !== 'email-change') {
    return NextResponse.redirect(new URL('/registro/invalido', request.url));
  }

  await runWithTenantContext({ kind: 'tenant', tenantId: payload.tenantId }, async () => {
    const employee = await prisma.employee.findUnique({ where: { id: payload.employeeId } });
    if (!employee) return;

    // Si alguien más ya tomó ese correo en el tenant desde que se pidió el
    // cambio (carrera improbable pero posible dentro de la ventana de 15
    // min), no lo pisamos — la unique constraint de todas formas lo
    // impediría, pero así no revienta con un 500.
    const taken = await prisma.employee.findUnique({
      where: { tenantId_personalEmail: { tenantId: payload.tenantId, personalEmail: payload.newEmail } }
    });
    if (taken) return;

    await prisma.employee.update({
      where: { id: employee.id },
      data: { personalEmail: payload.newEmail }
    });
  });

  return NextResponse.redirect(new URL('/perfil/correo-actualizado', request.url));
}
