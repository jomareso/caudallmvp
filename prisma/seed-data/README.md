# Banco Maestro Caudall v3.0

`banco-maestro-v3.json` es una conversión directa (sin reescribir contenido)
del Excel real `Banco_Maestro_Caudall_FINAL.xlsx` que diseñó la fundadora —
no es contenido de desarrollo. El script de conversión vive fuera del repo
(fue un paso manual de una sola vez); este JSON es la fuente que usa
`prisma/seed.ts`.

## Qué se cargó

- 20 constructos (con los pesos exactos por dimensión del Excel).
- 64 variables.
- **94 de las 314 preguntas candidatas** del banco, con sus 395 opciones de
  respuesta.
- 15 inferencias permitidas (STRONG/WEAK, spec §8).
- 4 inferencias prohibidas (spec §9).
- 12 escenarios de QA de metodología, 12 técnicas conductuales, 11 entradas
  del mapa de sesgos.

## Por qué solo 94 de 314 preguntas

Las otras **220 preguntas** (los códigos `CTRL-B01`..`B44`, `RES-B01`..`B44`,
etc. — sesgos conductuales por dimensión: presente, procrastinación,
inercia, aversión a la pérdida...) referencian un `Constructo` y una
`Variable objetivo` que **no tienen fila** en las pestañas `CONSTRUCTOS` /
`VARIABLES` del Excel (ej. `CTRL_PRESENT_BIAS`, `CTRL_BEHAVIOR`). La
pestaña `MAPA CONDUCTUAL` sí tiene descripciones que parecen corresponder
(“Sesgo del presente”, “Procrastinación”, “Inercia / status quo”...), pero
son una lista global, no 5 variantes por dimensión con sus propios pesos —
no hay suficiente información para inventar esos constructos/variables sin
confirmar con la fundadora.

Import de esas 220 preguntas queda pendiente hasta resolver ese hueco. Los
IDs completos están en `questionsPendingIds` dentro del JSON.

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
