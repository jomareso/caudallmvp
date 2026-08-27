import { prisma, runWithTenantContext } from '@/lib/db/prisma';

// Umbral mínimo de diagnósticos completados antes de confiar en el
// promedio real — con muy pocos casos, un par de valores atípicos (ej.
// alguien que dejó la pestaña abierta media hora) distorsionan el
// estimado más de lo que ayudan. Por debajo de esto, la pantalla de
// bienvenida usa el texto fijo de siempre en vez de un número inventado
// a partir de poca muestra.
const MIN_SAMPLE_SIZE = 20;

export type DiagnosticStats = {
  averageMinutes: number;
  averageQuestions: number;
};

// Promedio de TODA la plataforma (todas las empresas), no solo del tenant
// del empleado que está viendo la pantalla de bienvenida — decisión
// explícita de Reynoso: con pocos empleados por empresa al inicio, un
// promedio por tenant sería poco confiable o inexistente casi siempre.
// No es un dato sensible de ninguna empresa en particular (es un
// agregado de duración/cantidad de preguntas, sin ligar a quién
// pertenece cada fila), así que corre bajo contexto platform-admin — ver
// src/lib/db/prisma.ts.
export async function getPlatformDiagnosticStats(): Promise<DiagnosticStats | null> {
  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const result = await prisma.financialState.aggregate({
      where: {
        diagnosticDurationSeconds: { not: null },
        questionsAnsweredCount: { not: null }
      },
      _avg: { diagnosticDurationSeconds: true, questionsAnsweredCount: true },
      _count: { employeeId: true }
    });

    if (result._count.employeeId < MIN_SAMPLE_SIZE) return null;
    if (result._avg.diagnosticDurationSeconds == null || result._avg.questionsAnsweredCount == null) return null;

    return {
      averageMinutes: Math.max(1, Math.round(result._avg.diagnosticDurationSeconds / 60)),
      averageQuestions: Math.max(1, Math.round(result._avg.questionsAnsweredCount))
    };
  });
}
