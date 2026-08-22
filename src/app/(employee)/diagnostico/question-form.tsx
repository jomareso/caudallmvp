'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitDiagnosticAnswer } from './actions';

export function QuestionForm({
  questionId,
  questionText,
  options,
  continueLabel,
  errorLabel
}: {
  questionId: string;
  questionText: string;
  options: { id: string; label: string }[];
  continueLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!selected) {
      setError(errorLabel);
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await submitDiagnosticAnswer({ questionId, answerOptionId: selected });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(result.done ? '/diagnostico/resultado' : '/diagnostico');
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-silver/60 rounded-xl p-6">
      <p className="text-base font-medium text-quartz mb-4">{questionText}</p>

      <div className="space-y-2 mb-4">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelected(option.id)}
            className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm flex items-center gap-2.5 ${
              selected === option.id
                ? 'border-cola text-yale bg-picton/10'
                : 'border-silver text-nickel'
            }`}
          >
            <span
              className={`w-4 h-4 rounded-full border flex-shrink-0 ${
                selected === option.id ? 'border-yale bg-yale' : 'border-silver'
              }`}
            />
            {option.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {continueLabel}
      </button>
    </div>
  );
}
