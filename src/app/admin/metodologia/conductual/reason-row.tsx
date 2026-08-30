'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOutcomeReason, setOutcomeReasonEnabled } from './actions';

export function ReasonRow({
  reason,
  labels
}: {
  reason: { id: string; code: string; label: string; sortOrder: number; enabled: boolean };
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(reason.label);
  const [sortOrder, setSortOrder] = useState(String(reason.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOutcomeReason({ id: reason.id, label, sortOrder });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleToggleEnabled() {
    setError(null);
    startTransition(async () => {
      const result = await setOutcomeReasonEnabled({ id: reason.id, enabled: !reason.enabled });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="bg-white border border-cola rounded-lg p-3 text-xs flex flex-wrap items-center gap-2">
        <p className="text-quartz font-medium font-mono">{reason.code}</p>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="flex-1 min-w-[140px] border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
        />
        <input
          type="number"
          min={0}
          max={1000}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className="w-20 border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
        />

        <div className="flex gap-2 ml-auto">
          <button type="submit" disabled={isPending} className="bg-yale text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
            {isPending ? labels.saving : labels.saveCta}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-nickel px-3 py-1.5">
            {labels.cancelCta}
          </button>
        </div>

        {error ? <p className="basis-full text-bad">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="bg-white border border-silver/60 rounded-lg p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-quartz font-medium">
            {reason.label}
            <span
              className={
                reason.enabled
                  ? 'ml-2 text-[10px] bg-ok/15 text-ok rounded px-1.5 py-0.5 align-middle'
                  : 'ml-2 text-[10px] bg-silver/40 text-nickel rounded px-1.5 py-0.5 align-middle'
              }
            >
              {reason.enabled ? labels.enabledBadge : labels.disabledBadge}
            </span>
          </p>
          <p className="text-nickel font-mono">{reason.code}</p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="text-cola">
            {labels.editCta}
          </button>
          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={isPending}
            className={reason.enabled ? 'text-bad disabled:opacity-60' : 'text-ok disabled:opacity-60'}
          >
            {reason.enabled ? labels.deactivateCta : labels.activateCta}
          </button>
        </div>
      </div>
      {error ? <p className="text-bad mt-1">{error}</p> : null}
    </div>
  );
}
