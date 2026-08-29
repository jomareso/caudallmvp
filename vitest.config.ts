import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

// Motores como root-cause.ts/safety.ts importan `prisma` (@/lib/db/prisma)
// a nivel de módulo — el cliente se construye apenas se importa el
// archivo, aunque el test en sí nunca toque la base de datos. Sin
// DATABASE_URL definida esa construcción tira, y el archivo entero falla a
// cargar. Vite/Vitest no populan process.env desde .env automáticamente en
// todos los entornos — se carga explícito acá para no depender de eso.
Object.assign(process.env, loadEnv('', __dirname, ''));

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
