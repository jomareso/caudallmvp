# Banco Maestro Caudall v3.6

`banco-maestro-v3.json` es una conversión directa (sin reescribir contenido)
del Excel real `Banco_Maestro_Caudall_v3_6.xlsx` que diseñó la fundadora —
no es contenido de desarrollo. El script de conversión (`scripts/convert-
banco-maestro-v3_6.py`, requiere `openpyxl`) es un paso manual de una sola
vez, no corre en CI; este JSON es la fuente que usa `prisma/seed.ts`. La
v3.6 reorganiza el Excel de 8 pestañas planas a 4 con secciones internas
(`00_ARQUITECTURA` es un diagrama/resumen visual, no tiene datos
estructurados y no se carga; `01_METODOLOGIA` trae A. Constructos / B.
Variables / C. Mapa conductual / D. Behavioral & copy; `03_REGLAS_QA` trae
A. Inferencias y prohibidas / B. QA; `02_BANCO_PREGUNTAS` fusiona preguntas
y opciones en una fila por opción, agrupada por `QUESTION_ID`). El script
anterior (`convert-banco-maestro-v3_1.py`) queda como registro de la
conversión intermedia v3.1, ya superada.

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
