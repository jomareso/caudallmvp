import { requireEmpresa } from '@/lib/auth/admin-context';
import { EmpresaDashboard } from './empresa-dashboard';

export default async function AdminEmpresaPage() {
  const admin = await requireEmpresa();
  return <EmpresaDashboard tenantId={admin.tenantId!} />;
}
