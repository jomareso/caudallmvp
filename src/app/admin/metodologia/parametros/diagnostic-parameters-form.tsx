'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateDiagnosticParameters } from './actions';

export function DiagnosticParametersForm({
  initial,
  labels
}: {
  initial: {
    stopFloor: number;
    stopSoftMax: number;
    stopHardMax: number;
    highValueThreshold: number;
    highValueThresholdSoft: number;
    progressTarget: number;
    progressTierMidCutoff: number;
    progressTierHighCutoff: number;
  };
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [stopFloor, setStopFloor] = useState(String(initial.stopFloor));
  const [stopSoftMax, setStopSoftMax] = useState(String(initial.stopSoftMax));
  const [stopHardMax, setStopHardMax] = useState(String(initial.stopHardMax));
  const [highValueThreshold, setHighValueThreshold] = useState(String(initial.highValueThreshold));
  const [highValueThresholdSoft, setHighValueThresholdSoft] = useState(String(initial.highValueThresholdSoft));
  const [progressTarget, setProgressTarget] = useState(String(initial.progressTarget));
  const [progressTierMidCutoff, setProgressTierMidCutoff] = useState(String(initial.progressTierMidCutoff));
  const [progressTierHighCutoff, setProgressTierHighCutoff] = useState(String(initial.progressTierHighCutoff));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateDiagnosticParameters({
        stopFloor,
        stopSoftMax,
        stopHardMax,
        highValueThreshold,
        highValueThresholdSoft,
        progressTarget,
        progressTierMidCutoff,
        progressTierHighCutoff
      });
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
      <p className="text-sm font-medium text-quartz mb-3">{labels.stopSectionTitle}</p>

      <label htmlFor="stopFloor" className="block text-xs text-nickel mb-1">
        {labels.stopFloorLabel}
      </label>
      <input
        id="stopFloor"
        type="number"
        min={1}
        max={200}
        value={stopFloor}
        onChange={(event) => setStopFloor(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.stopFloorHelp}</p>

      <label htmlFor="stopSoftMax" className="block text-xs text-nickel mb-1">
        {labels.stopSoftMaxLabel}
      </label>
      <input
        id="stopSoftMax"
        type="number"
        min={1}
        max={200}
        value={stopSoftMax}
        onChange={(event) => setStopSoftMax(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.stopSoftMaxHelp}</p>

      <label htmlFor="stopHardMax" className="block text-xs text-nickel mb-1">
        {labels.stopHardMaxLabel}
      </label>
      <input
        id="stopHardMax"
        type="number"
        min={1}
        max={200}
        value={stopHardMax}
        onChange={(event) => setStopHardMax(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-4">{labels.stopHardMaxHelp}</p>

      <label htmlFor="progressTarget" className="block text-xs text-nickel mb-1">
        {labels.progressTargetLabel}
      </label>
      <input
        id="progressTarget"
        type="number"
        min={1}
        max={200}
        value={progressTarget}
        onChange={(event) => setProgressTarget(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-4">{labels.progressTargetHelp}</p>

      <p className="text-sm font-medium text-quartz mb-3">{labels.thresholdSectionTitle}</p>

      <label htmlFor="highValueThreshold" className="block text-xs text-nickel mb-1">
        {labels.highValueThresholdLabel}
      </label>
      <input
        id="highValueThreshold"
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={highValueThreshold}
        onChange={(event) => setHighValueThreshold(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.highValueThresholdHelp}</p>

      <label htmlFor="highValueThresholdSoft" className="block text-xs text-nickel mb-1">
        {labels.highValueThresholdSoftLabel}
      </label>
      <input
        id="highValueThresholdSoft"
        type="number"
        min={0}
        max={1}
        step={0.01}
        value={highValueThresholdSoft}
        onChange={(event) => setHighValueThresholdSoft(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-4">{labels.highValueThresholdSoftHelp}</p>

      <p className="text-sm font-medium text-quartz mb-3">{labels.tierSectionTitle}</p>

      <label htmlFor="progressTierMidCutoff" className="block text-xs text-nickel mb-1">
        {labels.progressTierMidCutoffLabel}
      </label>
      <input
        id="progressTierMidCutoff"
        type="number"
        min={0}
        max={100}
        value={progressTierMidCutoff}
        onChange={(event) => setProgressTierMidCutoff(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.progressTierMidCutoffHelp}</p>

      <label htmlFor="progressTierHighCutoff" className="block text-xs text-nickel mb-1">
        {labels.progressTierHighCutoffLabel}
      </label>
      <input
        id="progressTierHighCutoff"
        type="number"
        min={0}
        max={100}
        value={progressTierHighCutoff}
        onChange={(event) => setProgressTierHighCutoff(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-4">{labels.progressTierHighCutoffHelp}</p>

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.saveSuccess}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.saving : labels.saveCta}
      </button>
    </form>
  );
}
