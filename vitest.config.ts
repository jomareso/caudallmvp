import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Mismo alias que tsconfig.json (@/* -> ./src/*) — sin esto, cualquier test
// de un engine que importe algo bajo src/lib (ej. @/lib/db/prisma) falla a
// resolver el módulo, aunque el código en sí sea correcto.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // e2e/ son specs de Playwright (test.describe de @playwright/test, no de
  // Vitest) — sin excluirlas, Vitest las recoge igual por el patrón
  // default *.spec.ts y falla porque test.describe() no puede llamarse
  // fuera de una corrida de Playwright.
  test: {
    exclude: ['**/node_modules/**', 'e2e/**']
  }
});
