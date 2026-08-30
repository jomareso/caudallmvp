import { notFound } from 'next/navigation';
import type { Route } from 'next';
import { prisma, runWithTenantContext } from '@/lib/db/prisma';
import { requireAdm } from '@/lib/auth/admin-context';
import { EmpresaDashboard } from '../../../empresa/empresa-dashboard';

// "Ver como RRHH" (pedido del founder, 28 ago): ADM puede ver exactamente
// lo que ve el admin EMPRESA de un tenant, sin necesitar crear un usuario
// aparte para probarlo. No es una sesión falsa ni un cambio de rol — solo
// reusa el mismo componente de dashboard con el tenantId de la URL, bajo
// el mismo contexto RLS 'tenant' que usaría el admin real de esa empresa
// (Decisión 1: el aislamiento lo da RLS, no quién invoca el código).
// Queda auditado en AuditLog para que quede registro de qué ADM vio el
// dashboard de qué empresa y cuándo.
export default async function EmpresaViewAsPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const admin = await requireAdm();

  // Tenant es catálogo de plataforma (sin RLS) — platform-admin por
  // consistencia con el resto de /admin/empresas.
  const tenant = await runWithTenantContext({ kind: 'platform-admin' }, () =>
    prisma.tenant.findUnique({ where: { id: params.id } })
  );
  if (!tenant) notFound();

  await prisma.auditLog.create({
    data: {
      whoId: admin.id,
      whoData: { email: admin.email, profileType: admin.profileType },
      what: 'VIEW_TENANT_DASHBOARD',
      entityType: 'Tenant',
      entityId: tenant.id,
      newValue: { tenantName: tenant.name }
    }
  });

  // typedRoutes no puede validar un href armado con un id en runtime —
  // el patrón /admin/empresas/[id] sí existe (ver el `Route` importado).
  const backHref = `/admin/empresas/${tenant.id}` as Route;

  return <EmpresaDashboard tenantId={tenant.id} backHref={backHref} searchParams={searchParams} />;
}
