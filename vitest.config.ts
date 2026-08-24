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
  }
});
