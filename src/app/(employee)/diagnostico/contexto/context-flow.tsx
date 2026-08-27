'use client';

import { useState } from 'react';
import Link from 'next/link';
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
    ctaSkip: string;
    formContinueLabel: string;
    formErrorLabel: string;
  };
}) {
  const [started, setStarted] = useState(!showIntro);

  if (!started) {
    return (
      <div className="bg-white border border-silver/60 rounded-xl p-6 text-center">
        <p className="text-xs text-nickel mb-2">{labels.eyebrow}</p>
        <h1 className="text-lg font-medium text-quartz mb-3">{labels.title}</h1>
        <p className="text-sm text-nickel mb-6">{labels.body}</p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="w-full bg-yale text-white rounded-lg py-2.5 text-sm mb-2"
        >
          {labels.ctaContinue}
        </button>
        <Link
          href="/diagnostico/resultado"
          className="block text-center text-xs text-nickel underline py-1"
        >
          {labels.ctaSkip}
        </Link>
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
