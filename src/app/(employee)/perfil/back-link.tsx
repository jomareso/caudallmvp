'use client';

import { useRouter } from 'next/navigation';

// router.back() en vez de un href fijo: Configuración se abre desde
// varias pantallas (resultado, acción, inicio) y no hay una sola
// "pantalla anterior" correcta para todas — el historial del navegador ya
// lo sabe.
export function BackLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className="text-xs text-yale underline">
      ← {label}
    </button>
  );
}
