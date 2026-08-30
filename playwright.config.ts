import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './e2e/env';

loadEnv();

// e2e del journey del empleado (auditoría de fase de empleado, 29 ago) —
// antes no existía ningún test automatizado del flujo real, solo Vitest
// para motores puros. Requiere una base de datos Postgres local sembrada
// (ver e2e/README.md) — no corre contra producción ni contra Neon.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // En CI, además de 'list' en la consola del job, genera el reporte HTML
  // que el workflow (.github/workflows/e2e.yml) sube como artefacto si
  // algo falla — 'open: never' porque no hay navegador para abrirlo ahí.
  // En local se queda solo 'list' (comportamiento sin cambios).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // El diagnóstico es adaptativo (8-18+ preguntas financieras, más el
  // bloque de contexto) — cada respuesta es un round-trip real de Server
  // Action, así que un journey completo de punta a punta necesita bastante
  // más que el default de Playwright (30s).
  timeout: 120_000,
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // El entorno de desarrollo trae Chromium preinstalado en una ruta
        // fija (no la que Playwright espera por versión) — usarla directo
        // evita que intente descargar un binario nuevo. `--disable-*`:
        // sin esto, Chromium intenta llamadas de red de fondo (Safe
        // Browsing, sync, actualización de componentes) que en una red
        // restringida (sandbox sin salida a dominios de Google) se quedan
        // reintentando y frenan la página entera — encontrado armando
        // este test.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? {
              executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
              args: [
                '--disable-background-networking',
                '--disable-sync',
                '--disable-component-update',
                '--disable-domain-reliability',
                '--disable-client-side-phishing-detection',
                '--disable-features=OptimizationHints,MediaRouter'
              ]
            }
          : undefined
      }
    }
  ],
  // Levanta el propio dev server — así `npm run test:e2e` es un solo
  // comando, no dos terminales. reuseExistingServer permite apuntar a un
  // `npm run dev` ya corriendo en desarrollo local.
  webServer: {
    // `next dev` compila cada ruta la primera vez que se pide (JIT) — con
    // un diagnóstico de ~25 preguntas seguidas, eso solo ya puede superar
    // el timeout de un test. `next start` (sobre un build ya hecho, ver
    // README) corre contra código ya compilado, más rápido y más fiel a
    // producción real.
    command: 'npm run start',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
