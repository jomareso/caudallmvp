import { redirect } from 'next/navigation';
import { findTenantByCode } from '@/lib/licenses';
import { EmailForm } from './email-form';

export default async function RegistroPage({
  searchParams
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code?.trim().toUpperCase();
  if (!code) redirect('/');

  const found = await findTenantByCode(code);
  if (!found || found.tenant.status === 'SUSPENDED') redirect('/');
  if (found.license?.status === 'EXPIRED' || (found.license?.expiresAt && found.license.expiresAt < new Date())) {
    redirect('/');
  }

  return <EmailForm enrollmentCode={code} tenantName={found.tenant.name} />;
}
