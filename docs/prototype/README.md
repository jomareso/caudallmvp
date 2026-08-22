# Prototipos HTML — Referencia visual

**Importante:** estos archivos son prototipos de presentación, no código de producción. Sirven como referencia visual para la implementación real en Next.js.

## Archivos

### `b2b2e-prototipo.html`
Prototipo consolidado del MVP v2.0 en modelo B2B2E. Incluye las tres vistas:
- **Empleado** (mobile-first, 9 pantallas): landing con código, magic link, diagnóstico adaptativo con branching, resultado CFHI + benchmark nacional, las 5 dimensiones, Next Best Action con explainability, commitment, confirmación con PWA prompt.
- **RRHH** (desktop-first, 5 pantallas): login, dashboard general con agregados, adopción por segmento con umbral aplicado visible, insights de bienestar, configuración con co-branding y catálogo activable.
- **Admin Caudall** (desktop-only, 5 pantallas): metodología con las 5 dimensiones, detalle de variable con Primary Owner, banco de preguntas versionado, detalle de pregunta con branching, tenants y flujo de versionado.

Es la referencia principal para la implementación de UI en Next.js.

### `mvp-beta-flujo-v4.html`
Versión anterior del prototipo, del modelo B2B (con instituciones financieras aliadas y leads consentidos). Se mantiene aquí como referencia histórica, pero **el modelo actual del MVP es B2B2E** (ver `docs/decisions.md`), no B2B con leads.

### `caudall-v2-dinamico.html`
Prototipo funcional con **scoring CFHI calculado en vivo en JavaScript** (no solo pantallas estáticas como `b2b2e-prototipo.html`). Útil para validar la lógica de cálculo antes de portarla a los engines de Next.js. Incluye las mismas tres vistas:
- **Empleado** (16 pantallas): código de empresa, magic link, 11 preguntas del banco (con una condicional de ejemplo — pregunta de ahorro `q9` solo debería aparecer según la respuesta a `q8`, ver nota abajo), resultado CFHI + benchmark nacional (bandas Crítico/En riesgo/Construcción/Saludable/Óptimo), las 5 dimensiones con descripción dinámica según score, y Next Best Action con explicación ("¿Por qué este paso?") según la dimensión más débil.
- **RRHH** (8 pantallas): login, resumen con umbral de agregación visible, adopción por departamento/edad, bienestar por dimensión, evolución de 6 meses, benchmark vs nacional (Estudio de Salud Financiera RD 2024), intervenciones activas con completion, configuración de co-branding y catálogo.
- **Admin Caudall** (5 pantallas): las 5 dimensiones con pesos y conteo de constructos/variables, detalle de variable con Primary Owner (ejemplo `DEBT_ARREARS`), banco de preguntas con Information Value, tenants con metodología/banco versionados, y gobierno de versionado (draft → publicación → rollback).

**Lógica de scoring implementada (ver `<script>` del archivo):**
- `dimScore(dim)`: promedio simple de las respuestas contestadas de esa dimensión (ignora preguntas sin responder). Es un placeholder de demo — la spec real (`docs/spec-v2.md`) define scoring por constructos, no por promedio directo de preguntas (viola la regla CORE #16 si se copiara tal cual a producción).
- `cfhi()`: promedio simple de las 5 dimensiones (Control, Resiliencia, Deuda, Ahorro, Planificación), pesos iguales de 20% cada una. Contrasta con la vista Admin del mismo archivo, que documenta pesos de 20%/20%/20%/20%/20% — consistente aquí, pero **no implementa la regla CORE #7** (Debt N/A excluido del denominador con redistribución de pesos).
- Bandas CFHI: Crítico ≤30, En riesgo ≤50, En construcción ≤70, Saludable ≤85, Óptimo >85.

**Importante:** esta lógica de JS es solo demostrativa para el prototipo visual. **No portar el cálculo tal cual** a los engines de producción — debe seguir el pipeline EVIDENCE → VARIABLES → CONSTRUCTS → FINANCIAL STATE → CFHI descrito en `docs/spec-v2.md` y respetar las 25 reglas metodológicas CORE de `CLAUDE.md`.

## Cómo usarlos

- Ábrelos en cualquier navegador. Son autónomos, sin dependencias externas.
- No copies el código HTML/CSS a los componentes de Next.js. La estructura de componentes en React será distinta.
- Usa los prototipos para:
  - Referencia de layout y jerarquía visual.
  - Colores y estilos de Caudall (paleta Yale Blue).
  - Flujo entre pantallas y estados.
  - Ejemplos de textos y microcopy.
- Los emojis usados como íconos son placeholders. En producción reemplazar por una biblioteca real (lucide-react, tabler icons, etc.).
