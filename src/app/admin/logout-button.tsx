'use client';

import { useTransition } from 'react';
import { logoutAdmin } from './actions';

export function LogoutButton({
  label,
  className = 'text-xs text-nickel hover:text-yale disabled:opacity-60'
}: {
  label: string;
  // Permite overridear el estilo por completo (ej. AdminSidebar, sobre
  // fondo oscuro, necesita texto claro en vez de nickel/yale) sin
  // duplicar este componente solo por color.
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => logoutAdmin())}
      disabled={isPending}
      className={className}
    >
      {label}
    </button>
  );
}
