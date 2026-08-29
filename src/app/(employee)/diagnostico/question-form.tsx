'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitDiagnosticAnswer } from './actions';
import { splitHighlightMarkup } from '@/lib/landing/blocks';

// Mismo marcado **palabra clave** que ya usa el contenido de las landings
// (ver splitHighlightMarkup, BrandPanel) — el banco de preguntas vive en
// messages/es.json como texto plano (Decisión 5), así que reutilizar la
// misma sintaxis no requiere schema nuevo: quien edite una pregunta solo
// envuelve la frase que quiere resaltar entre **asteriscos dobles**, igual
// que en el mockup ("...cuántas **personas dependen** ... de **tus
// ingresos**?"). Sin marcado, el texto se ve exactamente igual que antes.
function renderQuestionText(text: string) {
  return splitHighlightMarkup(text).map((part, index) =>
    part.highlighted ? (
      <span key={index} className="text-yale font-semibold">
        {part.text}
      </span>
    ) : (
      <span key={index}>{part.text}</span>
    )
  );
}

export function QuestionForm({
  questionId,
  questionText,
  options,
  continueLabel,
  errorLabel,
  mode = 'financial'
}: {
  questionId: string;
  questionText: string;
  options: { id: string; label: string }[];
  continueLabel: string;
  errorLabel: string;
  // 'financial' (default): al terminar la parte financiera del
  // diagnóstico, sigue a /diagnostico/contexto (que decide si hay bloque
  // de contexto pendiente u ofrece ir directo a resultado) — antes iba
  // directo a resultado. 'context': cada respuesta del bloque de
  // contexto vuelve a /diagnostico/contexto, que sirve la siguiente
  // pregunta o redirige a resultado cuando ya no queda ninguna — el
  // campo `done` de submitDiagnosticAnswer refleja la parte financiera
  // (ya terminada en este punto), así que no sirve para decidir acá.
  mode?: 'financial' | 'context';
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
      if (mode === 'context') {
        router.push('/diagnostico/contexto');
      } else {
        router.push(result.done ? '/diagnostico/contexto' : '/diagnostico');
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-silver/60 rounded-xl p-6">
      <p className="text-lg font-medium text-quartz mb-4 leading-snug">{renderQuestionText(questionText)}</p>

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
