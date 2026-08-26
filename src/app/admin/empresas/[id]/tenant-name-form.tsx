'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTenant } from '../actions';

export function TenantNameForm({
  tenantId,
  initialName,
  labels
}: {
  tenantId: string;
  initialName: string;
  labels: { nameLabel: string; cta: string; saving: string; errorGeneric: string };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateTenant({ tenantId, name });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 mb-1">
      <div className="flex-1">
        <label htmlFor="tenantName" className="block text-xs text-nickel mb-1">
          {labels.nameLabel}
        </label>
        <input
          id="tenantName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full border border-silver rounded-lg px-3 py-2 text-sm text-quartz focus:outline-none focus:border-cola"
        />
      </div>
      <button
        type="submit"
        disabled={isPending || name.trim().length === 0}
        className="bg-yale text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60"
      >
        {isPending ? labels.saving : labels.cta}
      </button>
      {error ? <p className="text-xs text-bad">{error}</p> : null}
    </form>
  );
}
