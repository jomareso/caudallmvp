'use client';

import { useState, useTransition } from 'react';
import { requestEmailChange } from './actions';

type Labels = {
  currentLabel: string;
  change: string;
  newEmailLabel: string;
  changeNotice: string;
  save: string;
  cancel: string;
  changeRequested: string;
};

export function EmailEditor({ currentEmail, labels }: { currentEmail: string; labels: Labels }) {
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await requestEmailChange(newEmail);
      if (result.ok) {
        setMessage({ kind: 'ok', text: labels.changeRequested.replace('{email}', newEmail) });
        setEditing(false);
      } else {
        setMessage({ kind: 'error', text: result.message });
      }
    });
  }

  if (message) {
    return (
      <p className={`text-xs ${message.kind === 'ok' ? 'text-ok' : 'text-bad'}`}>{message.text}</p>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-quartz bg-silver/15 rounded-lg px-2.5 py-1.5 flex-1">{currentEmail}</span>
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-yale underline shrink-0">
          {labels.change}
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder={labels.newEmailLabel}
        className="w-full border border-silver rounded-lg px-3 py-2 text-sm text-quartz mb-2"
      />
      <p className="text-[10px] text-nickel mb-2 leading-relaxed">{labels.changeNotice}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !newEmail}
          onClick={handleSave}
          className="text-xs bg-yale text-white rounded-lg px-3 py-1.5 disabled:opacity-60"
        >
          {labels.save}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setNewEmail('');
          }}
          className="text-xs border border-silver text-nickel rounded-lg px-3 py-1.5"
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}
