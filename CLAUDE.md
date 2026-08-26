# CLAUDE.md — Instrucciones para Claude Code en este proyecto

Este archivo es tu contrato de trabajo en Caudall. Léelo completo antes de cualquier tarea. Léelo de nuevo cuando arranques cualquier sesión nueva.

## Qué es Caudall

Plataforma web de salud financiera en modelo **B2B2E** (Business-to-Business-to-Employee): empresas en República Dominicana contratan Caudall como beneficio de bienestar financiero para sus empleados. La arquitectura completa está definida en `docs/spec-v2.md` (Caudall v2.0). Las decisiones de negocio y producto que rigen el MVP están en `docs/decisions.md`. El modelo de datos está en `docs/data-model.md`. Los prototipos visuales de referencia están en `docs/prototype/`.

**El principio fundamental:** Caudall no es un cuestionario que suma puntos. Es un sistema que sigue EVIDENCE → VARIABLES → CONSTRUCTS → FINANCIAL STATE → CFHI → SAFETY → ROOT CAUSE → PRIORITY → ELIGIBILITY → FINANCIAL READINESS → BEHAVIORAL READINESS → NEXT BEST ACTION → BEHAVIORAL DESIGN → COMMITMENT → OUTCOME → LEARNING. La unidad fundamental no es la pregunta; es la variable.

## Stack técnico (no negociable)

- **Framework:** Next.js 14+ con App Router
- **Lenguaje:** TypeScript (siempre; nada de `any` sin justificación)
- **Base de datos:** PostgreSQL
- **ORM:** Prisma
- **Autenticación:** Magic link (Auth.js/NextAuth v5 preferido) + OAuth con Google como opcional
- **Estilos:** Tailwind CSS
- **i18n:** next-intl (español único en MVP, pero i18n listo desde el día 1)
- **PWA:** next-pwa
- **Testing:** Vitest para unit, Playwright para e2e
- **Email:** Resend (preferido) o Postmark para magic links
- **Hosting:** Vercel para deploy

Si necesitas agregar una dependencia mayor, primero explica por qué en el PR.

## Las 9 decisiones que gobiernan el MVP

Están detalladas en `docs/decisions.md`. Nunca las violes sin discutirlo primero. Resumen:

1. **La empresa nunca ve datos individuales de empleados.** Solo agregados anonimizados con umbral mínimo por segmento (default: 5 empleados). Enforce a nivel de base de datos (RLS en PostgreSQL) y de query, no solo de UI.
2. **El journey del empleado termina en educación e intervenciones conductuales.** NO hay productos financieros ni conexión con instituciones en el MVP. No agregues módulos de productos aunque parezcan útiles.
3. **Co-branding pleno por tenant:** logo + color primario configurables. NO white-label completo (sin dominios propios, sin tipografías personalizables).
4. **Catálogo común de intervenciones con overrides (activar/desactivar por tenant).** Contenido propio de tenant es fase posterior.
5. **Solo español en MVP, con i18n desde el inicio.** Todo texto de UI viene de archivos de traducción, nunca hardcodeado.
6. **Autoregistro con licencia individual + email personal.** Cada empleado se registra con su propia licencia (no un código compartido de toda la empresa) — la empresa contrata N licencias con vigencia de 3/6/12 meses, controlando cuántos empleados usan Caudall y por cuánto tiempo. Al vencer, el empleado pierde acceso (sus datos no se borran). Sin integración HRIS, sin SSO corporativo. El email debe ser personal (no corporativo) — refuerza la barrera de confianza.
7. **Prioridad de dispositivo:** empleado mobile-first, RRHH desktop-first, admin desktop-only.
8. **Autenticación del empleado:** magic link como principal, OAuth con Google (cuenta personal) opcional. **Sin contraseñas.**
9. **PWA desde el MVP.** Service worker, manifest, prompt de instalación, notificaciones push cuando sea posible.

## Reglas metodológicas CORE (de la spec v2.0)

Estas están grabadas en piedra. Si algo en el código las viola, es bug crítico:

1. **No hacer preguntas cuya respuesta ya se conozca o pueda inferirse con confianza suficiente.**
2. **No mostrar opciones incompatibles con la realidad financiera del usuario.**
3. **No confundir objetivo del usuario con prioridad del sistema.**
4. **No confundir score con decisión.**
5. **No confundir ahorro con resiliencia.** Stock/cobertura = Resiliencia. Flujo/hábito = Ahorro.
6. **No confundir tener deuda con tener mala salud de deuda.**
7. **Debt N/A NO es score 100.** Se excluye del denominador del CFHI y se redistribuyen pesos.
8. **No penalizar dos veces una misma evidencia.** Cada evidencia tiene UN Primary Owner.
9. **No interpretar un síntoma downstream como causa raíz automáticamente.**
10. **No preguntar por barreras para comenzar cuando el usuario ya comenzó.**
11. **No asumir que una reserva acumulada implica hábito actual de ahorro.**
12. **No asumir que ingresos variables significan mala conducta.**
13. **No exigir más precisión de la necesaria para tomar una decisión útil.**
14. **Safety puede modificar temporalmente prioridad/elegibilidad sin modificar necesariamente el score.**
15. **Una inferencia fuerte puede sustituir una pregunta; una débil solo orienta routing.**
16. **Las preguntas puntúan a través de constructos, nunca por simple suma.**
17. **Financial Readiness y Behavioral Readiness son diferentes.**
18. **La dificultad de la acción puede cambiar sin cambiar la prioridad.**
19. **La economía conductual debe resolver una fricción identificada. FRICTION → TECHNIQUE, nunca al revés.**
20. **El Learning Engine aprende de conducta observada.**
21. **Si no tiene deuda, cerrar inmediatamente toda rama de deuda.**
22. **Si ya tiene reserva suficiente, no ofrecer "crear una reserva".**
23. **Si ya inició un plan, no preguntar "qué te impide comenzar".**
24. **Si gastos > ingresos y hay señales críticas, opciones como invertir pueden quedar excluidas temporalmente.**
25. **Las opciones mostradas al usuario deben reducirse conforme a su realidad.**

