'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { commitToAction, dismissAction, reportOutcome } from './actions';
import { PushOptIn } from './push-opt-in';
import {
  COMMITMENT_TRIGGERS,
  COMMITMENT_TRIGGER_ICON,
  DIMENSION_ICON,
  DEFAULT_DIMENSION_ICON,
  type CommitmentTrigger
} from '@/lib/engines/commitment-triggers';
import { OUTCOME_REASONS, type OutcomeReason } from '@/lib/engines/outcome-reasons';

type Status = 'SUGGESTED' | 'COMMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';

// Ver comentario en el bloque de video más abajo.
const SHOW_INTERVENTION_VIDEOS = false;

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

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function ActionCard({
  employeeInterventionId,
  status,
  dimensionCode,
  title,
  description,
  actionText,
  whyThisStep,
  videoUrl,
  committedWith,
  labels
}: {
  employeeInterventionId: string;
  status: Status;
  dimensionCode: string;
  title: string;
  description: string;
  actionText: string;
  whyThisStep: string | null;
  videoUrl: string | null;
  // Ya formateado server-side (next-intl + Intl.DateTimeFormat) — ver
  // page.tsx. Null si todavía no hay compromiso registrado.
  committedWith: string | null;
  labels: {
    whyThisStep: string;
    commit: string;
    dismiss: string;
    committedNotice: string;
    commitStepIntro: string;
    commitStepTriggerPrompt: string;
    commitStepDatePrompt: string;
    commitStepConfirm: string;
    commitStepCancel: string;
    triggers: Record<CommitmentTrigger, string>;
    didYouDoIt: string;
    achieved: string;
    partial: string;
    notAchieved: string;
    outcomeReasonPrompt: string;
    outcomeReasonBack: string;
    outcomeReasons: Record<OutcomeReason, string>;
    watchVideo: string;
    pushEnable: string;
    pushEnabled: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showWhy, setShowWhy] = useState(false);
  // spec-v2.md §30 (COMMITMENT): TRIGGER + DATE se piden ANTES de marcar el
  // compromiso como tal — "Me comprometo" ya no cierra el ciclo de un
  // click, abre este segundo paso (implementation intention: spec §28,
  // PROCRASTINATION → Implementation intention — un compromiso con un
  // disparador y una fecha concretos se cumple más que uno genérico).
  const [committing, setCommitting] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<CommitmentTrigger | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [commitError, setCommitError] = useState<string | null>(null);
  // "En parte" / "Todavía no" son las dos fricciones reales que vale la
  // pena entender (regla CORE 19: FRICTION → TECHNIQUE) — "Sí, lo hice" no
  // tiene nada que explicar, así que dispara directo sin pasar por acá.
  const [pendingOutcome, setPendingOutcome] = useState<'PARTIAL' | 'NOT_ACHIEVED' | null>(null);
  const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
  const dimensionIcon = DIMENSION_ICON[dimensionCode] ?? DEFAULT_DIMENSION_ICON;

  function handleConfirmCommit() {
    if (!selectedTrigger || !selectedDate) return;
    setCommitError(null);
    startTransition(async () => {
      const result = await commitToAction(employeeInterventionId, selectedTrigger, selectedDate);
      if (!result.ok) {
        setCommitError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissAction(employeeInterventionId);
      router.refresh();
    });
  }

  function handleOutcome(outcome: 'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED', reason?: OutcomeReason) {
    startTransition(async () => {
      await reportOutcome(employeeInterventionId, outcome, reason);
      router.refresh();
    });
  }

  function handleOutcomeClick(outcome: 'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED') {
    if (outcome === 'ACHIEVED') {
      handleOutcome(outcome);
      return;
    }
    setPendingOutcome(outcome);
  }

  return (
    <div className="bg-white border border-silver/60 rounded-xl p-6">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xl leading-none" aria-hidden="true">
          {dimensionIcon}
        </span>
        <h1 className="text-base font-medium text-quartz">{title}</h1>
      </div>
      <p className="text-sm text-nickel mb-4">{description}</p>

      <div className="bg-picton/10 border border-cola/40 rounded-lg p-3 mb-3">
        <p className="text-sm text-quartz">{actionText}</p>
      </div>

      {/* SHOW_INTERVENTION_VIDEOS en false (decisión de Reynoso, 28 ago):
          los videoUrl cargados en el catálogo de intervenciones son
          placeholders de terceros (ej. un webinar externo), no contenido
          de marca propio — se oculta el video hasta que existan videos
          reales, sin tocar los datos guardados. Para reactivarlo, cambiar
          esta constante a true. */}
      {SHOW_INTERVENTION_VIDEOS && embedUrl ? (
        <div className="mb-3 aspect-video rounded-lg overflow-hidden">
          <iframe
            src={embedUrl}
            title={labels.watchVideo}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : SHOW_INTERVENTION_VIDEOS && videoUrl ? (
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

      {status === 'SUGGESTED' && !committing ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCommitting(true)}
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

      {status === 'SUGGESTED' && committing ? (
        <div className="border border-cola/30 bg-picton/5 rounded-lg p-4">
          <p className="text-xs text-nickel mb-3">{labels.commitStepIntro}</p>

          <p className="text-xs font-medium text-quartz mb-2">{labels.commitStepTriggerPrompt}</p>
          <div className="flex flex-col gap-1.5 mb-4">
            {COMMITMENT_TRIGGERS.map((trigger) => (
              <button
                key={trigger}
                type="button"
                onClick={() => setSelectedTrigger(trigger)}
                aria-pressed={selectedTrigger === trigger}
                className={`flex items-center gap-2 text-left text-xs rounded-lg border px-3 py-2 transition-colors ${
                  selectedTrigger === trigger
                    ? 'border-yale bg-yale/5 text-yale font-medium'
                    : 'border-silver/60 text-quartz'
                }`}
              >
                <span aria-hidden="true">{COMMITMENT_TRIGGER_ICON[trigger]}</span>
                {labels.triggers[trigger]}
              </button>
            ))}
          </div>

          <label className="block text-xs font-medium text-quartz mb-2" htmlFor={`commit-date-${employeeInterventionId}`}>
            {labels.commitStepDatePrompt}
          </label>
          <input
            id={`commit-date-${employeeInterventionId}`}
            type="date"
            min={todayISODate()}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2 text-sm text-quartz mb-4"
          />

          {commitError ? <p className="text-xs text-bad mb-3">{commitError}</p> : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmCommit}
              disabled={isPending || !selectedTrigger || !selectedDate}
              className="flex-1 bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-40"
            >
              {labels.commitStepConfirm}
            </button>
            <button
              type="button"
              onClick={() => setCommitting(false)}
              disabled={isPending}
              className="text-xs text-nickel underline disabled:opacity-60"
            >
              {labels.commitStepCancel}
            </button>
          </div>
        </div>
      ) : null}

      {status === 'COMMITTED' || status === 'IN_PROGRESS' ? (
        <div>
          <p className="text-xs text-ok mb-1">{committedWith ?? labels.committedNotice}</p>
          <div className="mb-3">
            <PushOptIn labels={{ enable: labels.pushEnable, enabled: labels.pushEnabled }} />
          </div>
          {pendingOutcome ? (
            <div>
              <p className="text-sm text-quartz mb-2">{labels.outcomeReasonPrompt}</p>
              <div className="flex flex-col gap-1.5 mb-2">
                {OUTCOME_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => handleOutcome(pendingOutcome, reason)}
                    disabled={isPending}
                    className="text-left text-xs rounded-lg border border-silver/60 text-quartz px-3 py-2 disabled:opacity-60"
                  >
                    {labels.outcomeReasons[reason]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingOutcome(null)}
                disabled={isPending}
                className="text-xs text-nickel underline disabled:opacity-60"
              >
                {labels.outcomeReasonBack}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-quartz mb-2">{labels.didYouDoIt}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOutcomeClick('ACHIEVED')}
                  disabled={isPending}
                  className="flex-1 bg-yale text-white rounded-lg py-2 text-xs disabled:opacity-60"
                >
                  {labels.achieved}
                </button>
                <button
                  type="button"
                  onClick={() => handleOutcomeClick('PARTIAL')}
                  disabled={isPending}
                  className="flex-1 border border-yale text-yale rounded-lg py-2 text-xs disabled:opacity-60"
                >
                  {labels.partial}
                </button>
                <button
                  type="button"
                  onClick={() => handleOutcomeClick('NOT_ACHIEVED')}
                  disabled={isPending}
                  className="flex-1 border border-silver text-nickel rounded-lg py-2 text-xs disabled:opacity-60"
                >
                  {labels.notAchieved}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
