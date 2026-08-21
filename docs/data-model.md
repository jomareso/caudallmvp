# Modelo de datos — Caudall MVP

Este documento define las entidades, relaciones y reglas de integridad del sistema. Es la fuente de verdad para el schema de Prisma (`prisma/schema.prisma`) y para toda decisión de persistencia.

## Principios de diseño

Cuatro principios que gobiernan todo el modelo:

1. **Multi-tenant desde la raíz.** Toda entidad que contenga data de empresa o empleado lleva `tenantId`. No hay tabla global de empleados; hay empleados de un tenant.
2. **Barrera empresa-empleado infranqueable.** Las entidades quedan clasificadas por visibilidad. La barrera se enforce con Row-Level Security en PostgreSQL, no solo con lógica de aplicación.
3. **Toda evidencia tiene provenance.** Nada llega al scoring sin `source`, `confidence` y `primaryOwner`.
4. **Versionado por diseño.** Metodología, banco de preguntas, scoring e intervenciones son entidades versionadas. Un empleado siempre está atado a la versión con la que respondió.

---

## Bloque 1 — Multi-tenant y usuarios

### `Tenant` — cada empresa cliente

Campos:
- `id`, `name`, `enrollmentCode` (código de empresa; ADR-006)
- `logoUrl`, `primaryColor`, `secondaryColor` (co-branding; ADR-003)
- `aggregationMinSegmentSize` (umbral mínimo para dashboards; ADR-001; default 5)
- `defaultLanguage` (ADR-005; solo `es` en MVP)
- `status` (`active`, `pilot`, `suspended`)
- `methodologyVersionId`, `questionBankVersionId`, `scoringVersionId`, `interventionCatalogVersionId`
- `corporateEmailDomain` (para advertir al empleado que use email personal)
- `createdAt`, `activatedAt`

### `Segment` — subdivisiones dentro de una empresa

Departamentos, sedes, roles. Permite jerarquía.

Campos: `id`, `tenantId`, `name`, `type` (`department`, `location`, `role`, `custom`), `parentSegmentId`, `createdAt`

### `Employee` — el usuario final del beneficio

**Visibilidad:** la empresa nunca ve esta entidad individual; solo agregados que la deriven.

Campos:
- `id`, `tenantId`
- `personalEmail` (email personal; ADR-006; ADR-008)
- `enrollmentCodeUsed`
- `authMethod` (`magic_link`, `google_oauth`)
- `demographicData` (JSON: edad, dependientes, etc. — data mínima autodeclarada)
- `status` (`registered`, `active`, `opted_out`)
- `createdAt`, `lastActiveAt`

### `EmployeeSegment` — relación N:M empleado-segmento

Un empleado puede pertenecer a más de un segmento.

Campos: `employeeId`, `segmentId`, `assignedAt`

### `TenantAdmin` — usuarios del portal de RRHH

Campos: `id`, `tenantId`, `email`, `role` (`viewer`, `admin`), `createdAt`, `lastActiveAt`

### `PlatformUser` — usuarios del admin interno de Caudall

Roles (spec §53): `platform_owner`, `methodologist`, `product_admin`, `analyst`, `viewer`.

Campos: `id`, `email`, `role`, `createdAt`, `lastActiveAt`

---

## Bloque 2 — Metodología y banco (versionado)

### `Methodology` (versionada)

Campos: `id`, `version`, `status` (`draft`, `active`, `deprecated`), `publishedAt`, `publishedById`, `createdAt`

### `Dimension`

Las 5 dimensiones del CFHI.

Campos:
- `id`, `code` (`CONTROL`, `RESILIENCE`, `DEBT`, `SAVING`, `PLANNING`)
- `nameI18nKey`, `descriptionI18nKey`
- `weight` (parametrizable; default 20% cada una)
- `methodologyId`

### `Construct`

Constructos dentro de dimensiones (spec §5).

Campos:
- `id`, `dimensionId`, `code` (ej. `CTRL_MARGIN`)
- `nameI18nKey`
- `weightWithinDimension`

### `Variable`

Variables maestras (spec §10-14, 17).

Campos:
- `id`, `code` (ej. `CTRL_CASHFLOW`)
- `variableType` (`score`, `context`, `behavioral`, `readiness`, `derived`)
- `dimensionId` (nullable — context y behavioral no pertenecen a dimensión)
- `possibleStates` (JSON: array de los valores enumerados de la spec)
- `primaryOwnerConstructId` (spec §6: cada variable de scoring tiene UN dueño)

