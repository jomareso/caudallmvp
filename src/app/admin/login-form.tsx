'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestAdminMagicLink } from './actions';

function AdminLogo() {
  // Mismo logo que AdminLayout muestra una vez logueado — h-14 tiene que
  // calzar con el h-14 de ahí: es el mismo logo, mostrado en el mismo rol
  // de "marca de entrada", solo que antes de loguearse en vez de después.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
    <img src="/api/branding/logo" alt="Caudall" className="h-14 mx-auto mb-3 mix-blend-multiply" />
  );
}

export function AdminLoginForm() {
  const t = useTranslations('admin.login');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await requestAdminMagicLink(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <AdminLogo />
          <h2 className="text-lg font-medium text-quartz mb-2">{t('sentTitle')}</h2>
          <p className="text-sm text-nickel">{t('sentBody')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <AdminLogo />
        <p className="text-nickel text-sm mb-8">{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
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
        </form>
      </div>
    </main>
  );
}
