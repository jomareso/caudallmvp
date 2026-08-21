# Caudall MVP

Plataforma web de salud financiera para empresas en República Dominicana.

**Modelo:** B2B2E (Business-to-Business-to-Employee). Empresas contratan Caudall como beneficio de bienestar financiero para sus empleados. Cada empresa es un tenant.

**Versión de arquitectura:** Caudall v2.0

## Qué es esto

Caudall no es un cuestionario financiero más. Es un sistema adaptativo basado en evidencia que sigue el ciclo:

```
EVIDENCE → VARIABLES → CONSTRUCTS → FINANCIAL STATE → CFHI
→ SAFETY → ROOT CAUSE → PRIORITY → ELIGIBILITY
→ FINANCIAL READINESS → BEHAVIORAL READINESS
→ NEXT BEST ACTION → BEHAVIORAL DESIGN → COMMITMENT
→ OUTCOME → LEARNING → NUEVO ESTADO
```

El empleado responde un diagnóstico adaptativo (8-12 preguntas típicamente), obtiene un CFHI (Caudall Financial Health Index) de 5 dimensiones — Control, Resiliencia, Deuda, Ahorro, Planificación — y recibe intervenciones conductuales personalizadas. La empresa nunca ve datos individuales; solo métricas agregadas y anonimizadas.

## Documentación

Antes de escribir código, lee en este orden:

1. **[`CLAUDE.md`](CLAUDE.md)** — Instrucciones de trabajo para Claude Code y para cualquier desarrollador que llegue al proyecto. Contrato de trabajo.
2. **[`docs/decisions.md`](docs/decisions.md)** — Las 9 decisiones de negocio y producto que gobiernan el MVP. Formato ADR.
3. **[`docs/spec-v2.md`](docs/spec-v2.md)** — Especificación arquitectónica completa de Caudall v2.0.
4. **[`docs/data-model.md`](docs/data-model.md)** — Modelo de datos: entidades, relaciones, reglas de integridad.
5. **[`docs/prototype/`](docs/prototype/)** — Prototipos HTML de referencia visual para las tres vistas.

## Stack

- **Framework:** Next.js 14+ (App Router) con TypeScript
- **Base de datos:** PostgreSQL con Prisma ORM
- **Autenticación:** Magic link + OAuth Google (Auth.js/NextAuth)
- **Estilos:** Tailwind CSS
- **i18n:** next-intl (solo español en MVP; i18n listo desde el inicio)
- **PWA:** next-pwa
- **Testing:** Vitest (unit) + Playwright (e2e)
- **Email:** Resend
- **Deploy:** Vercel

## Setup local

Requisitos: Node.js 20+, PostgreSQL 15+, pnpm (o npm).

```bash
# Instalar dependencias
pnpm install

# Copiar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# Correr migraciones
pnpm prisma migrate dev

# Levantar servidor de desarrollo
pnpm dev
```

Abre http://localhost:3000.

## Estructura del proyecto

```
caudall-mvp/
├── CLAUDE.md                # Instrucciones para Claude Code
├── README.md                # Este archivo
├── docs/                    # Documentación del proyecto
│   ├── spec-v2.md          # Spec arquitectónica completa
│   ├── decisions.md        # Las 9 decisiones (ADRs)
│   ├── data-model.md       # Modelo de datos
│   └── prototype/          # HTMLs de referencia visual
├── prisma/
│   └── schema.prisma       # Schema de base de datos
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (employee)/     # Rutas del empleado (mobile-first)
│   │   ├── (hr)/           # Rutas del RRHH de tenant (desktop-first)
│   │   ├── (admin)/        # Rutas del admin Caudall (desktop-only)
│   │   └── api/            # API routes
│   ├── lib/                # Lógica compartida
│   │   ├── engines/        # Motores: CFHI, Safety, Root Cause, etc.
│   │   ├── auth/           # Auth setup
│   │   ├── db/             # Prisma client, RLS helpers
│   │   └── i18n/           # next-intl setup
│   └── components/         # Componentes UI compartidos
├── public/                 # Assets estáticos, manifest.json (PWA)
└── messages/               # Traducciones (es.json)
```

## Principios no negociables

1. **La empresa nunca ve datos individuales de empleados.** Agregados anonimizados con umbral mínimo.
2. **Multi-tenant desde la raíz.** Toda entidad lleva `tenantId`. Row-Level Security en PostgreSQL.
3. **Provenance obligatorio en toda Evidence.**
4. **Primary Owner por variable — no double counting en scoring.**
5. **Versionado consistente:** cada respuesta atada a versión de metodología y banco.
6. **Sin contraseñas para empleados.** Magic link o OAuth personal.
7. **Sin productos financieros en MVP.** Solo educación e intervenciones conductuales.

Detalles en [`CLAUDE.md`](CLAUDE.md) y [`docs/decisions.md`](docs/decisions.md).

## Estado

MVP en construcción inicial. Cero código funcional aún. Los prototipos en `docs/prototype/` son referencia visual, no implementación.

## Owner

Reynoso (Jose Reynoso Solér) — Product owner y decisor final. Revisa cada PR.
