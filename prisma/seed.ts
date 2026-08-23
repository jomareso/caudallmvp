// Carga el Banco Maestro Caudall (prisma/seed-data/banco-maestro-v3.json),
// convertido desde el Excel real que diseñó la fundadora — no es contenido de
// desarrollo. Ver prisma/seed-data/README.md para el origen. Las 314
// preguntas del banco están completas desde la corrección v3.1 del Excel
// (antes solo 94 de 314 cargaban, por constructos/variables de sesgos
// conductuales que faltaban).
//
// Seguro de correr varias veces (usa upsert en todo).

import { PrismaClient, InterventionType } from '@prisma/client';
import interventionCatalogDraft from './seed-data/intervention-catalog-draft.json';
import { syncBancoMaestro } from '../src/lib/seed/sync-banco-maestro';

const prisma = new PrismaClient();

async function main() {
  const bancoSummary = await syncBancoMaestro(prisma);

  const methodology = await prisma.methodology.findUniqueOrThrow({ where: { version: bancoSummary.methodologyVersion } });
  const questionBank = await prisma.questionBank.findUniqueOrThrow({ where: { version: bancoSummary.questionBankVersion } });
  const dimensionIdByCode = new Map<string, string>(
    (await prisma.dimension.findMany({ where: { methodologyId: methodology.id } })).map((d) => [d.code, d.id])
  );

  // Catálogo de intervenciones — BORRADOR (spec §28/Decisión 2: contenido
  // educativo/conductual, no productos financieros). Redactado a partir de
  // los ejemplos reales de BehavioralTechnique.example de la fundadora, no
  // inventado desde cero. Status DRAFT a propósito: no se activa solo por
  // estar cargado, queda pendiente de que Reynoso lo revise y apruebe
  // antes de promoverlo a ACTIVE (ver prisma/seed-data/README.md).
  const interventionCatalog = await prisma.interventionCatalog.upsert({
    where: { version: interventionCatalogDraft.version },
    update: { status: 'DRAFT' },
    create: { version: interventionCatalogDraft.version, status: 'DRAFT' }
  });

  for (const i of interventionCatalogDraft.interventions) {
    const dimensionId = dimensionIdByCode.get(i.dimension);
    if (!dimensionId) continue;

    const existing = await prisma.intervention.findFirst({
      where: { catalogId: interventionCatalog.id, titleI18nKey: `interventions.${i.i18nKeyBase}.title` }
    });

    const data = {
      catalogId: interventionCatalog.id,
      type: i.type as InterventionType,
      dimensionId,
      appliesToStates: i.appliesToStates,
      appliesToStages: [] as string[],
      financialReadinessRequired: i.financialReadinessRequired,
      behavioralReadinessRequired: null,
      behavioralTechniqueCode: i.frictionCode,
      titleI18nKey: `interventions.${i.i18nKeyBase}.title`,
      descriptionI18nKey: `interventions.${i.i18nKeyBase}.description`,
      actionTextI18nKey: `interventions.${i.i18nKeyBase}.actionText`,
      whyThisStepI18nKey: `interventions.${i.i18nKeyBase}.whyThisStep`,
      videoUrl: i.videoUrl ?? null
    };

    if (existing) {
      await prisma.intervention.update({ where: { id: existing.id }, data });
    } else {
      await prisma.intervention.create({ data });
    }
  }

  const tenant = await prisma.tenant.upsert({
    where: { enrollmentCode: 'ACME2026' },
    update: {
      methodologyVersionId: methodology.version,
      questionBankVersionId: questionBank.version
    },
    create: {
      name: 'Empresa Acme',
      enrollmentCode: 'ACME2026',
      methodologyVersionId: methodology.version,
      questionBankVersionId: questionBank.version
    }
  });

  // Bootstrap del primer admin: sin autoregistro (a diferencia del
  // empleado), un AdminUser solo existe si alguien lo crea a mano. Este es
  // el ADM inicial para poder entrar al panel administrativo.
  const founderAdmin = await prisma.adminUser.upsert({
    where: { email: 'reynososoler@gmail.com' },
    update: {},
    create: { email: 'reynososoler@gmail.com', profileType: 'ADM' }
  });

  console.log('Seed del Banco Maestro listo:');
  console.log(`- Methodology ${methodology.version} (ACTIVE)`);
  console.log(`- ${bancoSummary.constructs} constructos, ${bancoSummary.variables} variables`);
  console.log(
    `- QuestionBank ${questionBank.version} con ${bancoSummary.questionsActive} preguntas activas y ${bancoSummary.questionsDraft} en DRAFT`
  );
  if (bancoSummary.questionsSkipped.length > 0) {
    console.log(`  (${bancoSummary.questionsSkipped.length} preguntas saltadas por variable no encontrada: ${bancoSummary.questionsSkipped.join(', ')})`);
  }
  console.log(
    `- ${bancoSummary.inferenceRules} inference rules, ${bancoSummary.forbiddenInferences} forbidden inferences, ${bancoSummary.qaScenarios} QA scenarios`
  );
  console.log(`- Tenant demo: ${tenant.name} (código ${tenant.enrollmentCode})`);
  console.log(
    `- Catálogo de intervenciones ${interventionCatalog.version} (${interventionCatalog.status}) con ${interventionCatalogDraft.interventions.length} intervenciones — pendiente de tu revisión`
  );
  console.log(`- Admin inicial (ADM): ${founderAdmin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
