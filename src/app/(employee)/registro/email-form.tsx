'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { requestMagicLink } from '../actions';

export function EmailForm({
  enrollmentCode,
  tenantName
}: {
  enrollmentCode: string;
  tenantName: string;
}) {
  const t = useTranslations('employee.email');
  const tTrust = useTranslations('employee.trust');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestMagicLink({ enrollmentCode, email });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push('/registro/enviado');
    });
  }

  return (
    <div className="flex flex-col items-center p-6 pt-16 lg:justify-center">
      <div className="w-full max-w-sm">
        <p className="text-xs text-nickel text-center mb-1">{tenantName} &middot; caudall</p>
        <h1 className="text-lg font-medium text-quartz text-center mb-1">{t('title')}</h1>
        <p className="text-sm text-nickel text-center mb-6">{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6">
          <label htmlFor="email" className="block text-xs text-nickel mb-1">
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          />

          {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
          >
            {isPending ? t('sending') : t('ctaSendLink')}
          </button>

          {/* En lg+ el panel de marca (brand-panel.tsx) ya muestra esta misma garantía — repetirla acá se vería duplicado */}
          <div className="bg-picton/10 rounded-lg px-3 py-2.5 mt-4 flex gap-2 items-start lg:hidden">
            <span aria-hidden className="text-sm">🔒</span>
            <p className="text-[11px] text-yale/90">{tTrust('privacyGuarantee')}</p>
          </div>
        </form>
      </div>
    </div>
  );
}
