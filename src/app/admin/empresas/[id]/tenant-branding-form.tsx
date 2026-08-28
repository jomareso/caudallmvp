'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTenantBranding } from '../actions';

export function TenantBrandingForm({
  tenantId,
  initialPrimaryColor,
  initialLogoUrl,
  labels
}: {
  tenantId: string;
  initialPrimaryColor: string;
  initialLogoUrl: string | null;
  labels: {
    title: string;
    colorLabel: string;
    logoLabel: string;
    logoPlaceholder: string;
    cta: string;
    saving: string;
    errorGeneric: string;
  };
}) {
  const router = useRouter();
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isValidColor = /^#[0-9a-fA-F]{6}$/.test(primaryColor);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateTenantBranding({ tenantId, primaryColor, logoUrl });
      if (!result.ok) {
        setError(result.message ?? labels.errorGeneric);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-4 mb-6">
      <p className="text-sm font-medium text-quartz mb-3">{labels.title}</p>

      <label htmlFor="primaryColor" className="block text-xs text-nickel mb-1">
        {labels.colorLabel}
      </label>
      <div className="flex items-center gap-2 mb-3">
        <input
          id="primaryColor"
          type="color"
          value={isValidColor ? primaryColor : '#0F5499'}
          onChange={(event) => setPrimaryColor(event.target.value.toUpperCase())}
          className="h-9 w-9 rounded border border-silver p-0.5 shrink-0"
        />
        <input
          value={primaryColor}
          onChange={(event) => setPrimaryColor(event.target.value)}
          placeholder="#0F5499"
          className="flex-1 border border-silver rounded-lg px-3 py-2 text-sm text-quartz font-mono focus:outline-none focus:border-cola"
        />
      </div>

      <label htmlFor="logoUrl" className="block text-xs text-nickel mb-1">
        {labels.logoLabel}
      </label>
      <input
        id="logoUrl"
        value={logoUrl}
        onChange={(event) => setLogoUrl(event.target.value)}
        placeholder={labels.logoPlaceholder}
        className="w-full border border-silver rounded-lg px-3 py-2 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || !isValidColor}
        className="bg-yale text-white rounded-lg px-4 py-2 text-sm disabled:opacity-60"
      >
        {isPending ? labels.saving : labels.cta}
      </button>
    </form>
  );
}
