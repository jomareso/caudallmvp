'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateNotificationRule, setNotificationRuleEnabled, deleteNotificationRule } from './actions';

type TemplateType = 'COMMITMENT' | 'INCOMPLETE' | 'RESULT_UPDATED' | 'NEW_STEP' | 'LICENSE_EXPIRING';

// Mismo criterio que en actions.ts (DAYS_TEMPLATES).
const DAYS_TEMPLATES: TemplateType[] = ['INCOMPLETE', 'LICENSE_EXPIRING'];

export function RuleRow({
  rule,
  labels
}: {
  rule: {
    id: string;
    templateType: TemplateType;
    templateLabel: string;
    title: string;
    body: string;
    days: number | null;
    enabled: boolean;
  };
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(rule.title);
  const [body, setBody] = useState(rule.body);
  const [days, setDays] = useState(rule.days ? String(rule.days) : '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsDays = DAYS_TEMPLATES.includes(rule.templateType);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateNotificationRule({
        ruleId: rule.id,
        title,
        body,
        days: needsDays ? days : undefined
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleToggleEnabled() {
    setError(null);
    startTransition(async () => {
      const result = await setNotificationRuleEnabled({ ruleId: rule.id, enabled: !rule.enabled });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(labels.deleteConfirm)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteNotificationRule({ ruleId: rule.id });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="bg-white border border-cola rounded-lg p-3 text-xs">
        <p className="text-quartz font-medium mb-2">{rule.templateLabel}</p>

        {/* título + días lado a lado (cuando aplica), cuerpo a ancho
            completo debajo — mismo criterio que create-rule-form.tsx, en
            vez de las 3 líneas apiladas de antes sin usar el ancho
            disponible en escritorio. */}
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="flex-1 min-w-[180px] border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
          />
          {needsDays ? (
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="w-24 border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz"
            />
          ) : null}
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          className="w-full border border-silver rounded-lg px-2 py-1.5 text-xs text-quartz mb-2"
        />

        {error ? <p className="text-bad mb-2">{error}</p> : null}

        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="bg-yale text-white rounded-lg px-3 py-1.5 disabled:opacity-60">
            {isPending ? labels.saving : labels.saveCta}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-nickel px-3 py-1.5">
            {labels.cancelCta}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white border border-silver/60 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-quartz font-medium">
            {rule.templateLabel}
            <span
              className={
                rule.enabled
                  ? 'ml-2 text-[10px] bg-ok/15 text-ok rounded px-1.5 py-0.5 align-middle'
                  : 'ml-2 text-[10px] bg-silver/40 text-nickel rounded px-1.5 py-0.5 align-middle'
              }
            >
              {rule.enabled ? labels.enabledBadge : labels.disabledBadge}
            </span>
          </p>
          <p className="text-nickel mt-1">{rule.title}</p>
          <p className="text-nickel">{rule.body}</p>
          {rule.days ? <p className="text-nickel mt-1">{labels.daysLabel}: {rule.days}</p> : null}
        </div>
        <div className="flex gap-3 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="text-cola">
            {labels.editCta}
          </button>
          <button
            type="button"
            onClick={handleToggleEnabled}
            disabled={isPending}
            className={rule.enabled ? 'text-bad disabled:opacity-60' : 'text-ok disabled:opacity-60'}
          >
            {rule.enabled ? labels.deactivateCta : labels.activateCta}
          </button>
          <button type="button" onClick={handleDelete} disabled={isPending} className="text-nickel disabled:opacity-60">
            {labels.deleteCta}
          </button>
        </div>
      </div>
      {error ? <p className="text-bad mt-1">{error}</p> : null}
    </div>
  );
}
