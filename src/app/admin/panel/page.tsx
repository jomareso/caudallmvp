import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

export default async function AdminPanelPage() {
  const session = await auth();
  // Ver src/lib/auth/auth.ts sobre por qué el cast local.
  const sessionUser = session?.user as { id?: string; role?: 'employee' | 'admin' } | undefined;
  if (sessionUser?.role !== 'admin' || !sessionUser.id) redirect('/admin');

  const admin = await prisma.adminUser.findUnique({ where: { id: sessionUser.id } });
  if (!admin || admin.profileType !== 'ADM') redirect('/admin');

  const t = await getTranslations('admin.panel');

  return (
    <main className="min-h-screen p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-medium text-quartz mb-6">{t('title')}</h1>

        <div className="space-y-3">
          <Link
            href="/admin/configuracion"
            className="block bg-white border border-silver/60 rounded-xl p-4 hover:border-cola"
          >
            <p className="text-sm font-medium text-quartz">{t('settingsLink')}</p>
            <p className="text-xs text-nickel">{t('settingsDescription')}</p>
          </Link>

          <Link
            href="/admin/administradores"
            className="block bg-white border border-silver/60 rounded-xl p-4 hover:border-cola"
          >
            <p className="text-sm font-medium text-quartz">{t('adminsLink')}</p>
            <p className="text-xs text-nickel">{t('adminsDescription')}</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
