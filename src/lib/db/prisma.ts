import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

// Singleton para desarrollo — evita múltiples conexiones con hot reload
const globalForPrisma = globalThis as unknown as {
  rawPrisma: PrismaClient | undefined;
};

// APP_DATABASE_URL (rol sin ser dueño de las tablas, ver
// prisma/rls/create-app-role.sql) es la conexión de runtime que hace que
// Row-Level Security realmente aplique — Postgres ignora RLS para el
// dueño de la tabla. Si todavía no existe (ej. entornos que no han
// corrido ese script), cae a DATABASE_URL: la app sigue funcionando
// igual, solo sin la protección de RLS, para no romper nada de golpe.
const runtimeUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

const rawPrisma =
  globalForPrisma.rawPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: { db: { url: runtimeUrl } }
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.rawPrisma = rawPrisma;

// ---- Contexto de tenant para Row-Level Security ----
//
// RLS (prisma/migrations/*_enable_rls) decide qué filas devuelve la base
// de datos según tres variables de sesión de Postgres. Este módulo las
// fija automáticamente en cada query, usando AsyncLocalStorage para que
// CUALQUIER función que use `prisma` (los motores en src/lib/engines/,
// sin cambiar ni una línea de esos archivos) quede protegida en cuanto el
// punto de entrada (una página o Server Action) se envuelve una vez en
// runWithTenantContext() — no hace falta pasar una conexión a mano por
// cada función.
//
// 'session-subject' existe porque la PRIMERA consulta de cualquier
// request es "¿quién es este id de sesión?" (resolver el AdminUser o
// Employee por su id, tomado del JWT firmado) — en ese momento todavía no
// se conoce el tenant, así que no puede depender de app_tenant_id(). Las
// políticas de employees/admin_users permiten leer la propia fila por id
// en cualquier contexto; las tablas ligadas a un empleado (variable_states,
// evidence, etc.) también aceptan employeeId = session-subject-id
// directamente, así que el journey completo del empleado puede correr
// bajo este único contexto sin necesitar resolver tenant aparte.
export type TenantContext =
  | { kind: 'platform-admin' }
  | { kind: 'tenant'; tenantId: string }
  | { kind: 'session-subject'; sessionSubjectId: string };

const requestContext = new AsyncLocalStorage<TenantContext>();

// El `await fn()` de acá adentro (en vez de `return requestContext.run(context, fn)`
// directo) es necesario: las llamadas de Prisma Client despachan su
// trabajo real (lo que dispara $allOperations más abajo) en un microtask
// separado, no de forma síncrona. Si el callback pasado por quien llama
// es algo como `() => prisma.modelo.metodo(...)` (retorna la promesa
// misma, sin `await` propio), `requestContext.run()` ya habría salido del
// contexto de AsyncLocalStorage para cuando ese microtask corre, y
// $allOperations vería `undefined` — verificado empíricamente, no es
// solo teoría. Envolver el `fn()` en un `await` acá adentro fuerza una
// continuación async real, que Node sí sigue rastreando dentro del
// contexto — así ningún call site tiene que acordarse de hacerlo por su
// cuenta.
export function runWithTenantContext<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
  return requestContext.run(context, async () => {
    return await fn();
  });
}

// Scripts de sistema (prisma/seed.ts, el sync del banco de preguntas)
// operan sobre catálogo compartido sin dueño de tenant — corren fuera de
// runWithTenantContext a propósito, así que $allOperations abajo los deja
// pasar sin transacción extra (ver `if (!context) return query(args)`).
export const prisma = rawPrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query, model, operation }) {
        const context = requestContext.getStore();
        if (!context || !model) return query(args);

        return rawPrisma.$transaction(async (tx) => {
          if (context.kind === 'platform-admin') {
            await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;
          } else if (context.kind === 'tenant') {
            await tx.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
          } else {
            await tx.$executeRaw`SELECT set_config('app.session_subject_id', ${context.sessionSubjectId}, true)`;
          }

          const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
          // Despacho genérico hacia el mismo modelo/operación dentro de la
          // transacción con contexto ya fijado — el tipo dinámico (modelKey/
          // operation son strings en runtime) no se puede expresar sin un
          // cast; se evita `any` explícito para no depender de una regla de
          // lint que este eslintrc no tiene cargada.
          const dynamicTx = tx as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>;
          return dynamicTx[modelKey][operation](args);
        });
      }
    }
  }
});
