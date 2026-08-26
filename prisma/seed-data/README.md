# Banco Maestro Caudall v4.1 (SIMPLIFICADO)

`banco-maestro-v3.json` es una conversión directa (sin reescribir contenido)
del Excel real más reciente que compartió la fundadora —
no es contenido de desarrollo. El script de conversión vigente
(`scripts/convert-banco-maestro-v4_1.py`, requiere `openpyxl`) es un paso
manual de una sola vez, no corre en CI; este JSON es la fuente que usa
`prisma/seed.ts`. Misma estructura de 4 pestañas desde v3.6
(`00_ARQUITECTURA` es un diagrama/resumen visual, no tiene datos
estructurados y no se carga; `01_METODOLOGIA` trae A. Constructos / B.
Variables / C. Mapa conductual / D. Behavioral & copy — y desde v4.0 también
E-J: matriz de validación empírica y una "auditoría metodológica crítica"
propuesta que **no se carga ni se implementa** (ver más abajo);
`03_REGLAS_QA` trae A. Inferencias y prohibidas / B. QA (incluye desde v4.1
una subsección C. Contexto con 12 escenarios nuevos); `02_BANCO_PREGUNTAS`
fusiona preguntas y opciones en una fila por opción, agrupada por
`QUESTION_ID`). Los scripts anteriores (`convert-banco-maestro-v3_1.py`,
`convert-banco-maestro-v3_6.py`) quedan como registro de conversiones
intermedias, ya superadas.

## v4.1 SIMPLIFICADO (26 ago 2026): menos preguntas activas, sin tocar el motor

A petición de Reynoso ("meter una versión más simplificada, menos
constructos, menos preguntas al usuario — no la auditoría por ahora"), el
Excel v4.1 recorta el conjunto de preguntas **activas** de 204 a **101**
(mismos 321 candidatos, mismos constructos y estructura que v3.6/v4.0 — el
recorte es solo la columna `Estado`, las inactivas ahora se llaman
`RESERVA` en vez de `DRAFT`; `toQuestionStatus()` ya trata cualquier valor
que no sea literalmente `'ACTIVA'` como `DRAFT`, así que no hizo falta
tocar código para ese cambio de nombre).

El Excel v4.0/v4.1 también trae una "Auditoría Metodológica Crítica"
(secciones F-J: 15 decisiones D01-D15 + remapeo de constructos + capa
conductual transversal + plan de validación de campo) — el propio Excel la
marca como propuesta para revisión, y los constructos reales de la sección
A **no la reflejan todavía** (siguen los 55 sesgos × 5 dimensiones y los
constructos que la auditoría recomienda reducir). El script de conversión
deliberadamente no lee esas secciones (igual que en v3.6/v4.0, quedan fuera
de los rangos de fila hardcodeados) — es papel para una decisión aparte de
Reynoso, no algo que este sync haya aplicado.

### Bloque de contexto nuevo (CTX-01..07)

v4.1 agrega 7 preguntas de contexto activas — el bloque "antes de ver tu
resultado" de `Caudall_Metodologia_MVP_v1_5.docx` (edad, dependientes,
responsabilidad del hogar, ingreso, patrón de ingreso, educación, y el
opt-in de comparación con pares). Dos vacíos reales encontrados y resueltos
al convertir:

1. **Sin fila de `Variable objetivo` en la sección B** (mismo tipo de vacío
   que documentó este archivo para la transición v3.0→v3.1) — el script
   ahora completa esas 7 variables automáticamente a partir de las opciones
   ya presentes en `02_BANCO_PREGUNTAS` (ver comentario en el script), sin
   inventar contenido.
2. **`ASK_IF` en inglés llano** (`"FINANCIAL_DIAGNOSTIC_COMPLETE AND ... user
   has not skipped optional context block"`) — no es la gramática que
   `evaluateRule()` interpreta, así que siempre evaluaba a `false` y esas
   preguntas nunca se habrían preguntado (confirmado con una simulación
   completa del diagnóstico antes del fix). `isApplicable()` en
   `src/lib/engines/diagnostic.ts` ahora bypasea el `ASK_IF` de texto libre
   específicamente para preguntas `role: CONTEXT` — el orden ya las coloca
   después de ANCHOR/ADAPTIVE (`ROLE_ORDER`), que es justo lo que pide la
   spec. El dedup normal de "ya respondida" sigue aplicando igual.

