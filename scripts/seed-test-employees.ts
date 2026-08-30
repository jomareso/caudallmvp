// Genera (o limpia) empleados de prueba con diagnóstico completo en un
// tenant, para poder ver el dashboard de RRHH y su segmentación (Motor de
// Comparación Social, PR #85/#86) con datos reales sin esperar a tener
// empleados de verdad.
//
// NO forma parte de la app (no se importa desde src/). Se corre a mano,
// una sola vez, apuntando a la base que quieras (local o producción) según
// el DATABASE_URL activo en tu entorno al momento de correrlo — este
// script nunca decide eso por ti.
//
// Uso:
//   DATABASE_URL="<tu URL de producción>" npx tsx scripts/seed-test-employees.ts seed test --yes
//   DATABASE_URL="<tu URL de producción>" npx tsx scripts/seed-test-employees.ts cleanup test --yes
//
// Args: <seed|cleanup> <nombre-del-tenant> --yes
// - "seed" sin --yes solo muestra qué haría (dry-run) y no escribe nada.
// - "cleanup" borra TODOS los empleados de ese tenant cuyo correo empiece
//   con qa-seed- (nunca toca empleados reales, sin importar el filtro).
//
// Qué crea "seed": 55 empleados con el mismo contexto (edad 25-34, ingreso
// RD$50-74K, 1 dependiente, empleado privado, femenino) — suficiente para
// pasar el N mínimo individual (50, configurable en
// /admin/metodologia/parametros) Y el N mínimo de RRHH (20) para ESE
// segmento exacto — más 12 empleados con contexto variado, para que el
// resto del dashboard (condición general, promedio por dimensión) no se
// vea artificialmente uniforme. Todos con FinancialState.cfhiScore y las 5
// DimensionScore ya calculadas (no responden preguntas una por una).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL_PREFIX = 'qa-seed-';

const CTX_VARIABLE_CODES = [
  'CTX_AGE_BAND',
  'CTX_INCOME_BAND',
  'CTX_DEPENDENTS',
  'CTX_EMPLOYMENT_STATUS',
  'CTX_SEX'
] as const;

// El segmento "principal" — concentrado para pasar ambos umbrales de N.
const MAIN_CTX: Record<string, string> = {
  CTX_AGE_BAND: 'AGE_25_34',
  CTX_INCOME_BAND: 'INC_50_74K',
  CTX_DEPENDENTS: 'DEP_1',
  CTX_EMPLOYMENT_STATUS: 'PRIVATE_EMPLOYEE',
  CTX_SEX: 'FEMALE'
};
const MAIN_COUNT = 55;

// Variedad para el resto del tenant — no pasan ningún umbral por sí solos,
// son solo para que "Condición general" / "Tus 5 dimensiones" del
// dashboard general no se vean con un solo tipo de persona.
const VARIANT_CTX_POOL: Record<string, string>[] = [
  { CTX_AGE_BAND: 'AGE_35_44', CTX_INCOME_BAND: 'INC_75_99K', CTX_DEPENDENTS: 'DEP_2', CTX_EMPLOYMENT_STATUS: 'PRIVATE_EMPLOYEE', CTX_SEX: 'MALE' },
  { CTX_AGE_BAND: 'AGE_18_24', CTX_INCOME_BAND: 'INC_25_49K', CTX_DEPENDENTS: 'DEP_0', CTX_EMPLOYMENT_STATUS: 'STUDENT', CTX_SEX: 'FEMALE' },
  { CTX_AGE_BAND: 'AGE_45_54', CTX_INCOME_BAND: 'INC_100_149K', CTX_DEPENDENTS: 'DEP_3', CTX_EMPLOYMENT_STATUS: 'SELF_EMPLOYED', CTX_SEX: 'MALE' },
  { CTX_AGE_BAND: 'AGE_55_64', CTX_INCOME_BAND: 'INC_LT_25K', CTX_DEPENDENTS: 'DEP_4_PLUS', CTX_EMPLOYMENT_STATUS: 'PUBLIC_EMPLOYEE', CTX_SEX: 'FEMALE' }
];
const VARIANT_COUNT = 12;

const DIMENSIONS = ['CONTROL', 'RESILIENCE', 'DEBT', 'SAVING', 'PLANNING'] as const;

function dimensionState(score: number): 'CRITICAL' | 'UNMET' | 'PARTIAL' | 'MET' {
  if (score >= 71) return 'MET';
  if (score >= 51) return 'PARTIAL';
  if (score >= 31) return 'UNMET';
  return 'CRITICAL';
}

// Distribución fija (no random) para que el dashboard muestre algo con
// forma real (Vulnerables/Sobreviviendo/Saludables mezclados) y sea
// reproducible si hay que volver a correrlo.
function scoreForIndex(i: number): number {
  const pattern = [18, 35, 42, 55, 62, 68, 74, 81, 88, 95, 47, 59];
  return pattern[i % pattern.length];
}

async function findTenant(name: string) {
  const tenant = await prisma.tenant.findFirst({ where: { name } });
  if (!tenant) {
    const all = await prisma.tenant.findMany({ select: { name: true, enrollmentCode: true } });
    console.error(`No existe ningún tenant con name="${name}". Tenants disponibles:`);
    for (const t of all) console.error(`  - ${t.name} (${t.enrollmentCode})`);
    process.exit(1);
  }
  return tenant;
}

