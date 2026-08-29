import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

// Decisión 6 (actualizada): cada empleado se registra con su propia
// licencia individual, no con un código compartido por toda la empresa.
// Las duraciones permitidas ya no son una lista fija en código — viven en
// PlatformSettings.licenseDurationsMonths (editable desde
// /admin/configuracion) y se pasan acá como `allowed`.
export function isLicenseDurationMonths(value: number, allowed: readonly number[]): boolean {
  return allowed.includes(value);
}

// Sin 0/O ni 1/I: se escriben a mano al entrar a la app, esos pares se
// confunden fácil.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function generateLicenseCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function generateUniqueLicenseCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateLicenseCode());
  }
  return [...codes];
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Un código de acceso puede ser una licencia individual (modelo actual) o
// el código compartido viejo de Tenant.enrollmentCode (tenants creados
// antes de este cambio) — se prueba primero como licencia porque es el
// caso normal ahora.
export async function findTenantByCode(code: string) {
  const license = await prisma.license.findUnique({ where: { code }, include: { tenant: true } });
  if (license) return { tenant: license.tenant, license };

  const tenant = await prisma.tenant.findUnique({ where: { enrollmentCode: code } });
  return tenant ? { tenant, license: null } : null;
}
