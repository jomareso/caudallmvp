'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updatePlatformParameters } from './actions';

export function ParametersForm({
  initial,
  labels
}: {
  initial: {
    followupInviteAfterDays: number;
    showInterventionVideos: boolean;
    licenseDurationsMonths: number[];
    minCohortSize: number;
    minSampleSize: number;
    magicLinkTtlMinutes: number;
  };
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [followupInviteAfterDays, setFollowupInviteAfterDays] = useState(String(initial.followupInviteAfterDays));
  const [showInterventionVideos, setShowInterventionVideos] = useState(initial.showInterventionVideos);
  const [licenseDurationsMonths, setLicenseDurationsMonths] = useState(initial.licenseDurationsMonths.join(', '));
  const [minCohortSize, setMinCohortSize] = useState(String(initial.minCohortSize));
  const [minSampleSize, setMinSampleSize] = useState(String(initial.minSampleSize));
  const [magicLinkTtlMinutes, setMagicLinkTtlMinutes] = useState(String(initial.magicLinkTtlMinutes));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updatePlatformParameters({
        followupInviteAfterDays,
        showInterventionVideos,
        licenseDurationsMonths,
        minCohortSize,
        minSampleSize,
        magicLinkTtlMinutes
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
      <label htmlFor="followupInviteAfterDays" className="block text-xs text-nickel mb-1">
        {labels.followupInviteAfterDaysLabel}
      </label>
      <input
        id="followupInviteAfterDays"
        type="number"
        min={1}
        max={3650}
        value={followupInviteAfterDays}
        onChange={(event) => setFollowupInviteAfterDays(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.followupInviteAfterDaysHelp}</p>

      <label htmlFor="licenseDurationsMonths" className="block text-xs text-nickel mb-1">
        {labels.licenseDurationsMonthsLabel}
      </label>
      <input
        id="licenseDurationsMonths"
        type="text"
        value={licenseDurationsMonths}
        onChange={(event) => setLicenseDurationsMonths(event.target.value)}
        placeholder="3, 6, 12"
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.licenseDurationsMonthsHelp}</p>

      <label htmlFor="minCohortSize" className="block text-xs text-nickel mb-1">
        {labels.minCohortSizeLabel}
      </label>
      <input
        id="minCohortSize"
        type="number"
        min={1}
        max={10000}
        value={minCohortSize}
        onChange={(event) => setMinCohortSize(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.minCohortSizeHelp}</p>

      <label htmlFor="minSampleSize" className="block text-xs text-nickel mb-1">
        {labels.minSampleSizeLabel}
      </label>
      <input
        id="minSampleSize"
        type="number"
        min={1}
        max={10000}
        value={minSampleSize}
        onChange={(event) => setMinSampleSize(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.minSampleSizeHelp}</p>

      <label htmlFor="magicLinkTtlMinutes" className="block text-xs text-nickel mb-1">
        {labels.magicLinkTtlMinutesLabel}
      </label>
      <input
        id="magicLinkTtlMinutes"
        type="number"
        min={1}
        max={1440}
        value={magicLinkTtlMinutes}
        onChange={(event) => setMagicLinkTtlMinutes(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
      />
      <p className="text-[11px] text-nickel mb-3">{labels.magicLinkTtlMinutesHelp}</p>

      <label className="flex items-center gap-2 text-xs text-quartz mb-4">
        <input
          type="checkbox"
          checked={showInterventionVideos}
          onChange={(event) => setShowInterventionVideos(event.target.checked)}
        />
        {labels.showInterventionVideosLabel}
      </label>

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
