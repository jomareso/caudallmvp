import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { EmailForm } from './email-form';

export default async function RegistroPage({
  searchParams
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code?.trim().toUpperCase();
  if (!code) redirect('/');

  const tenant = await prisma.tenant.findUnique({ where: { enrollmentCode: code } });
  if (!tenant || tenant.status === 'SUSPENDED') redirect('/');

  return <EmailForm enrollmentCode={tenant.enrollmentCode} tenantName={tenant.name} />;
}
