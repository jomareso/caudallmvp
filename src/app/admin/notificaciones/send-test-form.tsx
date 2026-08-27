'use client';

import { useState, useTransition } from 'react';
import { sendTestPushNotification } from './actions';

export function SendTestForm({
  labels
}: {
  labels: {
    emailLabel: string;
    titleLabel: string;
    bodyLabel: string;
    send: string;
    sending: string;
    success: string;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await sendTestPushNotification(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(`${labels.success} (${result.sent} enviada(s), ${result.expired} suscripción(es) vencida(s) eliminada(s))`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="block text-xs text-nickel mb-1">
          {labels.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full border border-silver/60 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="title" className="block text-xs text-nickel mb-1">
          {labels.titleLabel}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue="Caudall"
          className="w-full border border-silver/60 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="body" className="block text-xs text-nickel mb-1">
          {labels.bodyLabel}
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={3}
          className="w-full border border-silver/60 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error ? <p className="text-xs text-bad">{error}</p> : null}
      {success ? <p className="text-xs text-ok">{success}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="bg-yale text-white rounded-lg py-2 px-4 text-sm disabled:opacity-60"
      >
        {isPending ? labels.sending : labels.send}
      </button>
    </form>
  );
}
