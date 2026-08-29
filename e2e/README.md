# Tests e2e (Playwright)

Cubren el journey real del empleado — antes no existía ningún test automatizado de esto, solo Vitest para motores puros.

## Requisitos

1. Un Postgres local con las migraciones aplicadas y sembrado:
   ```
   npx prisma migrate deploy
   npm run prisma:seed
   ```
2. `.env.local` con `DATABASE_URL`/`APP_DATABASE_URL` apuntando a ese Postgres, y `AUTH_SECRET` configurado (ver `.env.example`). **No hace falta** `RESEND_API_KEY` — los tests nunca envían un correo real.

## Correr

```
npm run test:e2e
```

Levanta `next dev` solo (`playwright.config.ts`, `webServer`) y corre contra `http://localhost:3000`.

## Por qué no se prueba el envío real del magic link

`requestMagicLink` (registro/login) manda un correo de verdad vía Resend — no hay forma de recibirlo en un test sin un proveedor de email real, y no debería haberla (los tests no deben depender de una red externa). En cambio, el journey autenticado entra con un token firmado directo — la misma función (`createMagicLinkToken`) y el mismo endpoint (`/api/auth/verify`) que procesa el click real de un correo — ver `helpers/auth.ts`. Lo único que se salta es "recibir y abrir el correo", no la sesión real.

## Datos de prueba

Cada test crea su propio `Employee` nuevo contra el tenant demo (`ACME2026`, sembrado por `prisma/seed.ts`) con un correo aleatorio — no se limpian solos después de correr (algunas tablas relacionadas no tienen cascada de borrado). En un Postgres de desarrollo esto no importa; si se acumula demasiado, `npx prisma migrate reset && npm run prisma:seed` empieza de cero.
