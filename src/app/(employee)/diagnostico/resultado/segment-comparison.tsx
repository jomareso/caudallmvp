'use client';

import { useState } from 'react';

export type ComparisonRow = { code: string; label: string; you: number; avg: number };

export type ComparisonTab = {
  key: 'GENERAL' | 'AGE' | 'INCOME' | 'SEX';
  label: string;
  subtitle: string;
  rows: ComparisonRow[];
};

export function SegmentComparison({
  tabs,
  labels
}: {
  tabs: ComparisonTab[];
  labels: { title: string; you: string; average: string };
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key);
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];
  if (!active) return null;

  return (
    <div className="mt-6 border border-silver/50 rounded-lg p-4 bg-white text-left">
      <p className="text-sm font-medium text-quartz mb-3">{labels.title}</p>

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

      <p className="text-[11px] text-nickel mb-3">{active.subtitle}</p>
      <div className="space-y-2">
        {active.rows.map((row) => (
          <div key={row.code} className="flex items-center justify-between text-xs">
            <span className="text-nickel">{row.label}</span>
            <span className="text-quartz">
              {labels.you}: <span className="font-medium">{row.you}</span>
              <span className="text-nickel"> · {labels.average}: {row.avg}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
