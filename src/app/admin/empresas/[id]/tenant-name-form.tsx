'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTenant } from '../actions';

export function TenantNameForm({
  tenantId,
  initialName,
  initialEmployeeCount,
  // Ya interpolado server-side (page.tsx, con t('requiredSampleSizeLabel',
  // {n, total}) — ver sample-size.ts para el cálculo) — null cuando
  // todavía no hay employeeCount cargado. Se recalcula solo al recargar la
  // página (router.refresh() tras guardar), no en cada tecla del input.
  requiredSampleSizeText,
  labels
}: {
  tenantId: string;
  initialName: string;
  initialEmployeeCount: number | null;
  requiredSampleSizeText: string | null;
  labels: {
    nameLabel: string;
    employeeCountLabel: string;
    employeeCountPlaceholder: string;
    employeeCountHelp: string;
    cta: string;
    saving: string;
    errorGeneric: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [employeeCount, setEmployeeCount] = useState(initialEmployeeCount ? String(initialEmployeeCount) : '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateTenant({ tenantId, name, employeeCount });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mb-1">
      <label htmlFor="tenantName" className="block text-xs text-nickel mb-1">
        {labels.nameLabel}
      </label>
      <input
        id="tenantName"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      <label htmlFor="tenantEmployeeCount" className="block text-xs text-nickel mb-1">
        {labels.employeeCountLabel}
      </label>
      <input
        id="tenantEmployeeCount"
        type="number"
        min={1}
        max={1000000}
        value={employeeCount}
        onChange={(event) => setEmployeeCount(event.target.value)}
        placeholder={labels.employeeCountPlaceholder}
        className="w-full border border-silver rounded-lg px-3 py-2 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.employeeCountHelp}</p>

      {requiredSampleSizeText ? (
        <p className="text-xs text-yale bg-picton/10 rounded-lg px-3 py-2 mb-3">{requiredSampleSizeText}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || name.trim().length === 0}
        className="w-full bg-yale text-white rounded-lg py-2 text-sm disabled:opacity-60"
      >
        {isPending ? labels.saving : labels.cta}
      </button>
      {error ? <p className="text-xs text-bad mt-2">{error}</p> : null}
    </form>
  );
}
