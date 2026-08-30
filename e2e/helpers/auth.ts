import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { rawPrisma } from './db';

// Bypass deliberado del correo del magic link: no hay forma de recibir un
// correo real en un test (no hay proveedor de email configurado, y no
// debería haberlo — no queremos que los tests dependan de una red
// externa). Se firma acá el mismo tipo de token que produce
// createMagicLinkToken() en producción (src/lib/auth/magic-link.ts) y se
// visita /api/auth/verify directo, el mismo endpoint real que procesa el
// link cuando alguien hace click desde su correo — lo único que se salta
// es "recibir y abrir el correo", no la sesión en sí.
//
// No se importa esa función directo: magic-link.ts encadena imports que
// usan el alias "@/..." de la app (tsconfig `paths`), que el loader de
// TypeScript de Playwright no resuelve de forma confiable para módulos
// fuera de e2e/ — más simple y robusto firmar acá con el mismo secreto
// (AUTH_SECRET) que duplicar esa cadena de imports.
async function signTestMagicLinkToken(
  payload: { type: 'employee'; tenantId: string; employeeId: string; email: string } | { type: 'admin'; adminUserId: string; email: string }
): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET no está configurado — ver e2e/README.md.');
  }
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));
}

export async function createTestEmployee(): Promise<{ employeeId: string; tenantId: string; email: string }> {
  const tenant = await rawPrisma.tenant.findUniqueOrThrow({ where: { enrollmentCode: 'ACME2026' } });
  const email = `e2e-${randomUUID()}@example.com`;

  const employee = await rawPrisma.employee.create({
    data: {
      tenantId: tenant.id,
      personalEmail: email,
      enrollmentCodeUsed: tenant.enrollmentCode,
      authMethod: 'MAGIC_LINK'
    }
  });

  return { employeeId: employee.id, tenantId: tenant.id, email };
}

export async function loginAsEmployee(page: Page, employee: { employeeId: string; tenantId: string; email: string }): Promise<void> {
  const token = await signTestMagicLinkToken({
    type: 'employee',
    tenantId: employee.tenantId,
    employeeId: employee.employeeId,
    email: employee.email
  });

  await page.goto(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}

// Admin EMPRESA (RRHH) del tenant demo — mismo mecanismo de bypass que
// createTestEmployee/loginAsEmployee de arriba (firma el mismo tipo de
// token que createMagicLinkToken() produce para un admin en producción,
// visita el mismo /api/auth/verify real). tenantId propio (no
// ACME2026 fijo dentro del helper) para poder reusarlo con cualquier
// tenant si algún test futuro lo necesita.
export async function createTestEmpresaAdmin(tenantId: string): Promise<{ adminUserId: string; email: string }> {
  const email = `e2e-admin-${randomUUID()}@example.com`;

  const admin = await rawPrisma.adminUser.create({
    data: { email, profileType: 'EMPRESA', tenantId }
  });

  return { adminUserId: admin.id, email };
}

export async function loginAsAdmin(page: Page, admin: { adminUserId: string; email: string }): Promise<void> {
  const token = await signTestMagicLinkToken({
    type: 'admin',
    adminUserId: admin.adminUserId,
    email: admin.email
  });

  await page.goto(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}
