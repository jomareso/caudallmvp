'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { commitToAction, dismissAction, reportOutcome } from './actions';

type Status = 'SUGGESTED' | 'COMMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';

export function ActionCard({
  employeeInterventionId,
  status,
  title,
  description,
  actionText,
  whyThisStep,
  videoUrl,
  labels
}: {
  employeeInterventionId: string;
  status: Status;
  title: string;
  description: string;
  actionText: string;
  whyThisStep: string | null;
  videoUrl: string | null;
  labels: {
    whyThisStep: string;
    commit: string;
    dismiss: string;
    committedNotice: string;
    didYouDoIt: string;
    achieved: string;
    partial: string;
    notAchieved: string;
    watchVideo: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showWhy, setShowWhy] = useState(false);

  function handleCommit() {
    startTransition(async () => {
      await commitToAction(employeeInterventionId);
      router.refresh();
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissAction(employeeInterventionId);
      router.refresh();
    });
  }

  function handleOutcome(outcome: 'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED') {
    startTransition(async () => {
      await reportOutcome(employeeInterventionId, outcome);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-silver/60 rounded-xl p-6">
      <h1 className="text-base font-medium text-quartz mb-2">{title}</h1>
      <p className="text-sm text-nickel mb-4">{description}</p>

      <div className="bg-picton/10 border border-cola/40 rounded-lg p-3 mb-3">
        <p className="text-sm text-quartz">{actionText}</p>
      </div>

      {videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-yale mb-3 underline"
        >
          {labels.watchVideo}
        </a>
      ) : null}

      {whyThisStep ? (
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="text-xs text-yale mb-3 underline"
        >
          {labels.whyThisStep}
        </button>
      ) : null}
      {showWhy && whyThisStep ? <p className="text-xs text-nickel mb-3">{whyThisStep}</p> : null}

      {status === 'SUGGESTED' ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCommit}
            disabled={isPending}
            className="flex-1 bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
          >
            {labels.commit}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending}
            className="flex-1 border border-silver text-nickel rounded-lg py-2.5 text-sm disabled:opacity-60"
          >
            {labels.dismiss}
          </button>
        </div>
      ) : null}

      {status === 'COMMITTED' || status === 'IN_PROGRESS' ? (
        <div>
          <p className="text-xs text-ok mb-3">{labels.committedNotice}</p>
          <p className="text-sm text-quartz mb-2">{labels.didYouDoIt}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOutcome('ACHIEVED')}
              disabled={isPending}
              className="flex-1 bg-ok text-white rounded-lg py-2 text-xs disabled:opacity-60"
            >
              {labels.achieved}
            </button>
            <button
              type="button"
              onClick={() => handleOutcome('PARTIAL')}
              disabled={isPending}
              className="flex-1 bg-warn text-white rounded-lg py-2 text-xs disabled:opacity-60"
            >
              {labels.partial}
            </button>
            <button
              type="button"
              onClick={() => handleOutcome('NOT_ACHIEVED')}
              disabled={isPending}
              className="flex-1 border border-silver text-nickel rounded-lg py-2 text-xs disabled:opacity-60"
            >
              {labels.notAchieved}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
