import { test, expect } from '@playwright/test';

// Cubre lo que SÍ se puede probar con solo el navegador, sin un proveedor
// de correo real: validación del código de acceso y del formulario de
// registro. El paso "se envió el link" (requestMagicLink) no se cubre
// acá — depende de RESEND_API_KEY, que no debería (ni necesita) estar
// configurado para correr estos tests. El resto del journey autenticado
// se prueba en employee-diagnostic-journey.spec.ts, entrando directo con
// un token firmado igual que el que llegaría por correo (ver
// helpers/auth.ts) — ahí sí se ejercita el mismo endpoint real que usa un
// click desde el correo.

test.describe('Acceso y registro', () => {
  test('un código de acceso inválido muestra el error, no deja avanzar', async ({ page }) => {
    await page.goto('/acceso');
    await page.locator('#enrollmentCode').fill('CODIGO_QUE_NO_EXISTE');
    await page.getByRole('button', { name: /continuar|reintentar/i }).click();

    await expect(page.getByText(/código no es válido/i)).toBeVisible();
    await expect(page).toHaveURL(/\/acceso/);
  });

  test('un código de acceso válido (tenant demo) avanza a /registro', async ({ page }) => {
    await page.goto('/acceso');
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
