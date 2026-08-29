import { PrismaClient } from '@prisma/client';

// Cliente de Prisma "crudo" para arreglar/verificar datos desde los tests
// (crear un Employee de prueba, revisar que una migración de estado
// quedó bien) — a propósito NO es el cliente de src/lib/db/prisma.ts, que
// exige un TenantContext (RLS) por diseño. Se conecta con DATABASE_URL
// (rol dueño), igual que prisma/seed.ts — los tests de setup no están
// sujetos a RLS a propósito, es la misma app real la que sí lo está.
export const rawPrisma = new PrismaClient();
