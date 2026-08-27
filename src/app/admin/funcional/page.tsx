import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth/admin-context';

export default async function AdminFuncionalPage() {
  const admin = await requireAdmin();
  if (admin.profileType !== 'FUNCIONAL') redirect('/admin');

  const t = await getTranslations('admin.funcional');

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
        <p className="text-sm text-nickel">{t('body')}</p>
      </div>
    </main>
  );
}
