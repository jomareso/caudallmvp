import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { findTenantByCode, addMonths } from '@/lib/licenses';

export type GoogleEnrollmentErrorCode =
  | 'NO_CODE'
  | 'CODE_INVALID'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_TAKEN'
  | 'CORPORATE_EMAIL';

export class GoogleEnrollmentError extends Error {
  constructor(public code: GoogleEnrollmentErrorCode) {
    super(code);
  }
}

// Mismas reglas que requestMagicLink en (employee)/actions.ts (código
// vigente, licencia no vencida, correo personal no corporativo) —
// duplicadas a propósito, no extraídas a un helper común: ese vive como
// Server Action que devuelve un ActionResult tipado para un formulario;
// este corre dentro del profile() de GoogleProvider (ver auth.ts), que
// solo puede devolver el `user` de la sesión o lanzar — no tiene forma de
// mostrarle un ActionResult al usuario en la misma pantalla.
export async function resolveOrCreateEmployeeForGoogle(params: {
  enrollmentCode: string;
  email: string;
}): Promise<{ id: string; email: string; tenantId: string; role: 'employee' }> {
  const enrollmentCode = params.enrollmentCode.trim().toUpperCase();
  const email = params.email.trim().toLowerCase();

  return runWithTenantContext({ kind: 'platform-admin' }, async () => {
    const found = await findTenantByCode(enrollmentCode);
    if (!found || found.tenant.status === 'SUSPENDED') {
      throw new GoogleEnrollmentError('CODE_INVALID');
    }
    const { tenant, license } = found;

    if (license?.status === 'EXPIRED' || (license?.expiresAt && license.expiresAt < new Date())) {
      throw new GoogleEnrollmentError('LICENSE_EXPIRED');
    }

    // Decisión 6: el correo debe ser personal, no corporativo. La cuenta de
    // Google puede perfectamente ser la corporativa (Workspace) — se
    // rechaza igual que en requestMagicLink.
    if (tenant.corporateEmailDomain) {
      const domain = email.split('@')[1];
      if (domain === tenant.corporateEmailDomain.toLowerCase()) {
        throw new GoogleEnrollmentError('CORPORATE_EMAIL');
      }
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: { tenantId_personalEmail: { tenantId: tenant.id, personalEmail: email } }
    });

    if (license?.status === 'ACTIVE' && existingEmployee?.licenseId !== license.id) {
      throw new GoogleEnrollmentError('LICENSE_TAKEN');
    }

    const employee =
      existingEmployee ??
      (await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          personalEmail: email,
          enrollmentCodeUsed: enrollmentCode,
          licenseId: license?.id,
          authMethod: 'GOOGLE_OAUTH'
        }
      }));

    if (license && license.status === 'UNUSED') {
      const activatedAt = new Date();
      await prisma.license.update({
        where: { id: license.id },
        data: { status: 'ACTIVE', activatedAt, expiresAt: addMonths(activatedAt, license.durationMonths) }
      });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        status: employee.status === 'REGISTERED' ? 'ACTIVE' : employee.status,
        lastActiveAt: new Date()
      }
    });

    return { id: employee.id, email: employee.personalEmail, tenantId: employee.tenantId, role: 'employee' as const };
  });
}
