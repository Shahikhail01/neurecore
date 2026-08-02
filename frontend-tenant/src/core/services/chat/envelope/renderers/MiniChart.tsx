// ─── MiniChart.tsx ─────────────────────────────────────────────────────────────
// Extracted from UnifiedChatMessage.tsx with no behavioural changes. The
// chart payload shape `{ chartData: Array<{label, value}> }` is what the
// legacy `metadata.chart` path produced and is what the new envelope's
// `chart` component produces too.

'use client';

export interface MiniChartProps {
  data: Array<{ label: string; value: number }>;
}

export function MiniChart({ data }: MiniChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const items = data.slice(0, 8);
  return (
    <div className="mt-2 flex items-end gap-1 h-20" data-component="chart">
      {items.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 min-w-0">
          <div
            className="w-full rounded-t bg-[color:var(--accent-500)]/70 transition-all"
            style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
          />
          <span className="text-[8px] text-zinc-500 mt-0.5 truncate w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}
