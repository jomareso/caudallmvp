'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

// Error boundary de Next.js App Router — antes de este archivo, CUALQUIER
// excepción no capturada en cualquier página (un fallo de red al llamar un
// Server Action, un bug, lo que sea) mostraba la pantalla en blanco por
// defecto de Next.js ("Application error: a client-side exception has
// occurred"), sin ningún texto en español ni forma de recuperarse más que
// recargar a mano. Encontrado en producción: un timeout de red real
// (net::ERR_TIMED_OUT) al pedir el magic link de admin tumbaba toda la
// pantalla en vez de solo fallar ese formulario — no había ningún
// error.tsx en toda la app, así que ni siquiera layout.tsx seguía vivo
// para mostrar algo con marca. Este único archivo cubre cualquier error
// no capturado bajo el layout raíz (no solo /admin).
export default function GlobalErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common.errorPage');

  useEffect(() => {
    // No hay un servicio de error tracking configurado todavía — al menos
    // queda en los logs del navegador en vez de perderse en silencio.
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-medium text-yale mb-1">caudall</h1>
        <p className="text-lg font-medium text-quartz mt-6 mb-2">{t('title')}</p>
        <p className="text-sm text-nickel mb-6">{t('body')}</p>
        <button
          type="button"
          onClick={reset}
          className="w-full bg-yale text-white rounded-lg py-2.5 text-sm mb-3"
        >
          {t('retry')}
        </button>
        <a href="/" className="block text-xs text-nickel underline">
          {t('backHome')}
        </a>
      </div>
    </main>
  );
}
