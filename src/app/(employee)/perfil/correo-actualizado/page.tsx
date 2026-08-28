import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EmployeeTopBar } from '../../employee-topbar';

export default async function CorreoActualizadoPage() {
  const t = await getTranslations('employee.profile.emailChangeConfirm');

  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeTopBar />
      <main className="flex-1 flex flex-col items-center p-6 pt-16">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-ok/10 text-ok flex items-center justify-center text-2xl mx-auto mb-4">
            ✓
          </div>
          <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
          <p className="text-sm text-nickel mb-6">{t('subtitle')}</p>
          <Link href="/perfil" className="inline-block bg-yale text-white rounded-lg py-2.5 px-6 text-sm">
            {t('ctaBack')}
          </Link>
        </div>
      </main>
    </div>
  );
}
