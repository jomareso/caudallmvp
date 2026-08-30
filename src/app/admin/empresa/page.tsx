import { requireEmpresa } from '@/lib/auth/admin-context';
import { EmpresaDashboard } from './empresa-dashboard';

export default async function AdminEmpresaPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const admin = await requireEmpresa();
  return <EmpresaDashboard tenantId={admin.tenantId!} searchParams={searchParams} />;
}
