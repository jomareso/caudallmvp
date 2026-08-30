'use client';

import { useState } from 'react';
import { QuestionForm } from '../question-form';

export function ContextFlow({
  showIntro,
  question,
  labels
}: {
  showIntro: boolean;
  question: {
    id: string;
    text: string;
    options: { id: string; label: string }[];
  };
  labels: {
    eyebrow: string;
    title: string;
    body: string;
    ctaContinue: string;
    formContinueLabel: string;
    formErrorLabel: string;
  };
}) {
  const [started, setStarted] = useState(!showIntro);

  if (!started) {
    return (
      <div className="bg-white border border-silver/60 rounded-xl p-6 text-center">
        <span className="inline-block text-[11px] font-medium px-2.5 py-1 rounded-lg bg-picton/10 text-yale mb-3">
          {labels.eyebrow}
        </span>
        <h1 className="text-xl font-semibold text-yale mb-3">{labels.title}</h1>
        <p className="text-sm text-nickel mb-6">{labels.body}</p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="w-full bg-yale text-white rounded-lg py-2.5 text-sm"
        >
          {labels.ctaContinue}
        </button>
      </div>
    );
  }

  return (
    <QuestionForm
      mode="context"
      questionId={question.id}
      questionText={question.text}
      options={question.options}
      continueLabel={labels.formContinueLabel}
      errorLabel={labels.formErrorLabel}
    />
  );
}
