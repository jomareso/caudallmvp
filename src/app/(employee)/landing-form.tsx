'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { validateEnrollmentCode } from './actions';

export function LandingForm() {
  const t = useTranslations('employee.landing');
  const tTrust = useTranslations('employee.trust');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await validateEnrollmentCode(code);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/registro?code=${encodeURIComponent(code.trim().toUpperCase())}`);
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-medium text-yale mb-1">caudall</h1>
        <p className="text-nickel text-sm mb-8">{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
          <label htmlFor="enrollmentCode" className="block text-xs text-nickel mb-1">
            {t('enrollmentCodeLabel')}
          </label>
          <input
            id="enrollmentCode"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('enrollmentCodePlaceholder')}
            autoCapitalize="characters"
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz text-center uppercase tracking-wide mb-3 focus:outline-none focus:border-cola"
          />

          {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
          >
            {isPending ? t('validating') : t('ctaContinue')}
          </button>
        </form>

        <p className="text-[11px] text-nickel mt-4">{tTrust('privacyGuarantee')}</p>
      </div>
    </main>
  );
}
