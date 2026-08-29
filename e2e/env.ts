import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Playwright no carga .env.local solo (a diferencia de Next, que sí lo
// hace para su propio proceso de `next dev`) — este proceso de test
// necesita las mismas variables para poder importar directo módulos de
// la app (Prisma, magic-link) sin pasar por HTTP. Parser mínimo a
// propósito, sin agregar `dotenv` como dependencia nueva solo para esto.
export function loadEnv(): void {
  for (const file of ['.env.local', '.env']) {
    const filePath = resolve(process.cwd(), file);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