### `QuestionBank` (versionada)

Campos: `id`, `version`, `status`, `createdAt`

### `Question`

Preguntas del banco adaptativo (spec §22, §43).

Campos:
- `id`, `bankId`, `code` (ej. `CTRL-01`)
- `textI18nKey`
- `dimensionId`, `variableTargetId`, `constructTargetId`
- `askIfRule` (expresión JSON sobre variables ya conocidas)
- `skipIfRule`, `doNotAskIfRule`
- `basePriority`, `informationValue`, `safetyValue`, `scoringValue`, `routingValue`
- `uncertaintyReduction`, `burden`
- `inferenceSubstitutionAllowed` (boolean)
- `minConfidenceToSkip` (default 80)
- `status` (`draft`, `active`, `deprecated`)

### `AnswerOption`

Opciones de respuesta con la evidencia que producen.

Campos: `id`, `questionId`, `textI18nKey`, `evidenceProduced` (JSON: qué Evidence genera)

### `ScoringConfig` (versionada)

Configuración de pesos y reglas de N/A (spec §45).

Campos: `id`, `version`, `status`, `dimensionWeights` (JSON), `constructWeights` (JSON), `naRedistributionRule` (JSON)

### `ForbiddenInference`

Inferencias explícitamente prohibidas (spec §9).

Campos: `id`, `sourceVariableCode`, `sourceValue`, `targetVariableCode`, `targetValue`, `reason`

---

## Bloque 3 — Estado vivo del empleado

### `Evidence` — cada dato que llega al sistema

El corazón de la spec. Nunca se borra; los cambios generan nueva Evidence, no sobreescriben.

Campos:
- `id`, `tenantId`, `employeeId`
- `source` (`question`, `inference`, `integration`)
- `questionId` (nullable), `answerOptionId` (nullable)
- `variableId`, `value` (JSON)
- `reliability` (`direct`, `strong_inference`, `weak_inference`)
- `confidence` (0–100)
- `primaryOwnerConstructId`
- `timestamp`, `period` (nullable — a qué momento se refiere)
- `methodologyVersionId` (con qué versión se capturó)

### `VariableState` — valor computado actual de cada variable para un empleado

Campos:
- `employeeId`, `variableId`
- `value` (JSON), `confidence`, `state`
- `derivedFromEvidenceIds` (array — trazabilidad)
- `updatedAt`

### `ConstructScore`

Campos: `employeeId`, `constructId`, `score` (0–100), `confidence`, `computedAt`

### `DimensionScore`

Campos:
- `employeeId`, `dimensionId`
- `score`, `state` (`MET`, `PARTIAL`, `UNMET`, `CRITICAL`, `NA`), `confidence`
- `driverVariableId` (variable identificada como principal driver)

### `FinancialState` — snapshot vivo por empleado (spec §15)

Campos:
- `employeeId`
- `cfhiScore`, `cfhiConfidence`
- `userGoal` (JSON), `systemPriority`, `rootCause`
- `eligibility` (JSON), `finReadiness`, `behReadiness`
- `lastDiagnosticCompletedAt`

### `SafetyFlag`

Independiente del score (spec §19).

Campos: `id`, `employeeId`, `flagCode` (ej. `CRITICAL_DEBT`, `DEBT_PAYMENT_STRESS`), `raisedAt`, `evidenceIds` (array), `resolvedAt` (nullable)

---

## Bloque 4 — Intervenciones y contenido

### `InterventionCatalog` (maestro, versionado — ADR-004)

Campos: `id`, `version`, `status`, `createdAt`

### `Intervention`

Parte del catálogo maestro.

Campos:
- `id`, `catalogId`
- `type` (`educational_content`, `behavioral_action`, `commitment`, `reminder`)
- `dimensionId`, `appliesToStates` (array), `appliesToStages` (array)
- `financialReadinessRequired`, `behavioralReadinessRequired`
- `behavioralTechniqueCode` (ej. `IMPLEMENTATION_INTENTION`, `COMMITMENT_DEVICE`) — spec §28
- `titleI18nKey`, `descriptionI18nKey`, `actionTextI18nKey`
- `whyThisStepI18nKey` (spec §56)

