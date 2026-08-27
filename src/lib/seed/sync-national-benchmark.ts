import type { PrismaClient } from '@prisma/client';
import nationalBenchmark from '../../../prisma/seed-data/national-benchmark.json';

// Comparación con pares (benchmark nacional) — carga
// prisma/seed-data/national-benchmark.json, generado desde los datos
// reales de los Estudios de Salud Financiera de Reynoso (2021-2024) vía
// prisma/seed-data/scripts/convert-national-benchmark.py. Mismo patrón
// que sync-banco-maestro.ts: el JSON es la fuente de verdad, este código
// solo lo sincroniza a la base — así corre igual en dev (prisma/seed.ts)
// y, si se necesita, desde un botón admin en producción.
//
// Idempotente por `version`: si ya existen filas de esta versión, no se
// duplican. Reemplazar el contenido significa correr el script de
// conversión con un archivo nuevo (que sube el `version`) — no editar
// filas existentes a mano.
type BenchmarkRecordInput = {
  studyYear: number | null;
  sourceLabel: string;
  sex: string | null;
  ageBand: string | null;
  educationLevel: string | null;
  employmentStatus: string | null;
  dependents: string | null;
  incomeRangeRaw: string | null;
  controlScore: number;
  savingScore: number;
  debtScore: number;
  planningScore: number;
  overallScore: number;
  condition: string | null;
};

const typedBenchmark = nationalBenchmark as { version: string; records: BenchmarkRecordInput[] };

export async function syncNationalBenchmark(prisma: PrismaClient): Promise<{ version: string; inserted: number; skipped: boolean }> {
  const { version, records } = typedBenchmark;

  const existing = await prisma.nationalBenchmarkRecord.count({ where: { version } });
  if (existing > 0) {
    return { version, inserted: 0, skipped: true };
  }

  const result = await prisma.nationalBenchmarkRecord.createMany({
    data: records.map((record) => ({ ...record, version }))
  });

  return { version, inserted: result.count, skipped: false };
}
