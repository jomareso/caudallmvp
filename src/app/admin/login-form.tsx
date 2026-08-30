'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestAdminMagicLink } from './actions';

function AdminLogo() {
  // h-10: un poco más grande que el logo "de marca de entrada" del resto
  // del producto (h-8 en BrandPanel/landing-form.tsx) — esta pantalla es
  // una tarjeta corta centrada sola en toda la altura de la ventana, así
  // que le sobra espacio en blanco alrededor en cualquier monitor de
  // escritorio (mismo criterio que el resto de las pantallas de
  // confirmación de un solo mensaje, ver registro/enviado y afines).
  return (
    // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
    <img src="/api/branding/logo" alt="Caudall" className="h-10 mx-auto mb-4 mix-blend-multiply" />
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
        {/* max-w-md, text-2xl/text-base (no max-w-sm, text-lg/text-sm): esta
            pantalla es una tarjeta sola, centrada en toda la altura de la
            ventana, sin nada más al lado — en un monitor de escritorio le
            sobraba espacio en blanco alrededor de un mensaje chico. */}
        <div className="w-full max-w-md text-center">
          <AdminLogo />
          <h2 className="text-2xl font-medium text-quartz mb-3">{t('sentTitle')}</h2>
          <p className="text-base text-nickel">{t('sentBody')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <AdminLogo />
        <p className="text-nickel text-base mb-8">{t('subtitle')}</p>

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
