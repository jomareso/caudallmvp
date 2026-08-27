import { redirect } from 'next/navigation';
import { findTenantByCode } from '@/lib/licenses';
import { runWithTenantContext } from '@/lib/db/prisma';
import { EmailForm } from './email-form';
import { BrandPanel } from '../brand-panel';

export default async function RegistroPage({
  searchParams
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code?.trim().toUpperCase();
  if (!code) redirect('/');

  // Antes de cualquier sesión, sin tenant conocido todavía — mismo
  // contexto que validateEnrollmentCode/requestMagicLink en
  // (employee)/actions.ts (ver comentario ahí): el WHERE siempre filtra
  // por un código único, así que platform-admin es seguro acá.
  const found = await runWithTenantContext({ kind: 'platform-admin' }, () => findTenantByCode(code));
  if (!found || found.tenant.status === 'SUSPENDED') redirect('/');
  if (found.license?.status === 'EXPIRED' || (found.license?.expiresAt && found.license.expiresAt < new Date())) {
    redirect('/');
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />
      <EmailForm enrollmentCode={code} tenantName={found.tenant.name} />
    </main>
  );
}
