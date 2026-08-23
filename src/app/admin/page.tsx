import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { AdminLoginForm } from './login-form';

export default async function AdminLoginPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role === 'admin' && sessionUser.id) {
    const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
    if (admin) redirect('/admin/configuracion');
  }

  return <AdminLoginForm />;
}
