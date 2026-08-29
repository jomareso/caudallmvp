'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCommitmentTrigger } from './actions';

export function CreateTriggerForm({ labels }: { labels: Record<string, string> }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [icon, setIcon] = useState('');
  const [label, setLabel] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await createCommitmentTrigger({ code, icon, label, sortOrder });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      setCode('');
      setIcon('');
      setLabel('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
      <label htmlFor="triggerCode" className="block text-xs text-nickel mb-1">
        {labels.codeLabel}
      </label>
      <input
        id="triggerCode"
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="EJ_DESPUES_DE_ALMORZAR"
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 font-mono focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.codeHelp}</p>

      <label htmlFor="triggerIcon" className="block text-xs text-nickel mb-1">
        {labels.iconLabel}
      </label>
      <input
        id="triggerIcon"
        type="text"
        value={icon}
        onChange={(event) => setIcon(event.target.value)}
        placeholder="🎯"
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      <label htmlFor="triggerLabel" className="block text-xs text-nickel mb-1">
        {labels.labelLabel}
      </label>
      <input
        id="triggerLabel"
        type="text"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      <label htmlFor="triggerSortOrder" className="block text-xs text-nickel mb-1">
        {labels.sortOrderLabel}
      </label>
      <input
        id="triggerSortOrder"
        type="number"
        min={0}
        max={1000}
        value={sortOrder}
        onChange={(event) => setSortOrder(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.createSuccess}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.creating : labels.createCta}
      </button>
    </form>
  );
}
