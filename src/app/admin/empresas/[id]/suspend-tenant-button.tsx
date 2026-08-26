'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setTenantSuspended } from '../actions';

export function SuspendTenantButton({
  tenantId,
  suspended,
  labels
}: {
  tenantId: string;
  suspended: boolean;
  labels: { suspendCta: string; reactivateCta: string; confirmSuspend: string };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!suspended && !window.confirm(labels.confirmSuspend)) return;

    startTransition(async () => {
      const result = await setTenantSuspended({ tenantId, suspended: !suspended });
      if (!result.ok) {
        window.alert(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        suspended
          ? 'text-xs bg-ok/10 text-ok rounded-lg px-3 py-1.5 disabled:opacity-60'
          : 'text-xs bg-bad/10 text-bad rounded-lg px-3 py-1.5 disabled:opacity-60'
      }
    >
      {suspended ? labels.reactivateCta : labels.suspendCta}
    </button>
  );
}
