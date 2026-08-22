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

## Cómo correr el seed

```bash
npx prisma migrate deploy   # o migrate dev en desarrollo
npx prisma db seed
```

Es idempotente: se puede correr varias veces sin duplicar datos.
