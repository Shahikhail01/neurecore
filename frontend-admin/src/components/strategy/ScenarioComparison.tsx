'use client';

/**
 * ScenarioComparison.tsx — Side-by-side scenario list with color-coded rows
 *
 * S: display-only; mutation happens in strategy page via useStrategyStore
 * O: new comparison metrics = add row to METRICS array
 */

import type { Scenario } from '@/types/strategy.types';

const METRICS: {
  label: string;
  key: 'totalRevenue' | 'totalCost' | 'avgMarginPct';
  format: (v: number) => string;
}[] = [
  { label: 'Revenue',    key: 'totalRevenue',  format: (v) => `$${(v / 1_000).toFixed(1)}k` },
  { label: 'Cost',       key: 'totalCost',     format: (v) => `$${(v / 1_000).toFixed(1)}k` },
  { label: 'Margin %',   key: 'avgMarginPct',  format: (v) => `${v.toFixed(1)}%` },
];

interface Props {
  scenarios: Scenario[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ScenarioComparison({ scenarios, currentId, onSelect, onDelete }: Props) {
  if (!scenarios.length) {
    return (
      <div className="text-center text-zinc-500 text-sm py-8">
        No saved scenarios yet — run a forecast and it will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-8" />
            <th className="text-left px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Scenario
            </th>
            {METRICS.map((m) => (
              <th
                key={m.key}
                className="text-right px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider"
              >
                {m.label}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const active = s.id === currentId;
            return (
              <tr
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}
                className={`cursor-pointer border-t border-surface-border transition ${
                  active ? 'bg-surface-overlay' : 'hover:bg-surface-raised/60'
                }`}
              >
                {/* Color swatch */}
                <td className="px-3 py-2.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: s.color }}
                  />
                </td>

                {/* Name + date */}
                <td className="px-3 py-2.5">
                  <div className="font-medium text-zinc-100">{s.name}</div>
                  <div className="text-[10px] text-zinc-500">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </td>

                {/* Metrics */}
                {METRICS.map((m) => (
                  <td key={m.key} className="px-3 py-2.5 text-right font-mono text-zinc-300">
                    {m.format(s.result.summary[m.key])}
                  </td>
                ))}

                {/* Delete */}
                <td className="px-2 py-2.5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="text-zinc-600 hover:text-status-risk transition text-xs"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