Las traducciones de estas 7 preguntas (`messages/es.json`,
`diagnostic.questions.CTX-0N`) se generaron directamente del `textUX`/
opciones ya escritos en español en el Excel — no es copy nuevo.

Verificado con una simulación completa del diagnóstico (29 preguntas hasta
`/diagnostico/resultado`, incluyendo el bloque de contexto al final,
CFHI y las 5 dimensiones visibles) contra la base local.

## Qué se cargó

- 75 constructos, 174 variables (sin cambio de contenido vs. v3.1).
- **Las 314 preguntas candidatas del banco, completas**, con sus 1375
  opciones de respuesta — **204 activas, 110 en `DRAFT`** (ver más abajo).
- 15 inferencias permitidas (STRONG/WEAK, spec §8), 4 inferencias
  prohibidas (spec §9) — sin cambio.
- 31 escenarios de QA de metodología (creció de 20 a 31), 12 técnicas
  conductuales, 11 entradas del mapa de sesgos — sin cambio en estas dos
  últimas.

`methodologyVersion`/`questionBankVersion` se mantienen en `3.0.0` a
propósito (no suben con cada revisión del Excel): varios motores
(`cfhi.ts`, `diagnostic.ts`, `tenant-aggregates.ts`) hacen
`methodology.findFirst({ where: { status: 'ACTIVE' } })` sin ordenar por
versión — si el seed creara una fila `Methodology` nueva en vez de
actualizar la existente, quedarían dos filas `ACTIVE` a la vez y ese
`findFirst` sería no determinista. Es la misma metodología, actualizada in
place.

## Las 220 preguntas que faltaban (v3.0 → v3.1)

Hasta la v3.1 del Excel, 220 preguntas (`CTRL-B01`..`B44`, `RES-B01`..`B44`,
etc. — sesgos conductuales por dimensión: presente, procrastinación,
inercia, aversión a la pérdida...) referenciaban un `Constructo` y una
`Variable objetivo` que no tenían fila en `CONSTRUCTOS`/`VARIABLES`. La
fundadora corrigió el Excel agregando esos 55 constructos y 110 variables
(11 sesgos × 5 dimensiones) — las 314 preguntas resuelven ahora sin
excepción (`questionsPendingIds` queda vacío).

Dos anomalías puntuales de datos ya presentes desde v3.0/v3.1, encontradas
y corregidas al convertir (documentadas también como comentario en el
script): `BEH-04` traía `Base Priority=0.9` en vez de `HIGH/MEDIUM/LOW` (se
interpretó como `HIGH`/90) y `SKIP_IF='MEDIUM'` (no es una condición
válida, se descartó).

## v3.6: estructura primary/confirmatory/reserve + `status` real

La v3.6 organiza cada sesgo conductual en 4 ítems: uno primario y uno
confirmatorio (los que realmente se preguntan) y dos "reserve" — variantes
de respaldo, solo por si el ítem primario/confirmatorio no encaja en el
contexto o necesita regenerarse. La fundadora marcó esos 110 ítems reserve
como `DRAFT` en la columna `Estado` del Excel (110 = 2 reserve × 55 sesgos).

Esto expuso un bug real en `prisma/seed.ts`: el `status` de cada pregunta
estaba **hardcodeado a `ACTIVE`** en el upsert, ignorando por completo la
columna `Estado` del banco — así que aunque el Excel marcara algo `DRAFT`,
el seed lo activaba igual. Se corrigió (`toQuestionStatus`, igual patrón
que `toQuestionRole`): ahora respeta `q.status` (`'ACTIVA'` → `ACTIVE`,
cualquier otra cosa → `DRAFT`, por defecto seguro). `loadBankAndState()` en
`diagnostic.ts` ya filtraba por `status: 'ACTIVE'`, así que los 110 ítems
reserve quedan cargados pero inertes automáticamente, sin tocar el motor.

