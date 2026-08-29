'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateLicenses } from '../actions';

export function GenerateLicensesForm({
  tenantId,
  durationOptions,
  labels
}: {
  tenantId: string;
  durationOptions: { value: number; label: string }[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [licenseCount, setLicenseCount] = useState('10');
  // Mismo default de siempre (la duración más larga): ver create-tenant-form.tsx.
  const [durationMonths, setDurationMonths] = useState(
    String(durationOptions[durationOptions.length - 1]?.value ?? '')
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await generateLicenses({ tenantId, licenseCount, durationMonths });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
      <h2 className="text-sm font-medium text-quartz mb-3">{labels.title}</h2>

      <label htmlFor="licenseCount" className="block text-xs text-nickel mb-1">
        {labels.licenseCountLabel}
      </label>
      <input
        id="licenseCount"
        type="number"
        min={1}
        max={500}
        value={licenseCount}
        onChange={(event) => setLicenseCount(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      <label htmlFor="durationMonths" className="block text-xs text-nickel mb-1">
        {labels.durationLabel}
      </label>
      <select
        id="durationMonths"
        value={durationMonths}
        onChange={(event) => setDurationMonths(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      >
        {durationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.success}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.creating : labels.cta}
      </button>
    </form>
  );
}
