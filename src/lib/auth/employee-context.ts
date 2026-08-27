import { redirect } from 'next/navigation';
import type { Employee } from '@prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma, runWithTenantContext, type TenantContext } from '@/lib/db/prisma';

// A diferencia del lado admin (ver src/lib/auth/admin-context.ts), acá NO
// hace falta un paso previo de contexto 'session-subject': el JWT del
// empleado ya trae tenantId firmado (ver src/lib/auth/auth.config.ts), así
// que se puede fijar contexto 'tenant' directamente, de una — sin
// depender del escape hatch employeeId=session-subject que licenses NO
// tiene (licenses no lleva employeeId propio, solo tenantId; ver
// prisma/migrations/*_enable_rls).
export async function requireEmployee(): Promise<Employee> {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as
    | { id?: string; tenantId?: string; role?: 'employee' | 'admin' }
    | undefined;
  if (sessionUser?.role !== 'employee' || !sessionUser.id || !sessionUser.tenantId) {
    redirect('/');
  }

  const employee = await runWithTenantContext(
    { kind: 'tenant', tenantId: sessionUser.tenantId },
    () => prisma.employee.findUnique({ where: { id: sessionUser.id! } })
  );
  if (!employee) redirect('/');
  return employee;
}

export function employeeTenantContext(employee: Pick<Employee, 'tenantId'>): TenantContext {
  return { kind: 'tenant', tenantId: employee.tenantId };
}

// Caso común: resolver el empleado y correr el resto de la page/action
// bajo su propio contexto de tenant.
export async function requireEmployeeWithContext<T>(
  fn: (employee: Employee) => Promise<T>
): Promise<T> {
  const employee = await requireEmployee();
  return runWithTenantContext(employeeTenantContext(employee), () => fn(employee));
}
