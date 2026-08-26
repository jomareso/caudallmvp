import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';

// Decisión 6 (actualizada): una licencia vencida le quita el acceso al
// empleado (confirmado por Reynoso). El chequeo vive acá, no en cada
// página, porque aplica a todo el journey del empleado por igual. Sin
// sesión (landing, registro) no hay nada que verificar — pasa de largo.
//
// No se cierra la sesión (signOut solo funciona en Server Actions/Route
// Handlers, no en un layout renderizando una request normal): basta con
// que esta misma verificación repita el redirect en cada página del
// empleado — el JWT sigue existiendo, pero nunca deja pasar a nada.
export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as
    | { id?: string; tenantId?: string; role?: 'employee' | 'admin' }
    | undefined;

  if (sessionUser?.role === 'employee' && sessionUser.id && sessionUser.tenantId) {
    // El JWT del empleado ya trae tenantId firmado — contexto 'tenant'
    // directo, sin bootstrap de session-subject (ver
    // src/lib/auth/employee-context.ts). Nota: este wrap protege SOLO las
    // consultas de este layout — no se propaga a la Page anidada (cada
    // page.tsx bajo (employee)/ resuelve su propio contexto).
    await runWithTenantContext({ kind: 'tenant', tenantId: sessionUser.tenantId }, async () => {
      const employee = await prisma.employee.findUnique({
        where: { id: sessionUser.id! },
        include: { license: true, tenant: true }
      });

      // Una empresa suspendida corta el acceso de sus empleados igual que una
      // licencia vencida — no se borra nada, solo deja de admitir entrada.
      if (employee?.tenant.status === 'SUSPENDED') {
        redirect('/licencia-vencida?motivo=suspendida');
      }

      const license = employee?.license;
      const justExpired = license?.status === 'ACTIVE' && license.expiresAt && license.expiresAt < new Date();

      if (justExpired) {
        await prisma.license.update({ where: { id: license.id }, data: { status: 'EXPIRED' } });
      }

      if (justExpired || license?.status === 'EXPIRED') {
        redirect('/licencia-vencida');
      }
    });
  }

  return <>{children}</>;
}
