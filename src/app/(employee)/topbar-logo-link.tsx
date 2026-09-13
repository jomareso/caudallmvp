'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Doble clic, no un solo click, a propósito: este logo vive en el header
// de las pantallas de diagnóstico (pregunta, contexto, resultado, acción)
// — un solo tap cerca del pulgar podría sacar por accidente a alguien de
// un diagnóstico a medias. Doble clic es una acción deliberada que no se
// dispara sin querer. Enter hace lo mismo desde el teclado (no hay
// equivalente de teclado a "doble click"), para no dejar afuera a quien
// no usa mouse/touch.
export function TopBarLogoLink({ children }: { children: ReactNode }) {
  const router = useRouter();

  function goHome() {
    router.push('/inicio');
  }

  return (
    <div
      role="button"
      tabIndex={0}
      title="Doble clic para ir al inicio"
      onDoubleClick={goHome}
      onKeyDown={(event) => {
        if (event.key === 'Enter') goHome();
      }}
      className="justify-self-center flex items-center gap-2 cursor-pointer select-none"
    >
      {children}
    </div>
  );
}
