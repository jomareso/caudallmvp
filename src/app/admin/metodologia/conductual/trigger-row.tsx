'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCommitmentTrigger, setCommitmentTriggerEnabled } from './actions';

export function TriggerRow({
  trigger,
  labels
}: {
  trigger: { id: string; code: string; icon: string; label: string; sortOrder: number; enabled: boolean };
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [icon, setIcon] = useState(trigger.icon);
  const [label, setLabel] = useState(trigger.label);
  const [sortOrder, setSortOrder] = useState(String(trigger.sortOrder));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateCommitmentTrigger({ id: trigger.id, icon, label, sortOrder });
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
      const result = await setCommitmentTriggerEnabled({ id: trigger.id, enabled: !trigger.enabled });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="bg-white border border-cola rounded-lg p-3 text-xs space-y-2">
        <p className="text-quartz font-medium font-mono">{trigger.code}</p>
        <input
          value={icon}
          onChange={(event) => setIcon(event.target.value)}
          className="w-full border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
        />
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className="w-full border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
        />
        <input
          type="number"
          min={0}
          max={1000}
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
          className="w-full border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
        />

        {error ? <p className="text-bad">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="bg-yale text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
            {isPending ? labels.saving : labels.saveCta}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-nickel px-3 py-1.5">
            {labels.cancelCta}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white border border-silver/60 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-quartz font-medium">
            <span aria-hidden="true">{trigger.icon}</span> {trigger.label}
            <span
              className={
                trigger.enabled
                  ? 'ml-2 text-[10px] bg-ok/15 text-ok rounded px-1.5 py-0.5 align-middle'
                  : 'ml-2 text-[10px] bg-silver/40 text-nickel rounded px-1.5 py-0.5 align-middle'
              }
            >
              {trigger.enabled ? labels.enabledBadge : labels.disabledBadge}
            </span>
          </p>
          <p className="text-nickel font-mono">{trigger.code}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="text-cola">
            {labels.editCta}
          </button>
          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={isPending}
            className={trigger.enabled ? 'text-bad disabled:opacity-60' : 'text-ok disabled:opacity-60'}
          >
            {trigger.enabled ? labels.deactivateCta : labels.activateCta}
          </button>
        </div>
      </div>
      {error ? <p className="text-bad mt-1">{error}</p> : null}
    </div>
  );
}
