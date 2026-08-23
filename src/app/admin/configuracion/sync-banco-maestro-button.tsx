'use client';

import { useState, useTransition } from 'react';
import { syncBancoMaestroContent } from './actions';
import type { SyncBancoMaestroSummary } from '@/lib/seed/sync-banco-maestro';

export function SyncBancoMaestroButton({
  labels
}: {
  labels: {
    title: string;
    description: string;
    cta: string;
    syncing: string;
    confirm: string;
    resultActive: string;
    resultDraft: string;
    resultConstructs: string;
    resultVariables: string;
    error: string;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<SyncBancoMaestroSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(labels.confirm)) return;
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const result = await syncBancoMaestroContent();
      if (!result.ok) {
        setError(labels.error);
        return;
      }
      setSummary(result.summary);
    });
  }

  return (
    <div className="bg-white border border-silver/60 rounded-xl p-6 mt-4">
      <h2 className="text-sm font-medium text-quartz mb-1">{labels.title}</h2>
      <p className="text-xs text-nickel mb-4">{labels.description}</p>

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="bg-yale text-white rounded-lg py-2 px-4 text-sm disabled:opacity-60"
      >
        {isPending ? labels.syncing : labels.cta}
      </button>

      {error ? <p className="text-xs text-bad mt-3">{error}</p> : null}

      {summary ? (
        <div className="text-xs text-nickel mt-3 space-y-0.5">
          <p>
            {labels.resultConstructs}: {summary.constructs} · {labels.resultVariables}: {summary.variables}
          </p>
          <p>
            {labels.resultActive}: {summary.questionsActive} · {labels.resultDraft}: {summary.questionsDraft}
          </p>
        </div>
      ) : null}
    </div>
  );
}
