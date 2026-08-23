# Banco Maestro Caudall v3.1

`banco-maestro-v3.json` es una conversión directa (sin reescribir contenido)
del Excel real `Banco_Maestro_Caudall_v3_1.xlsx` que diseñó la fundadora —
no es contenido de desarrollo. El script de conversión (`scripts/convert-
banco-maestro-v3_1.py`, requiere `openpyxl`) es un paso manual de una sola
vez, no corre en CI; este JSON es la fuente que usa `prisma/seed.ts`.

## Qué se cargó

- 75 constructos (con los pesos exactos por dimensión del Excel).
- 174 variables.
- **Las 314 preguntas candidatas del banco, completas**, con sus 1375
  opciones de respuesta.
- 15 inferencias permitidas (STRONG/WEAK, spec §8).
- 4 inferencias prohibidas (spec §9).
- 20 escenarios de QA de metodología, 12 técnicas conductuales, 11 entradas
  del mapa de sesgos.

`methodologyVersion`/`questionBankVersion` se mantienen en `3.0.0` a
propósito (no se suben a `3.1.0`) aunque el Excel fuente sea v3.1: varios
motores (`cfhi.ts`, `diagnostic.ts`, `tenant-aggregates.ts`) hacen
`methodology.findFirst({ where: { status: 'ACTIVE' } })` sin ordenar por
versión — si el seed creara una fila `Methodology` nueva en vez de
actualizar la existente, quedarían dos filas `ACTIVE` a la vez y ese
`findFirst` sería no determinista. Es la misma metodología, solo con las
preguntas que antes faltaban ya cargadas.

## Las 220 preguntas que faltaban (v3.0 → v3.1)

Hasta la v3.1 del Excel, 220 preguntas (`CTRL-B01`..`B44`, `RES-B01`..`B44`,
etc. — sesgos conductuales por dimensión: presente, procrastinación,
inercia, aversión a la pérdida...) referenciaban un `Constructo` y una
`Variable objetivo` que no tenían fila en `CONSTRUCTOS`/`VARIABLES`. La
fundadora corrigió el Excel agregando esos 55 constructos y 110 variables
(11 sesgos × 5 dimensiones) — las 314 preguntas resuelven ahora sin
excepción (`questionsPendingIds` queda vacío).

Dos anomalías puntuales de datos encontradas y corregidas al convertir
(documentadas también como comentario en el script de conversión):
`BEH-04` traía `Base Priority=0.9` en vez de `HIGH/MEDIUM/LOW` (se
interpretó como `HIGH`/90, coincide con el valor que ya tenía en v3.0) y
`SKIP_IF='MEDIUM'` (no es una condición válida — viene de v3.0 también, se
descartó en vez de cargarla como regla). Ningún otro dato existente
cambió: se verificó con un diff campo por campo contra el JSON anterior.

## Cargadas pero todavía no todas "vivas": el intérprete de ASK_IF/SKIP_IF

Las 314 preguntas están en la base y el seed corre limpio (probado con
simulaciones completas de diagnóstico, sin errores ni bucles). Pero
`src/lib/engines/rules.ts` es un intérprete deliberadamente mínimo,
construido solo para la gramática de las 94 preguntas originales (ver su
comentario de cabecera) — y la mayoría de las 220 preguntas nuevas usan una
convención distinta para expresar confianza: variables explícitas como
`CTRL_CONFIDENCE`/`RES_CONFIDENCE`/etc. comparadas directamente
(`CTRL_CONFIDENCE < 0.85`), en vez de la sintaxis `<variable> confidence >=
X` que sí soporta el intérprete actual. Como cualquier fragmento no
reconocido en una condición hace que toda la expresión evalúe a `false`
(diseño intencional: "no preguntar de más" antes que "adivinar"), la
mayoría de las 220 preguntas nuevas quedan cargadas pero **no se activan
todavía** en un diagnóstico real.

Esto no es un bug de esta carga — es exactamente el mismo tipo de hueco que
ya existía para las 220 preguntas originales, solo que ahora está una capa
más adentro (el intérprete de reglas, no el catálogo de constructos). No se
tocó `rules.ts` en este cambio: extender su gramática requiere confirmar
con la fundadora qué significan exactamente esas variables `*_CONFIDENCE`
(¿un valor que el motor calcula y mantiene? ¿otra cosa?) antes de decidir
cómo evaluarlas — inventar esa semántica sería tan un riesgo metodológico
como lo hubiera sido inventar los constructos que faltaban.

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
