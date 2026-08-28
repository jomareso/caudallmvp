'use client';

import { useTransition } from 'react';
import { logout } from './actions';

export function LogoutButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => logout())}
      className="text-xs text-bad underline disabled:opacity-60"
    >
      {label}
    </button>
  );
}