## El intérprete de ASK_IF/SKIP_IF y el motor de estados derivados (resuelto 24 ago 2026)

Las 314 preguntas están en la base y el seed corre limpio (probado con
simulaciones completas de diagnóstico, sin errores ni bucles).
`src/lib/engines/rules.ts` es un intérprete de una gramática concreta (ver
su comentario de cabecera), y varios `ASK_IF`/`SKIP_IF` combinaban
condiciones sobre variables `*_STATE`/`*_CONFIDENCE` derivadas
(`CTRL_PRESENT_BIAS_STATE confidence < 0.80`, `SAV_CONFIDENCE >= 0.80`)
que nadie calculaba — las preguntas quedaban cargadas pero esas ramas
nunca se activaban en un diagnóstico real.

Esto ya se resolvió:

- Las 5 `_STATE`/`_CONFIDENCE` de dimensión (CTRL/RES/DEBT/SAV/PLAN) se
  calculaban desde siempre en `DimensionScore` — solo faltaba publicarlas
  como hechos para el motor de reglas (`syncDimensionStateFacts` en
  `cfhi.ts`).
- Los 55 `_STATE` de sesgo conductual (uno por sesgo × dimensión) no tenían
  ningún cálculo. Fórmula confirmada por Reynoso: mapeo directo de la
  respuesta ordinal a un balde (bajo/moderado/alto/muy alto), confianza
  60% con 1 ítem respondido, 100% si el ítem de confirmación coincide con
  el mismo balde (`src/lib/engines/behavioral-state.ts`).
- `rules.ts` ahora también soporta comparaciones numéricas directas del
  tipo `SAV_CONFIDENCE >= 0.80` (antes cualquier `IDENT >= número` sin la
  palabra `confidence` se marcaba no soportado y evaluaba falso siempre).

Los fragmentos en inglés llano sin gramática formal que quedan en algunos
`ASK_IF` (ej. `"behavior explanation needed"`) siguen sin resolverse — no
son un cálculo pendiente, son texto que todavía no se tradujo a una
condición formal, y como cualquier fragmento no reconocido hace que toda
la expresión evalúe a `false` (diseño intencional: "no preguntar de más"
antes que "adivinar"), esas ramas específicas siguen inertes.

## Catálogo de intervenciones (`intervention-catalog-draft.json`) — aprobado 24 ago 2026

11 intervenciones (2 por dimensión + 1 de mantenimiento), redactadas a
partir de los ejemplos reales de `BehavioralTechnique.example`/
`copyTransformation` del Excel (columna "Técnicas exploradas"), **no
inventadas desde cero** — pero el copy final (título, descripción, texto
de la acción) sí lo redactó Claude como primer borrador, no la fundadora.

Reynoso revisó el texto completo (artifact con las 11 tarjetas tal como
las vería un empleado) y aprobó activarlo. `InterventionCatalog.status`
pasa a `ACTIVE` en este seed — antes de esto existía en la base pero no
se usaba: `src/lib/engines/next-best-action.ts` no filtraba por el status
del catálogo, así que el contenido en `DRAFT` ya era elegible en la
práctica. Se corrigió al mismo tiempo que se activó (ver el commit que
agrega `catalog: { status: 'ACTIVE' }` a sus queries de `Intervention`).

Cobertura actual: 2 técnicas por dimensión (de las 10 técnicas conductuales
reales, excluyendo las 2 entradas de guía de estilo `COPY_CORE`/
`COPY_MOBILE` que no son intervenciones) + 1 de mantenimiento. Ampliar a
más fricciones por dimensión es trabajo futuro, no un bloqueo para probar
el flujo completo.

## Cómo correr el seed

```bash
npx prisma migrate deploy   # o migrate dev en desarrollo
npx prisma db seed
```

Es idempotente: se puede correr varias veces sin duplicar datos.
