'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createNotificationRule } from './actions';

type TemplateType = 'COMMITMENT' | 'INCOMPLETE' | 'RESULT_UPDATED' | 'NEW_STEP' | 'LICENSE_EXPIRING';

// Mismo criterio que en actions.ts (DAYS_TEMPLATES): solo estas 2
// plantillas dependen de un umbral de días.
const DAYS_TEMPLATES: TemplateType[] = ['INCOMPLETE', 'LICENSE_EXPIRING'];

export function CreateRuleForm({ labels }: { labels: Record<string, string> }) {
  const router = useRouter();
  const [templateType, setTemplateType] = useState<TemplateType>('INCOMPLETE');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [days, setDays] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const needsDays = DAYS_TEMPLATES.includes(templateType);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await createNotificationRule({
        templateType,
        title,
        body,
        days: needsDays ? days : undefined
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      setTitle('');
      setBody('');
      setDays('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-silver/60 rounded-xl p-6 text-left">
      {/* templateType + días lado a lado (cuando aplica): son los 2 campos
          cortos del formulario — título y cuerpo se quedan a ancho
          completo porque sí se benefician del espacio (título es texto
          libre, cuerpo es un textarea). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
        <div>
          <label htmlFor="templateType" className="block text-xs text-nickel mb-1">
            {labels.templateTypeLabel}
          </label>
          <select
            id="templateType"
            value={templateType}
            onChange={(event) => setTemplateType(event.target.value as TemplateType)}
            className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
          >
            <option value="COMMITMENT">{labels.templateTypeCommitment}</option>
            <option value="INCOMPLETE">{labels.templateTypeIncomplete}</option>
            <option value="RESULT_UPDATED">{labels.templateTypeResultUpdated}</option>
            <option value="NEW_STEP">{labels.templateTypeNewStep}</option>
            <option value="LICENSE_EXPIRING">{labels.templateTypeLicenseExpiring}</option>
          </select>
        </div>

        {needsDays ? (
          <div>
            <label htmlFor="days" className="block text-xs text-nickel mb-1">
              {labels.daysLabel}
            </label>
            <input
              id="days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-1 focus:outline-none focus:border-cola"
            />
            <p className="text-[11px] text-nickel mb-3">
              {templateType === 'INCOMPLETE' ? labels.daysHelpIncomplete : labels.daysHelpLicenseExpiring}
            </p>
          </div>
        ) : null}
      </div>

      <label htmlFor="title" className="block text-xs text-nickel mb-1">
        {labels.titleLabel}
      </label>
      <input
        id="title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      <label htmlFor="body" className="block text-xs text-nickel mb-1">
        {labels.bodyLabel}
      </label>
      <textarea
        id="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        className="w-full border border-silver rounded-lg px-3 py-2.5 text-sm text-quartz mb-3 focus:outline-none focus:border-cola"
      />

      {error ? <p className="text-xs text-bad mb-3">{error}</p> : null}
      {success ? <p className="text-xs text-ok mb-3">{labels.createSuccess}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full lg:w-auto lg:px-8 bg-yale text-white rounded-lg py-2.5 text-sm disabled:opacity-60"
      >
        {isPending ? labels.creating : labels.createCta}
      </button>
    </form>
  );
}
