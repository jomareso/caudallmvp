'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadLogo } from './actions';

export function LogoUploadForm({
  labels
}: {
  labels: { uploadLabel: string; uploadCta: string; uploading: string; uploadSuccess: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadLogo(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <label htmlFor="logo" className="block text-xs text-nickel mb-1">
        {labels.uploadLabel}
      </label>
      <input
        id="logo"
        name="logo"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="w-full text-sm text-quartz mb-3"
      />

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.uploadSuccess}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-yale text-white rounded-lg py-2 px-4 text-sm disabled:opacity-60"
      >
        {isPending ? labels.uploading : labels.uploadCta}
      </button>
    </form>
  );
}
