'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { requestMagicLink } from '../actions';
import { beginGoogleSignIn } from './google-actions';

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
  const [isGooglePending, startGoogleTransition] = useTransition();

  function handleGoogle() {
    startGoogleTransition(() => beginGoogleSignIn(enrollmentCode));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestMagicLink({ enrollmentCode, email });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(result.isExisting ? '/registro/enviado?existente=1' : '/registro/enviado');
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

          {/* ADR-008: magic link como principal, Google como opción — el
              divisor y el peso visual más liviano del botón de Google dejan
              claro cuál es el default sin ocultar la alternativa. */}
          <div className="flex items-center gap-2.5 my-3.5">
            <span className="flex-1 h-px bg-silver/60" />
            <span className="text-[11px] text-nickel">{t('or')}</span>
            <span className="flex-1 h-px bg-silver/60" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isGooglePending}
            className="w-full flex items-center justify-center gap-2.5 border border-silver rounded-lg py-2.5 text-sm text-quartz disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.61z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {t('ctaGoogle')}
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