### `TenantInterventionOverride` (ADR-004)

Campos: `tenantId`, `interventionId`, `status` (`enabled`, `disabled`)

En MVP solo activar/desactivar; contenido propio de tenant es fase posterior.

### `EmployeeIntervention` — instancia asignada

Campos:
- `id`, `employeeId`, `interventionId`, `assignedAt`
- `status` (`suggested`, `committed`, `in_progress`, `completed`, `dismissed`)
- `commitmentData` (JSON: monto, frecuencia, trigger, fecha — spec §30)
- `completedAt`, `outcome` (`achieved`, `partial`, `not_achieved`), `feedback` (JSON)

---

## Bloque 5 — Auditoría, versionado y aprendizaje

### `Version` — tabla genérica para versionables

Campos: `id`, `entityType` (`methodology`, `question_bank`, `scoring`, `intervention_catalog`), `entityId`, `versionNumber`, `status` (`draft`, `in_review`, `active`, `rollback`), `createdById`, `publishedById`, `publishedAt`

### `AuditLog` — cambios estructurales (spec §52)

Campos: `id`, `whoId`, `who` (JSON con nombre y rol), `what`, `when`, `previousValue` (JSON), `newValue` (JSON), `entityType`, `entityId`

### `LearningEvent` — señales para el motor de aprendizaje (Fase 8 spec)

Campos: `id`, `eventType` (`question_shown`, `question_abandoned`, `intervention_completed`, `outcome_reported`), `employeeId` (nullable para anonimizar), `tenantId`, `context` (JSON), `timestamp`

---

## Bloque 6 — Reglas de integridad enforced por el sistema

Estas son las que la spec repite y que el modelo debe blindar:

1. **N/A no es 100.** Cuando `DEBT_APPLICABILITY = NONE`, la dimensión Debt se **excluye del denominador del CFHI** y se redistribuyen pesos entre las aplicables. No se pone score = 100.
2. **Primary Owner no admite double counting.** Una Evidence puede informar varias variables, pero solo penaliza el CFHI a través de su primary owner. El scoring engine debe verificarlo.
3. **Provenance obligatorio.** Ninguna Evidence entra al sistema sin `source`, `reliability`, `confidence`. Constraint a nivel de aplicación y validación en zod.
4. **Versionado consistente.** Un empleado tiene atada su respuesta a `methodologyVersionId` y `questionBankVersionId` específicos. Los cambios de versión no reescriben respuestas históricas.
5. **Inferencias prohibidas** (spec §9). El motor consulta `ForbiddenInference` antes de propagar inferencias.
6. **Umbral de agregación aplicado en query.** Toda query servida al `TenantAdmin` pasa por un helper que verifica que el segmento consultado tenga al menos `tenant.aggregationMinSegmentSize` empleados. Si no, devuelve `INSUFFICIENT_ANONYMITY`.

---

## Bloque 7 — Row-Level Security (RLS) en PostgreSQL

La barrera empresa-empleado (ADR-001) no puede depender solo de la lógica de aplicación. Se enforce a nivel de base de datos:

- Toda tabla con `tenantId` tiene policy RLS que filtra automáticamente por el tenant del usuario autenticado.
- `TenantAdmin` no puede leer `Evidence`, `VariableState`, `ConstructScore`, `DimensionScore`, `FinancialState`, `SafetyFlag`, ni `EmployeeIntervention` individual. Solo puede leer vistas agregadas que aplican el umbral.
- `Employee` solo puede leer sus propias entidades.
- `PlatformUser` con rol correspondiente puede leer todo, pero cada acceso queda en `AuditLog`.

Las políticas de RLS se definen en migraciones de Prisma con SQL raw cuando Prisma no las soporta nativamente.

---

## Lo que este modelo NO incluye (deliberadamente diferido)

- Módulo de productos financieros (ADR-002).
- White-label completo, dominios propios, tipografías personalizables (ADR-003).
- Contenido propio de tenant en el catálogo de intervenciones (ADR-004, fase siguiente).
- Integraciones HRIS / SSO (ADR-006).
- Editor visual del banco de preguntas (fase Admin completa).
- Analytics con machine learning para Learning Engine (Fase 8 de la spec).

Estos son fases posteriores. No agregar tablas para ellos ahora.
