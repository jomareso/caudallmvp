'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestAdminMagicLink } from './actions';

function AdminLogo() {
  // El h-8 original venía de copiar el tamaño de BrandPanel/landing-form.tsx
  // — pero ahí funciona porque esas pantallas son de borde a borde (panel de
  // marca + formulario llenando todo el viewport). Esta pantalla de admin
  // SIEMPRE es una tarjeta angosta centrada sola en un fondo vacío — en
  // escritorio (PR #90, lg:h-14) y también en un teléfono real, donde el
  // alto de pantalla sobra igual de vacío arriba y abajo de la tarjeta
  // (segundo reporte de Reynoso, esta vez desde el celular). Se sube el
  // tamaño base a h-12 y el de escritorio a h-16, subiendo ambos un
  // escalón — el problema nunca fue el breakpoint, fue este layout
  // específico en cualquier tamaño de pantalla.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
    <img src="/api/branding/logo" alt="Caudall" className="h-12 lg:h-16 mx-auto mb-4 mix-blend-multiply" />
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
        {/* max-w-lg, text-3xl/text-lg (no max-w-sm, text-lg/text-sm): esta
            pantalla es una tarjeta sola, centrada en toda la altura de la
            ventana, sin nada más al lado — en un monitor de escritorio le
            sobraba espacio en blanco alrededor de un mensaje chico. */}
        <div className="w-full max-w-lg text-center">
          <AdminLogo />
          <h2 className="text-3xl font-medium text-quartz mb-3">{t('sentTitle')}</h2>
          <p className="text-lg text-nickel">{t('sentBody')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <AdminLogo />
        <p className="text-nickel text-lg mb-8">{t('subtitle')}</p>

        <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
          <label htmlFor="email" className="block text-sm text-nickel mb-1">
            {t('emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-base text-quartz mb-3 focus:outline-none focus:border-cola"
          />

          {error ? <p className="text-sm text-bad mb-3">{error}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-yale text-white rounded-lg py-2.5 text-base disabled:opacity-60"
          >
            {isPending ? t('sending') : t('ctaSendLink')}
          </button>
        </form>
      </div>
    </main>
  );
}