## Cómo trabajar en este repo

### Antes de cualquier tarea

1. Lee este `CLAUDE.md`.
2. Lee `docs/decisions.md` para la decisión relevante al feature.
3. Consulta `docs/spec-v2.md` sección relevante.
4. Consulta `docs/data-model.md` para las entidades involucradas.
5. Si hay dudas o contradicciones, **detente y pregunta**. No decidas silenciosamente.

### Al escribir código

- **Multi-tenant desde la raíz.** Toda entidad que contenga data de empresa/empleado lleva `tenantId`. Toda query en el backend debe filtrar por tenant automáticamente.
- **Row-Level Security en PostgreSQL** para blindar la barrera empresa-empleado. La barrera no puede depender solo de la lógica de aplicación.
- **Server Components por defecto** en Next.js App Router. Client Components solo cuando hace falta interactividad.
- **Types estrictos.** Nada de `any` sin comentario justificando por qué.
- **i18n desde el primer texto.** Todo string visible al usuario va por `useTranslations()` de next-intl. Ningún string hardcodeado en JSX.
- **Provenance obligatorio.** Ningún Evidence entra al sistema sin `source`, `reliability`, `confidence`.
- **Ningún dato individual de empleado en respuestas a queries de tenant admin.** Si estás escribiendo un endpoint que sirve al admin de una empresa, aplica el umbral de agregación.
- **Tests para lógica de negocio no trivial.** Especialmente para los engines (CFHI, Safety, Root Cause).

### Al abrir un Pull Request

- **Descripción clara:** qué hace, por qué, qué decisión de `docs/decisions.md` o sección de la spec justifica el cambio.
- **PRs pequeños.** Si un cambio requiere >500 líneas nuevas, probablemente hay que dividirlo.
- **Tests incluidos** cuando aplique.
- **Screenshots o video** si toca UI.
- **Cambios de schema** requieren migración de Prisma en el mismo PR.

### Lo que NO debes hacer

- **NO** reduzcas la arquitectura para "simplificar" sin discutirlo.
- **NO** hardcodees strings en UI (viola Decisión 5).
- **NO** hagas queries que crucen la barrera empresa-empleado sin verificación explícita.
- **NO** implementes lógica de scoring que sume respuestas directamente (viola principio metodológico 16).
- **NO** agregues módulos de productos financieros (viola Decisión 2).
- **NO** implementes SSO corporativo o integraciones HRIS (viola Decisión 6).
- **NO** commits directos a `main`. Todo va por PR.
- **NO** te saltes migraciones de Prisma. Todo cambio de schema tiene su migración.

## Definición de "terminado"

Una funcionalidad está terminada solo cuando:

1. Existe en UI cuando corresponde.
2. Persiste correctamente en base de datos.
3. Afecta realmente al motor (no solo mockup).
4. Respeta `tenantId`, segment, version.
5. Puede auditarse (queda registro en `AuditLog` si aplica).
6. Pasa validaciones.
7. No rompe el journey.
8. Funciona en desktop y móvil (según prioridad de dispositivo de la Decisión 7).
9. Tiene tests si es lógica no trivial.
10. Pasa el linter y type-check.

**No declares nada terminado si solo existe la interfaz y todavía no afecta al motor.**

## Contexto del proyecto

- **Founder:** Reynoso (Jose Reynoso Solér). Product owner y decisor final. Revisa cada PR.
- **Mercado:** República Dominicana. Regulación relevante: Reglamento de Protección al Usuario de los Productos y Servicios Financieros; Ley Monetaria y Financiera; Ley de Seguros y Fianzas.
- **Antecedentes:** Caudall tuvo versiones anteriores con más de 10,000 registros. Existen 3 Estudios de Salud Financiera (2021, 2022, 2024) como data propietaria para benchmark nacional.
- **El benchmark nacional es un diferenciador clave** frente a ChatGPT / OpenAI Personal Finance. Se muestra al empleado en la vista de resultados.

## Cuándo preguntar

Cuando en duda, **pregunta antes de decidir**. Especialmente si:

- Un cambio parece violar una decisión o un principio CORE.
- La spec y el código actual dicen cosas distintas.
- Hay que elegir entre performance y explicabilidad.
- Aparece un nuevo requisito legal o de protección de datos.
- El alcance de una tarea crece más allá de lo pedido.

El silencio es peor que la pregunta. Reynoso prefiere que preguntes cinco veces al día que descubrir que se rompió una decisión silenciosamente.
