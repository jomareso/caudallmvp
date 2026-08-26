# Decisiones de arquitectura (ADRs) — Caudall MVP

Este documento captura las decisiones estructurales del MVP en formato ADR (Architecture Decision Record). Cada una tiene contexto, decisión, alternativas consideradas y consecuencias. Estas decisiones fueron tomadas explícitamente y no deben violarse sin discusión previa con el owner.

**Estado global:** todas las decisiones marcadas como `Accepted` a la fecha de este documento. Cambios requieren PR con nueva ADR marcando la anterior como `Superseded`.

---

## ADR-001 — Barrera empresa-empleado: solo agregados anonimizados

**Estado:** Accepted
**Contexto:** En un modelo B2B2E la empresa paga y quiere ver el impacto del beneficio, pero el empleado necesita saber que su información financiera personal no llega a RRHH. Sin esa garantía, no responde con honestidad y todo el sistema falla en la primera pregunta.

**Decisión:** La empresa (tenant admin) solo accede a datos agregados y anonimizados de sus empleados, nunca individuales. Se aplica un umbral mínimo por segmento (default: 5 empleados) para evitar re-identificación en grupos pequeños. La barrera se enforce a nivel de base de datos (Row-Level Security en PostgreSQL) y de query, no solo de UI.

**Alternativas consideradas:**
- Agregados + posibilidad de invitar a compartir voluntariamente. Rechazado: introduce presión social, "declinar" se vuelve sospechoso.
- Acceso individual con consentimiento explícito. Rechazado: el consentimiento en relación laboral está viciado.
- Acceso individual por defecto. Rechazado: rompe la confianza y hace inviable el producto.

**Consecuencias:**
- Toda query servida al tenant admin debe pasar por un helper que aplica el umbral.
- No hay tabla o vista que una `Employee` con `DimensionScore` accesible desde el tenant admin.
- El umbral es parametrizable por tenant pero nunca puede ser menor que el mínimo de plataforma (default 5).
- El onboarding del empleado debe comunicar explícitamente esta garantía.

---

## ADR-002 — El journey del empleado termina en educación e intervenciones conductuales

**Estado:** Accepted
**Contexto:** El empleado completa el diagnóstico, obtiene su CFHI. Después puede: quedarse en educación/hábitos, o extenderse a productos financieros (AFP, ahorro programado, seguros). En el modelo B2B2E, quien paga es la empresa, no la institución financiera — no hay necesidad de monetizar vía leads.

**Decisión:** El MVP termina en educación e intervenciones conductuales. Sin catálogo de productos financieros, sin conexión con instituciones. Se agregarán después, per-tenant, como capacidad opcional.

**Alternativas consideradas:**
- Educación + productos financieros desde el MVP. Rechazado: multiplica alcance sin fortalecer la hipótesis, complica legal (asesoría financiera regulada), y crea percepción reputacional negativa para RRHH.
- Educación en MVP, productos opcionales per empresa después. Cercano al elegido, pero mantener claridad total desde el inicio evita scope creep.

**Consecuencias:**
- El código no incluye módulo de productos financieros ni tablas relacionadas.
- Las intervenciones son de tipo `educational_content`, `behavioral_action`, `commitment`, `reminder`.
- Si RRHH pide "conectar con banco" en piloto, se responde que es fase posterior.

---

## ADR-003 — Personalización visual: co-branding pleno (logo + color primario)

**Estado:** Accepted
**Contexto:** Cada empresa quiere que la plataforma "se sienta suya" en algún grado. Hay un rango entre co-branding ligero (solo logo) y white-label completo (dominio propio, tipografías, componentes personalizados).

**Decisión:** Co-branding pleno en el MVP: logo de la empresa y color primario configurables por tenant. La estructura, tipografía y marca Caudall se preservan. White-label completo se pospone.

**Alternativas consideradas:**
- Co-branding ligero (solo logo). Rechazado: insuficiente para las ventas.
- White-label completo desde MVP. Rechazado: semanas de trabajo adicional, rompe el mensaje "Caudall es un tercero independiente que garantiza tu privacidad" que refuerza ADR-001.