async function seed(tenantName: string, dryRun: boolean) {
  const tenant = await findTenant(tenantName);
  const methodology = await prisma.methodology.findFirstOrThrow({
    where: { status: 'ACTIVE' },
    include: { dimensions: true }
  });
  const dimensionIdByCode = new Map(methodology.dimensions.map((d) => [d.code, d.id]));

  const variables = await prisma.variable.findMany({ where: { code: { in: [...CTX_VARIABLE_CODES] } } });
  const variableIdByCode = new Map(variables.map((v) => [v.code, v.id]));
  for (const code of CTX_VARIABLE_CODES) {
    if (!variableIdByCode.has(code)) {
      console.error(`Falta la variable ${code} en esta base — ¿corriste "Sincronizar banco de preguntas"?`);
      process.exit(1);
    }
  }

  const batch: { ctx: Record<string, string>; score: number }[] = [];
  for (let i = 0; i < MAIN_COUNT; i++) batch.push({ ctx: MAIN_CTX, score: scoreForIndex(i) });
  for (let i = 0; i < VARIANT_COUNT; i++) {
    batch.push({ ctx: VARIANT_CTX_POOL[i % VARIANT_CTX_POOL.length], score: scoreForIndex(i + 3) });
  }

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Se crearán ${batch.length} empleados (${MAIN_COUNT} en el segmento principal + ${VARIANT_COUNT} variados).`);
  console.log(`Prefijo de correo: ${EMAIL_PREFIX}* — fáciles de encontrar y borrar después con "cleanup".`);

  if (dryRun) {
    console.log('\nDRY RUN — no se escribió nada. Vuelve a correr con --yes para aplicar.');
    return;
  }

  const now = Date.now();
  let created = 0;
  for (let i = 0; i < batch.length; i++) {
    const { ctx, score } = batch[i];
    const email = `${EMAIL_PREFIX}${now}-${i}@caudall-test.example`;

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        personalEmail: email,
        enrollmentCodeUsed: tenant.enrollmentCode,
        authMethod: 'MAGIC_LINK'
      }
    });

    for (const [code, state] of Object.entries(ctx)) {
      const variableId = variableIdByCode.get(code)!;
      await prisma.variableState.create({
        data: {
          employeeId: employee.id,
          variableId,
          value: { variableCode: code, state },
          confidence: 100,
          state,
          derivedFromEvidenceIds: []
        }
      });
    }

    await prisma.financialState.create({
      data: { employeeId: employee.id, cfhiScore: score, cfhiConfidence: 80, lastDiagnosticCompletedAt: new Date() }
    });

    for (const [j, dim] of DIMENSIONS.entries()) {
      const dimensionId = dimensionIdByCode.get(dim);
      if (!dimensionId) continue;
      // Pequeña variación por dimensión (±6) para que no las 5 salgan
      // idénticas al CFHI — sigue siendo determinístico, no random.
      const dimScore = Math.max(0, Math.min(100, score + (j - 2) * 3));
      await prisma.dimensionScore.create({
        data: { employeeId: employee.id, dimensionId, score: dimScore, state: dimensionState(dimScore), confidence: 80 }
      });
    }

    created++;
  }

  console.log(`\nListo — ${created} empleados de prueba creados en "${tenant.name}".`);
  console.log(`Filtra en /admin/empresa por Edad=25 a 34 años + Ingreso=RD$50,000 a RD$74,999 para ver el segmento principal (${MAIN_COUNT} personas).`);
}

async function cleanup(tenantName: string, dryRun: boolean) {
  const tenant = await findTenant(tenantName);
  const employees = await prisma.employee.findMany({
    where: { tenantId: tenant.id, personalEmail: { startsWith: EMAIL_PREFIX } },
    select: { id: true, personalEmail: true }
  });

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Encontrados ${employees.length} empleados de prueba (correo empieza con "${EMAIL_PREFIX}").`);

  if (employees.length === 0) return;
  if (dryRun) {
    console.log('DRY RUN — no se borró nada. Vuelve a correr con --yes para aplicar.');
    return;
  }

  const ids = employees.map((e) => e.id);
  await prisma.employeeIntervention.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.dimensionScore.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.financialState.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.variableState.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });

  console.log(`Borrados ${employees.length} empleados de prueba.`);
}

async function main() {
  const [, , mode, tenantName, flag] = process.argv;
  const dryRun = flag !== '--yes';

  if (mode !== 'seed' && mode !== 'cleanup') {
    console.error('Uso: npx tsx scripts/seed-test-employees.ts <seed|cleanup> <nombre-tenant> --yes');
    process.exit(1);
  }
  if (!tenantName) {
    console.error('Falta el nombre del tenant. Ejemplo: npx tsx scripts/seed-test-employees.ts seed test --yes');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? '(no definido)';
  const host = dbUrl.includes('@') ? dbUrl.split('@')[1]?.split('/')[0] : dbUrl;
  console.log(`DATABASE_URL apunta a: ${host}`);
  console.log(dryRun ? '(dry-run — pasa --yes al final para aplicar de verdad)\n' : '(aplicando cambios reales)\n');

  if (mode === 'seed') await seed(tenantName, dryRun);
  else await cleanup(tenantName, dryRun);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
