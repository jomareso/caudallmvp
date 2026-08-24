import bancoMaestro from '../../../prisma/seed-data/banco-maestro-v3.json';

export type BancoMaestroConstruct = (typeof bancoMaestro)['constructs'][number];
export type BancoMaestroVariable = (typeof bancoMaestro)['variables'][number];
export type BancoMaestroQuestion = (typeof bancoMaestro)['questions'][number];
export type BancoMaestroInferenceRule = (typeof bancoMaestro)['inferenceRules'][number];
export type BancoMaestroForbiddenInference = (typeof bancoMaestro)['forbiddenInferences'][number];
export type BancoMaestroQaScenario = (typeof bancoMaestro)['qaScenarios'][number];
export type BancoMaestroBehavioralTechnique = (typeof bancoMaestro)['behavioralTechniques'][number];
export type BancoMaestroBehavioralBiasMapEntry = (typeof bancoMaestro)['behavioralBiasMap'][number];

// Misma fuente que aplica el botón "Sincronizar banco de preguntas"
// (ver sync-banco-maestro.ts). La vista de solo lectura en
// /admin/metodologia/contenido lee este JSON directamente en vez de la
// base de datos: el nameI18nKey/textI18nKey que se guarda en Postgres
// todavía no tiene su traducción cargada en messages/es.json — el texto
// real (nombre, definición, texto de pregunta) solo vive acá.
export function getBancoMaestroContent() {
  return bancoMaestro;
}
