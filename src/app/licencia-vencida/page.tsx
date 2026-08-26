import { getTranslations } from 'next-intl/server';

export default async function LicenciaVencidaPage() {
  const t = await getTranslations('employee.licenseExpired');

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-bad/10 text-bad flex items-center justify-center text-2xl mx-auto mb-4">
          !
        </div>
        <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
        <p className="text-sm text-nickel">{t('subtitle')}</p>
      </div>
    </main>
  );
}
