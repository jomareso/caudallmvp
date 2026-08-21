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

## Cómo usarlos

- Ábrelos en cualquier navegador. Son autónomos, sin dependencias externas.
- No copies el código HTML/CSS a los componentes de Next.js. La estructura de componentes en React será distinta.
- Usa los prototipos para:
  - Referencia de layout y jerarquía visual.
  - Colores y estilos de Caudall (paleta Yale Blue).
  - Flujo entre pantallas y estados.
  - Ejemplos de textos y microcopy.
- Los emojis usados como íconos son placeholders. En producción reemplazar por una biblioteca real (lucide-react, tabler icons, etc.).
