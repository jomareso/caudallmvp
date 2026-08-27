import { redirect } from 'next/navigation';
import type { AdminUser } from '@prisma/client';
import { auth } from '@/lib/auth/auth';
import { prisma, runWithTenantContext, type TenantContext } from '@/lib/db/prisma';

// El contexto de Row-Level Security fijado en un Layout NO se propaga a
// una Page/Server Action anidada en Next.js App Router — verificado
// empíricamente (cada segmento de ruta corre en su propio tramo async,
// fuera del callback de AsyncLocalStorage.run() del padre). Por eso cada
// punto de entrada del panel admin (page.tsx, actions.ts) debe resolver
// su propio AdminUser y fijar su propio contexto, en vez de asumir que
// admin/layout.tsx ya lo hizo.
//
// requireAdmin(): resuelve la sesión + la fila propia del AdminUser bajo
// contexto 'session-subject' (el único que no necesita conocer el tenant
// de antemano — ver comentario en src/lib/db/prisma.ts). No deja el
// contexto de tenant fijado para el resto de la función: para eso usa
// requireAdminWithContext().
export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await runWithTenantContext(
    { kind: 'session-subject', sessionSubjectId: sessionUser.id },
    () => prisma.adminUser.findUnique({ where: { id: sessionUser.id! } })
  );

  // Mismo chequeo que admin/layout.tsx: un admin desactivado puede seguir
  // teniendo un JWT válido hasta que expire.
  if (!admin || !admin.active) redirect('/admin');
  return admin;
}

export function adminTenantContext(admin: Pick<AdminUser, 'profileType' | 'tenantId'>): TenantContext {
  return admin.profileType === 'ADM'
    ? { kind: 'platform-admin' }
    : { kind: 'tenant', tenantId: admin.tenantId! };
}

// Caso común: resolver el admin y correr el resto de la page/action bajo
// SU contexto de tenant (platform-admin para ADM, tenant para
// EMPRESA/FUNCIONAL) — una sola llamada en vez de repetir el patrón en
// cada archivo.
export async function requireAdminWithContext<T>(
  fn: (admin: AdminUser) => Promise<T>
): Promise<T> {
  const admin = await requireAdmin();
  return runWithTenantContext(adminTenantContext(admin), () => fn(admin));
}

// Páginas/acciones exclusivas de ADM (control total de la plataforma).
export async function requireAdm(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.profileType !== 'ADM') redirect('/admin');
  return admin;
}

// Páginas/acciones exclusivas de EMPRESA (RRHH de un tenant).
export async function requireEmpresa(): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (admin.profileType !== 'EMPRESA' || !admin.tenantId) redirect('/admin');
  return admin;
}
