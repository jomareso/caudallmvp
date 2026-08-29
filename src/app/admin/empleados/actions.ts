'use server';

import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';

export type EmployeeSearchResult = {
  id: string;
  personalEmail: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  lastActiveAt: string | null;
  licenseCode: string | null;
  licenseStatus: string | null;
};

const emailSchema = z.string().trim().toLowerCase().email();

// Búsqueda por correo exacto (no por tenant) a propósito: un mismo correo
// puede haberse registrado bajo más de un tenant de prueba, y quien usa
// esta herramienta (siempre ADM) necesita ver TODAS las cuentas de ese
// correo, no solo la de un tenant puntual — de ahí platform-admin.
export async function searchEmployeesByEmail(rawEmail: string): Promise<EmployeeSearchResult[]> {
  await requireAdm();
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return [];

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const employees = await prisma.employee.findMany({
      where: { personalEmail: parsed.data },
      include: { tenant: { select: { name: true } }, license: { select: { code: true, status: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return employees.map((e) => ({
      id: e.id,
      personalEmail: e.personalEmail,
      tenantId: e.tenantId,
      tenantName: e.tenant.name,
      createdAt: e.createdAt.toISOString(),
      lastActiveAt: e.lastActiveAt?.toISOString() ?? null,
      licenseCode: e.license?.code ?? null,
      licenseStatus: e.license?.status ?? null
    }));
  });
}

// Herramienta de prueba/soporte: borra un empleado por completo (todo lo
// que cuelga de él — evidencia, scores, compromisos) y libera su licencia
// (vuelve a UNUSED, sin activatedAt/expiresAt) para que el mismo código se
// pueda usar de nuevo, como si nunca se hubiera usado. Deliberadamente NO
// hace un soft-delete ni preserva el historial — es justo lo contrario de
// AuditLog en el resto del admin (ahí sí se conserva todo): esto existe
// para volver a un correo a "nunca se registró", no para revisar qué pasó.
// Sí queda una fila en AuditLog del RESET en sí (quién, cuándo, sobre qué
// correo) — lo que se borra no, lo que se hizo sí.
//
// La mayoría de relaciones de Employee NO tienen onDelete: Cascade en el
// schema (solo PushSubscription/NotificationPreference/NotificationLog sí)
// — sin borrar el resto a mano primero, prisma.employee.delete() fallaría
// por llave foránea.
export async function resetEmployee(employeeId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdm();
  const t = await getTranslations('admin.empleados');

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return { ok: false, message: t('errorNotFound') };

    // No usa prisma.$transaction() a propósito: el wrapper de RLS
    // (src/lib/db/prisma.ts) ya envuelve CADA operación individual en su
    // propia mini-transacción (para fijar la variable de sesión de
    // Postgres antes de esa query puntual) — pasarle a $transaction() un
    // array de operaciones ya interceptadas así no las corre como una
    // transacción de verdad (confirmado en pruebas: el delete del
    // empleado se disparaba antes de que el deleteMany de financial_states
    // hubiera terminado, violando la llave foránea). Awaits secuenciales
    // sí garantizan el orden — mismo patrón que el resto del código base
    // usa para escrituras de varios pasos bajo este mismo wrapper.
    await prisma.evidence.deleteMany({ where: { employeeId } });
    await prisma.variableState.deleteMany({ where: { employeeId } });
    await prisma.constructScore.deleteMany({ where: { employeeId } });
    await prisma.dimensionScore.deleteMany({ where: { employeeId } });
    await prisma.financialState.deleteMany({ where: { employeeId } });
    await prisma.safetyFlag.deleteMany({ where: { employeeId } });
    await prisma.employeeIntervention.deleteMany({ where: { employeeId } });
    await prisma.employeeSegment.deleteMany({ where: { employeeId } });

    if (employee.licenseId) {
      await prisma.license.update({
        where: { id: employee.licenseId },
        data: { status: 'UNUSED', activatedAt: null, expiresAt: null }
      });
    }

    await prisma.employee.delete({ where: { id: employeeId } });

    await prisma.auditLog.create({
      data: {
        whoId: actor.id,
        whoData: { email: actor.email, profileType: actor.profileType },
        what: 'RESET_EMPLOYEE',
        entityType: 'Employee',
        entityId: employeeId,
        previousValue: { personalEmail: employee.personalEmail, tenantId: employee.tenantId, licenseId: employee.licenseId }
      }
    });

    return { ok: true };
  });
}
