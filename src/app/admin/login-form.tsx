'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestAdminMagicLink } from './actions';

function AdminLogo() {
  // Dos vueltas de "más grande" (PR #90: lg:h-14: PR #95: h-12/lg:h-16) no
  // resolvían el problema real — el logo técnicamente ya era más grande en
  // píxeles que el de landing-form.tsx, pero seguía sintiéndose "perdido"
  // por el espacio vacío alrededor de esta tarjeta centrada sola. Reynoso
  // pidió, en cambio, un punto de referencia concreto: el mismo tamaño que
  // el logo de acceso de empleados ((employee)/acceso/landing-form.tsx),
  // que tampoco varía por breakpoint (h-8, medido con Playwright: 32px de
  // alto ahí vs 48px que tenía este acá). Se iguala a h-8 sin variante de
  // escritorio, en vez de seguir escalando por separado.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- viene de un endpoint propio, no de un dominio externo optimizable
    <img src="/api/branding/logo" alt="Caudall" className="h-8 mx-auto mb-4 mix-blend-multiply" />
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
