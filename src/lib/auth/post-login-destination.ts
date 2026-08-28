import { prisma, runWithTenantContext } from '@/lib/db/prisma';

export type PostLoginDestination = '/bienvenida' | '/diagnostico/resultado';

// Auditoría UX del flujo colaborador (28 ago): un empleado que ya completó
// su diagnóstico nunca debe volver a ver Bienvenida ("ahora vamos a
// conocer tu salud financiera") — entra directo a ver su resultado. Solo
// quien nunca lo completó pasa por Bienvenida. El criterio es único y
// binario: FinancialState.lastDiagnosticCompletedAt, sin importar cuánto
// tiempo pasó desde entonces (ver finalizeDiagnostic en
// diagnostic-completion.ts, que es quien lo fija).
//
// El destino para "ya completó" hoy es /diagnostico/resultado; cuando
// exista una pantalla de inicio dedicada (índice + compromiso pendiente +
// invitación a actualizar el diagnóstico después de un tiempo
// configurable, todavía sin construir) este helper apuntará ahí en su
// lugar, sin que quien lo llama tenga que cambiar.
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
  return financialState?.lastDiagnosticCompletedAt ? '/diagnostico/resultado' : '/bienvenida';
}
