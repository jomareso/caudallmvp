// Gauge circular en vez de solo el número en texto plano (auditoría UX,
// mockup full-flow-mockup.html). Server Component puro — es SVG estático,
// sin ningún estado ni interacción, así que no hace falta 'use client'.
const SIZE = 152;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreGauge({
  score,
  vsAverage,
  outOfLabel,
  vsAverageLabel
}: {
  score: number;
  vsAverage: number | null;
  outOfLabel: string;
  vsAverageLabel: string;
}) {
  const offset = CIRCUMFERENCE * (1 - score / 100);

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-silver/30"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className="text-yale"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-medium text-yale leading-none">{score}</span>
        <span className="text-[11px] text-nickel mt-0.5">{outOfLabel}</span>
        {vsAverage !== null ? (
          <span className={`text-[11px] font-medium mt-1 ${vsAverage >= 0 ? 'text-ok' : 'text-bad'}`}>
            {vsAverage >= 0 ? `+${vsAverage}` : vsAverage} {vsAverageLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
