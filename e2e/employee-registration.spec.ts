import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Cubre lo que SÍ se puede probar con solo el navegador, sin un proveedor
// de correo real: validación del correo/código de acceso y del formulario
// de registro. Los pasos que terminan mandando un correo (resolveAccessByEmail
// con un correo ya registrado, requestMagicLink) no se cubren acá —
// dependen de RESEND_API_KEY, que no debería (ni necesita) estar
// configurado para correr estos tests. El resto del journey autenticado
// se prueba en employee-diagnostic-journey.spec.ts, entrando directo con
// un token firmado igual que el que llegaría por correo (ver
// helpers/auth.ts) — ahí sí se ejercita el mismo endpoint real que usa un
// click desde el correo.

// /acceso pide el correo primero (ver landing-form.tsx) — si no matchea
// ninguna cuenta existente, revela el campo de código. Un correo fresco al
// azar garantiza caer siempre en esa rama ("no encontrado"), sin depender
// de qué otros tests ya corrieron.
async function advanceToCodeStep(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/acceso');
  await page.locator('#employeeEmail').fill(`e2e-${randomUUID()}@example.com`);
  await page.getByRole('button', { name: /continuar/i }).click();
  await expect(page.locator('#enrollmentCode')).toBeVisible();
}

test.describe('Acceso y registro', () => {
  test('un código de acceso inválido muestra el error, no deja avanzar', async ({ page }) => {
    await advanceToCodeStep(page);
    await page.locator('#enrollmentCode').fill('CODIGO_QUE_NO_EXISTE');
    await page.getByRole('button', { name: /continuar|reintentar/i }).click();

    await expect(page.getByText(/código no es válido/i)).toBeVisible();
    await expect(page).toHaveURL(/\/acceso/);
  });

  test('un código de acceso válido (tenant demo) avanza a /registro', async ({ page }) => {
    await advanceToCodeStep(page);
    await page.locator('#enrollmentCode').fill('ACME2026');
    await page.getByRole('button', { name: /continuar/i }).click();

    await expect(page).toHaveURL(/\/registro\?code=ACME2026/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('desde /registro se puede volver a /acceso', async ({ page }) => {
    await page.goto('/registro?code=ACME2026');
    await page.getByText(/volver/i).click();

    await expect(page).toHaveURL(/\/acceso/);
  });
});
