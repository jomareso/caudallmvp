'use client';

import { useTransition } from 'react';
import { logoutAdmin } from './actions';

export function LogoutButton({ label }: { label: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => logoutAdmin())}
      disabled={isPending}
      className="text-xs text-nickel hover:text-yale disabled:opacity-60"
    >
      {label}
    </button>
  );
}
