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

## Cargadas pero todavía no todas "vivas": el intérprete de ASK_IF/SKIP_IF

Las 314 preguntas están en la base y el seed corre limpio (probado con
simulaciones completas de diagnóstico, sin errores ni bucles). Pero
`src/lib/engines/rules.ts` es un intérprete deliberadamente mínimo,
construido solo para la gramática de las 94 preguntas originales (ver su
comentario de cabecera). La v3.6 ya corrigió la sintaxis de confianza para
usar variables `*_STATE` derivadas con la forma que el intérprete sí
entiende (`CTRL_PRESENT_BIAS_STATE confidence < 0.80`, en vez de la
`CTRL_CONFIDENCE < 0.85` de v3.1) — pero varios `ASK_IF`/`SKIP_IF` siguen
combinando eso con fragmentos en inglés llano sin gramática formal (ej.
`"behavior explanation needed"`, `"behavior explanation still needed"`).
Como cualquier fragmento no reconocido en una condición hace que **toda**
la expresión evalúe a `false` (diseño intencional del intérprete: "no
preguntar de más" antes que "adivinar"), esas preguntas quedan cargadas
pero no se activan todavía en un diagnóstico real.

Además, varias de estas condiciones apuntan a una variable `*_STATE`
"derivada" (ej. `CTRL_PRESENT_BIAS_STATE`) que ahora tiene su propia regla
de agregación documentada en la columna "Regla de agregación" de
`01_METODOLOGIA` ("agregar evidencia de ítems solo cuando exista
información suficiente/confidence; nunca sumar preguntas directamente")
— pero el motor que calcule esa variable derivada a partir de las
respuestas `_RESPONSE` (R1–R4) todavía no existe en el código.

Ninguna de las dos cosas se tocó en esta carga: extender `rules.ts` y
construir el motor de agregación conductual son piezas de trabajo reales,
no un ajuste rápido, y requieren confirmar el diseño exacto con la
fundadora antes de escribir código — inventar esa semántica sería un
riesgo metodológico.

## Catálogo de intervenciones (`intervention-catalog-draft.json`) — BORRADOR

10 intervenciones (2 por dimensión), redactadas a partir de los ejemplos
reales de `BehavioralTechnique.example`/`copyTransformation` del Excel
(columna "Técnicas exploradas"), **no inventadas desde cero** — pero el
copy final (título, descripción, texto de la acción) sí lo redactó Claude
como primer borrador, no la fundadora.

Se carga con `InterventionCatalog.status = DRAFT` a propósito: existir en
la base de datos no lo activa. Antes de que Next Best Action lo use en
producción, Reynoso debe:

1. Revisar el texto de las 10 intervenciones en `messages/es.json` bajo la
   clave `interventions.*` (título, descripción, acción, "por qué este
   paso").
2. Corregir tono/redacción si hace falta.
3. Confirmar que se promueva `InterventionCatalog.status` a `ACTIVE`.

Cobertura actual: 2 técnicas por dimensión (de las 10 técnicas conductuales
reales, excluyendo las 2 entradas de guía de estilo `COPY_CORE`/
`COPY_MOBILE` que no son intervenciones). Ampliar a más fricciones por
dimensión es trabajo futuro, no un bloqueo para probar el flujo completo.

## Cómo correr el seed

```bash
npx prisma migrate deploy   # o migrate dev en desarrollo
npx prisma db seed
```

Es idempotente: se puede correr varias veces sin duplicar datos.
