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
    socialComparisonEnabled: boolean;
    socialComparisonMinN: number;
    socialComparisonMinNRRHH: number;
    socialComparisonSuperiorCutoff: number;
    socialComparisonInferiorCutoff: number;
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
  const [socialComparisonEnabled, setSocialComparisonEnabled] = useState(initial.socialComparisonEnabled);
  const [socialComparisonMinN, setSocialComparisonMinN] = useState(String(initial.socialComparisonMinN));
  const [socialComparisonMinNRRHH, setSocialComparisonMinNRRHH] = useState(String(initial.socialComparisonMinNRRHH));
  const [socialComparisonSuperiorCutoff, setSocialComparisonSuperiorCutoff] = useState(
    String(initial.socialComparisonSuperiorCutoff)
  );
  const [socialComparisonInferiorCutoff, setSocialComparisonInferiorCutoff] = useState(
    String(initial.socialComparisonInferiorCutoff)
  );
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
        progressTierHighCutoff,
        socialComparisonEnabled,
        socialComparisonMinN,
        socialComparisonMinNRRHH,
        socialComparisonSuperiorCutoff,
        socialComparisonInferiorCutoff
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

      {/* 2 columnas por sección (no una columna angosta) — mismo criterio
          que ParametersForm de Configuración. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 mb-1">
        <div>
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
        </div>

        <div>
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
        </div>

        <div>
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
          <p className="text-[11px] text-nickel mb-3">{labels.stopHardMaxHelp}</p>
        </div>

        <div>
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
          <p className="text-[11px] text-nickel mb-3">{labels.progressTargetHelp}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-quartz mb-3">{labels.thresholdSectionTitle}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 mb-1">
        <div>
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
        </div>

        <div>
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
          <p className="text-[11px] text-nickel mb-3">{labels.highValueThresholdSoftHelp}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-quartz mb-3">{labels.tierSectionTitle}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 mb-1">
        <div>
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
        </div>

        <div>
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
          <p className="text-[11px] text-nickel mb-3">{labels.progressTierHighCutoffHelp}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-quartz mb-3">{labels.socialComparisonSectionTitle}</p>

      <div className="mb-3">
        <label htmlFor="socialComparisonEnabled" className="flex items-center gap-2 text-xs text-nickel mb-1">
          <input
            id="socialComparisonEnabled"
            type="checkbox"
            checked={socialComparisonEnabled}
            onChange={(event) => setSocialComparisonEnabled(event.target.checked)}
          />
          {labels.socialComparisonEnabledLabel}
        </label>
        <p className="text-[11px] text-nickel">{labels.socialComparisonEnabledHelp}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 mb-1">
        <div>
          <label htmlFor="socialComparisonMinN" className="block text-xs text-nickel mb-1">
            {labels.socialComparisonMinNLabel}
          </label>
          <input
            id="socialComparisonMinN"
            type="number"
            min={1}
            max={10000}
            value={socialComparisonMinN}
            onChange={(event) => setSocialComparisonMinN(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
          />
          <p className="text-[11px] text-nickel mb-3">{labels.socialComparisonMinNHelp}</p>
        </div>

        <div>
          <label htmlFor="socialComparisonMinNRRHH" className="block text-xs text-nickel mb-1">
            {labels.socialComparisonMinNRRHHLabel}
          </label>
          <input
            id="socialComparisonMinNRRHH"
            type="number"
            min={1}
            max={10000}
            value={socialComparisonMinNRRHH}
            onChange={(event) => setSocialComparisonMinNRRHH(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
          />
          <p className="text-[11px] text-nickel mb-3">{labels.socialComparisonMinNRRHHHelp}</p>
        </div>

        <div>
          <label htmlFor="socialComparisonSuperiorCutoff" className="block text-xs text-nickel mb-1">
            {labels.socialComparisonSuperiorCutoffLabel}
          </label>
          <input
            id="socialComparisonSuperiorCutoff"
            type="number"
            min={0}
            max={100}
            value={socialComparisonSuperiorCutoff}
            onChange={(event) => setSocialComparisonSuperiorCutoff(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
          />
          <p className="text-[11px] text-nickel mb-3">{labels.socialComparisonSuperiorCutoffHelp}</p>
        </div>

        <div>
          <label htmlFor="socialComparisonInferiorCutoff" className="block text-xs text-nickel mb-1">
            {labels.socialComparisonInferiorCutoffLabel}
          </label>
          <input
            id="socialComparisonInferiorCutoff"
            type="number"
            min={0}
            max={100}
            value={socialComparisonInferiorCutoff}
            onChange={(event) => setSocialComparisonInferiorCutoff(event.target.value)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
          />
          <p className="text-[11px] text-nickel mb-3">{labels.socialComparisonInferiorCutoffHelp}</p>
        </div>
      </div>

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.saveSuccess}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full lg:w-auto lg:px-8 bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.saving : labels.saveCta}
      </button>
    </form>
  );
}
