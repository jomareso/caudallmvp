import { test, expect } from '@playwright/test';
import { rawPrisma } from './helpers/db';
import { createTestEmpresaAdmin, loginAsAdmin } from './helpers/auth';

// Login de RRHH y panel de empresa (/admin/empresa) — mismo mecanismo de
// bypass de correo que el journey del empleado (ver helpers/auth.ts):
// entra directo con un token firmado, mismo endpoint real que procesa un
// click de magic link de verdad. Un admin EMPRESA fresco (profileType
// EMPRESA, tenantId del tenant demo) se crea directo con Prisma — no hay
// autoregistro de admin, un AdminUser solo existe si alguien lo crea (ver
// prisma/seed.ts).

test.describe('RRHH: login y panel de empresa', () => {
  test('login de un admin EMPRESA aterriza en /admin/empresa con el nombre del tenant', async ({ page }) => {
    const tenant = await rawPrisma.tenant.findUniqueOrThrow({ where: { enrollmentCode: 'ACME2026' } });
    const admin = await createTestEmpresaAdmin(tenant.id);

    await loginAsAdmin(page, admin);

    await expect(page).toHaveURL(/\/admin\/empresa/);
    await expect(page.getByRole('heading', { name: new RegExp(tenant.name) })).toBeVisible();
  });

  test('el panel muestra las licencias y, según los datos del tenant, el CFHI promedio o el aviso de datos insuficientes', async ({
    page
  }) => {
    const tenant = await rawPrisma.tenant.findUniqueOrThrow({ where: { enrollmentCode: 'ACME2026' } });
    const admin = await createTestEmpresaAdmin(tenant.id);

    await loginAsAdmin(page, admin);

    // Las licencias son visibles siempre (Decisión 1: no dependen del
    // umbral de anonimato) — en las dos ramas posibles del dashboard.
    await expect(page.getByText('Licencias', { exact: true })).toBeVisible();

    // Cuál de las dos ramas aparece depende de cuántos empleados de este
    // tenant ya completaron el diagnóstico (umbral de anonimato,
    // aggregationMinSegmentSize) — no se fuerza una combinación
    // específica de datos para este test, solo que sea siempre una de
    // las dos, nunca una pantalla a medio cargar (mismo criterio que el
    // test de /diagnostico/accion).
    const insufficientNotice = page.getByText('Todavía no hay suficientes datos');
    const averageCfhi = page.getByText('Índice de Salud Financiera promedio');

    await expect(insufficientNotice.or(averageCfhi)).toBeVisible({ timeout: 10_000 });
  });
});
