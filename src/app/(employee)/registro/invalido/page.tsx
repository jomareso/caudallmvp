import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BrandPanel } from '../../acceso/brand-panel';

export default async function InvalidoPage() {
  const t = await getTranslations('employee.invalidLink');

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2">
      <BrandPanel />
      <div className="flex flex-col items-center p-6 pt-16 lg:justify-center">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-bad/10 text-bad flex items-center justify-center text-2xl mx-auto mb-4">
            !
          </div>
          <h1 className="text-lg font-medium text-quartz mb-2">{t('title')}</h1>
          <p className="text-sm text-nickel mb-6">{t('subtitle')}</p>
          <Link
            href="/acceso"
            className="inline-block bg-yale text-white rounded-lg py-2.5 px-6 text-sm"
          >
            {t('ctaRetry')}
          </Link>
        </div>
      </div>
    </main>
  );
}
