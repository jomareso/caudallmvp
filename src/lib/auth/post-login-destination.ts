import { prisma, runWithTenantContext } from '@/lib/db/prisma';

export type PostLoginDestination = '/bienvenida' | '/inicio';

// Auditoría UX del flujo colaborador (28 ago): un empleado que ya completó
// su diagnóstico nunca debe volver a ver Bienvenida ("ahora vamos a
// conocer tu salud financiera") — entra directo a Inicio (índice +
// compromiso pendiente + invitación a actualizar después de un tiempo).
// Solo quien nunca lo completó pasa por Bienvenida. El criterio es único
// y binario: FinancialState.lastDiagnosticCompletedAt, sin importar
// cuánto tiempo pasó desde entonces (ver finalizeDiagnostic en
// diagnostic-completion.ts, que es quien lo fija).
export async function getEmployeePostLoginDestination(
  employeeId: string,
  tenantId: string
): Promise<PostLoginDestination> {
  const financialState = await runWithTenantContext({ kind: 'tenant', tenantId }, () =>
    prisma.financialState.findUnique({
      where: { employeeId },
      select: { lastDiagnosticCompletedAt: true }
    })
  );
  return financialState?.lastDiagnosticCompletedAt ? '/inicio' : '/bienvenida';
}