**Consecuencias:**
- Entidad `Tenant` incluye `logoUrl` y `primaryColor`.
- Sistema de theming simple: los colores del tenant sobreescriben el primary de Tailwind vía CSS variables.
- El header siempre muestra "caudall + [logo empresa]" o "[logo empresa] + caudall", nunca solo la marca de la empresa.

---

## ADR-004 — Catálogo de intervenciones: común con overrides

**Estado:** Accepted
**Contexto:** Las intervenciones y contenido educativo son el corazón del valor para el empleado. Pueden ser un catálogo común para todas las empresas, uno por empresa, o híbrido.

**Decisión:** Catálogo común maestro curado por Caudall. Cada empresa puede activar/desactivar piezas del catálogo. Agregar contenido propio de tenant queda para fase posterior.

**Alternativas consideradas:**
- Catálogo por empresa. Rechazado: modelo de servicios, no de SaaS. Escala mal y rompe la lógica metodológica del motor conductual.
- Común único sin overrides. Rechazado: no atiende necesidades legítimas de personalización por industria/cultura.

**Consecuencias:**
- Entidades `InterventionCatalog` (maestro versionado) e `Intervention` (curadas por Caudall).
- Entidad `TenantInterventionOverride` con status `enabled` / `disabled`.
- En MVP solo activar/desactivar. Contenido propio de tenant es fase 2.
- Nuevas intervenciones se añaden por Caudall en nuevas versiones del catálogo.

---

## ADR-005 — Idiomas: español único en MVP, i18n listo desde el inicio

**Estado:** Accepted
**Contexto:** El mercado inicial es República Dominicana. Los empleados hablan español. Pero preparar la arquitectura para más idiomas después cuesta mucho más si se hace tarde.

**Decisión:** UI en español únicamente en el MVP. Sin embargo, toda cadena visible al usuario se implementa vía `next-intl` con archivo `messages/es.json`. Ningún string hardcodeado en JSX.

**Alternativas consideradas:**
- Solo español hardcodeado. Rechazado: costoso rehacer después. La deuda técnica no vale el ahorro marginal.
- Español + inglés desde MVP. Rechazado: no hay demanda actual y duplica trabajo de contenido.

**Consecuencias:**
- Dependencia `next-intl` desde el arranque.
- Estructura `messages/es.json` con claves por dominio.
- Contenido metodológico (preguntas, intervenciones) usa campos `_i18n_key` que apuntan a traducciones gestionadas en admin.
- Agregar otro idioma en el futuro = agregar `messages/en.json` + traducciones en admin, sin tocar código.

---

## ADR-006 — Registro del empleado: autoregistro con licencia individual + email personal

**Estado:** Accepted (actualizado 24 ago 2026 — ver adenda abajo)
**Contexto:** El empleado necesita autenticarse. Opciones: autoregistro con código, carga manual de correos por RRHH, integración con HRIS/nómina, SSO corporativo.

**Decisión:** Autoregistro con código de acceso + email **personal** (no corporativo). Opcionalmente RRHH puede subir lista de correos autorizados (feature simple, no bloqueante). Sin integración HRIS ni SSO en MVP.

**Alternativas consideradas:**
- Integración HRIS desde MVP. Rechazado: cada integración es un proyecto, mata foco.
- SSO corporativo desde MVP. Rechazado: el empleado entrando con credenciales corporativas rompe la percepción de privacidad (viola espíritu de ADR-001).

**Consecuencias:**
- Entidad `Employee` tiene `personalEmail` (no corporativo).
- El flujo de registro valida que el email no coincida con el dominio corporativo del tenant, y advierte.
- No hay código de integración con Workday, BambooHR, etc., ni SAML/OIDC corporativo.

**Adenda (24 ago 2026) — control de licencias por empleado:** el código de acceso dejó de ser un código único compartido por toda la empresa (`Tenant.enrollmentCode`, que se conserva solo por compatibilidad con tenants creados antes de este cambio). Ahora cada empleado se registra con su propia **licencia individual** (`License.code`), y la empresa contrata N licencias con una vigencia de 3, 6 o 12 meses. Esto le da a la empresa control real sobre cuántos empleados pueden usar Caudall a la vez y por cuánto tiempo — antes el código compartido no tenía ningún límite. Al vencer la vigencia de una licencia (contada desde que el empleado se registra con ella, no desde que se crea), el empleado pierde acceso a la app; sus datos de diagnóstico no se borran. ADM crea empresas y genera licencias desde `/admin/empresas`.

