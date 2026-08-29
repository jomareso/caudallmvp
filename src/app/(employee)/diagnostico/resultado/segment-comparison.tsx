'use client';

import { useState } from 'react';

export type ComparisonRow = { code: string; label: string; you: number; avg: number };

export type ComparisonTab = {
  key: 'GENERAL' | 'AGE' | 'INCOME' | 'SEX';
  label: string;
  subtitle: string;
  rows: ComparisonRow[];
};

function ComparisonBar({ you, avg }: { you: number; avg: number }) {
  return (
    <div className="relative h-2 bg-silver/25 rounded-full overflow-hidden mt-1.5">
      <div className="h-full bg-cola rounded-full" style={{ width: `${you}%` }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-quartz/70 rounded-full"
        style={{ left: `${avg}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

// Plegable, empieza cerrado (auditoría UX, mockup full-flow-mockup.html):
// es información secundaria opcional (depende de un opt-in explícito del
// empleado), no algo que compita por atención con el score y las
// dimensiones apenas se entra a la pantalla.
export function SegmentComparison({
  tabs,
  labels
}: {
  tabs: ComparisonTab[];
  labels: { title: string; you: string; average: string; vsAverage: string; privacyNote: string };
}) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  if (!active) return null;

  return (
    <div className="mt-6 border border-silver/50 rounded-lg bg-white text-left overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-yale">{labels.title}</span>
          <span className="block text-[11px] text-nickel mt-0.5">{active.subtitle}</span>
        </span>
        <span className={`text-nickel text-xs transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          ▼
        </span>
      </button>

      {open ? (
        <div className="px-4 pb-4">
          {tabs.length > 1 ? (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveKey(tab.key)}
                  aria-pressed={tab.key === active.key}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    tab.key === active.key
                      ? 'border-yale bg-yale/5 text-yale font-medium'
                      : 'border-silver/60 text-nickel'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-3 text-[10px] text-nickel mb-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cola" aria-hidden="true" />
              {labels.you}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-0.5 h-2.5 bg-quartz/70" aria-hidden="true" />
              {labels.average}
            </span>
          </div>

          <div className="space-y-3">
            {active.rows.map((row) => (
              <div key={row.code} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-nickel">{row.label}</span>
                  <span className="text-quartz">
                    {labels.you}: <span className="font-medium">{row.you}</span>
                  </span>
                </div>
                <ComparisonBar you={row.you} avg={row.avg} />
              </div>
            ))}
          </div>

          <p className="text-[10.5px] text-nickel mt-4 leading-relaxed">{labels.privacyNote}</p>
        </div>
      ) : null}
    </div>
  );
}
