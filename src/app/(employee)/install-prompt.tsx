'use client';

import { useEffect, useState } from 'react';

// Decisión 9 (CLAUDE.md): "prompt de instalación" — el service worker y las
// notificaciones push (ver push-opt-in.tsx) ya existían, pero nada ofrecía
// instalar la PWA. `beforeinstallprompt` es el único gancho estándar (Chrome/
// Edge/Android) para esto — Safari/iOS no lo dispara nunca (solo soporta
// "Compartir → Agregar a inicio" manual), así que ahí este componente
// simplemente no muestra nada, en vez de instrucciones que no aplican al resto
// de navegadores.
const DISMISSED_KEY = 'caudall:installPromptDismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone === true;
}

export function InstallPrompt({ labels }: { labels: { title: string; body: string; install: string; dismiss: string } }) {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY) === '1') return;

    function handleBeforeInstallPrompt(event: Event) {
      // El navegador muestra su propio mini-infobar a menos que se llame
      // preventDefault() — se difiere a propósito para controlar el
      // momento y el copy (mismo patrón que push-opt-in.tsx).
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    // El evento solo puede usarse una vez (API del navegador) — se descarta
    // sin importar la elección del usuario; si acepta, isStandalone() lo
    // ocultará en la próxima carga igual.
    await deferredEvent.userChoice;
    setDeferredEvent(null);
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  if (!visible || !deferredEvent) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4">
      <div className="max-w-sm mx-auto bg-yale text-white rounded-xl shadow-lg p-4 flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium mb-0.5">{labels.title}</p>
          <p className="text-xs text-white/80 mb-3">{labels.body}</p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleInstall} className="text-xs font-semibold bg-white text-yale rounded-lg px-3 py-1.5">
              {labels.install}
            </button>
            <button type="button" onClick={handleDismiss} className="text-xs text-white/80 underline">
              {labels.dismiss}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