---

## ADR-007 — Prioridad de dispositivo por vista

**Estado:** Accepted
**Contexto:** "Web responsive" no significa que todas las vistas se diseñen iguales. Cada rol (empleado, RRHH, admin Caudall) tiene un dispositivo típico de uso distinto.

**Decisión:**
- **Empleado:** mobile-first. La experiencia se diseña primero para móvil y se adapta a pantallas más grandes.
- **RRHH (tenant admin):** desktop-first. Optimizado para dashboards, filtros, exportar. Móvil funcional pero secundario.
- **Admin Caudall (interno):** desktop-only razonable. No se optimiza para móvil.

**Alternativas consideradas:**
- Los tres totalmente responsive con el mismo esfuerzo. Rechazado: cuesta varias veces más y no aporta valor proporcional.
- Empleado y RRHH mobile-first. Rechazado: los dashboards de RRHH se degradan sin diseño desktop-primero.

**Consecuencias:**
- Grupos de rutas en Next.js: `(employee)`, `(hr)`, `(admin)`.
- Layouts distintos por grupo, con breakpoints por defecto distintos.
- Admin puede usar componentes densos sin restricciones mobile.
- Todos los layouts pasan el linter de accesibilidad; ninguno se hace "solo desktop" técnicamente, solo priorizado.

---

## ADR-008 — Autenticación del empleado: magic link + OAuth Google (sin contraseñas)

**Estado:** Accepted
**Contexto:** El empleado se autoregistra (ADR-006). Necesita autenticarse. Opciones: contraseña, magic link, OTP, OAuth.

**Decisión:** Magic link como principal. OAuth con Google **cuenta personal** como opcional. Sin contraseñas.

**Alternativas consideradas:**
- Contraseña clásica. Rechazado: fricción psicológica, contraseñas olvidadas, riesgo por reutilización.
- Solo OTP numérico. Similar a magic link pero peor UX en desktop.
- Solo OAuth. Rechazado: no todos tienen Google/Apple; magic link es el fallback universal.

**Consecuencias:**
- Auth.js/NextAuth v5 con provider `EmailProvider` (magic link) y `GoogleProvider`.
- Proveedor de email robusto (Resend recomendado) desde el día 1 — la deliverability es crítica.
- El flujo detecta si un email corresponde a un dominio corporativo del tenant y advierte al usuario.
- La sesión persiste con cookie httpOnly, refresh razonable, logout explícito disponible.

---

## ADR-009 — PWA desde el MVP

**Estado:** Accepted
**Contexto:** Plataforma es web responsive. Dentro de eso puede ser web pura (solo navegador) o PWA (instalable en home screen, offline básico, notificaciones push).

**Decisión:** PWA desde el MVP. Service worker, manifest, prompt de instalación, notificaciones push cuando la plataforma lo permita.

**Alternativas consideradas:**
- Web pura, PWA en fase siguiente. Rechazado por el owner. Consideraciones que asumimos: la percepción "app-like" tiene valor para adopción y retención del empleado, y las push notifications son un multiplicador de reengagement.

**Consecuencias:**
- Dependencia `next-pwa` desde el arranque.
- `public/manifest.json` completo con íconos en resoluciones estándar.
- Service worker configurado para offline básico (cachear assets estáticos).
- Testing especial en iOS Safari — las PWAs se rompen ahí más que en Android.
- Push notifications en iOS requieren instalación previa (agregar a home screen); el onboarding debe considerarlo.
- Se acepta el costo adicional de semanas de configuración y testing.

---

## Cambios a estas decisiones

Cualquier cambio a las decisiones anteriores requiere:

1. Nueva ADR (ADR-010, etc.) que explique el cambio.
2. Marcar la ADR anterior como `Superseded by ADR-XXX`.
3. PR discutido y aprobado por Reynoso.
4. Revisión de las consecuencias en el código.
