'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { commitToAction, dismissAction, reportOutcome } from './actions';
import { PushOptIn } from './push-opt-in';

type Status = 'SUGGESTED' | 'COMMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';

// El contenido debe sentirse parte de Caudall, no un salto a YouTube: se
// incrusta con youtube-nocookie.com (sin cookies de seguimiento) en vez de
// abrir el link en una pestaña nueva. Si la URL no es de YouTube, no hay
// forma segura de incrustarla — cae de vuelta al link externo.
function getYouTubeEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let videoId: string | null = null;
  if (parsed.hostname === 'youtu.be') {
    videoId = parsed.pathname.slice(1);
  } else if (parsed.hostname.endsWith('youtube.com')) {
    if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.slice('/embed/'.length);
    }
  }

  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0` : null;
}

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
    pushEnable: string;
    pushEnabled: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showWhy, setShowWhy] = useState(false);
  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;

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

      {embedUrl ? (
        <div className="mb-3 aspect-video rounded-lg overflow-hidden">
          <iframe
            src={embedUrl}
            title={labels.watchVideo}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : videoUrl ? (
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
          <p className="text-xs text-ok mb-1">{labels.committedNotice}</p>
          <div className="mb-3">
            <PushOptIn labels={{ enable: labels.pushEnable, enabled: labels.pushEnabled }} />
          </div>
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
