"use client";

/**
 * PackagePreview — Phase 10.
 *
 * Live preview panel shown next to the composer. Shows totals, missing items,
 * and category breakdown. Single Responsibility: visual summary of the
 * composition draft.
 */

import type { PackagePreviewResult } from '@/services/packages.service';

export function PackagePreview({
  industryName,
  tierName,
  totals,
  missing,
  categories,
}: {
  industryName?: string;
  tierName?: string;
  totals: PackagePreviewResult['totals'];
  missing: PackagePreviewResult['missing'];
  categories: PackagePreviewResult['categories'];
}) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4 space-y-3 sticky top-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-zinc-600">
          Composing
        </div>
        <div className="text-base font-semibold text-zinc-100 mt-1">
          {industryName ?? '—'} · {tierName ?? '—'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Depts" value={totals.departments} />
        <Stat label="Employees" value={totals.agents} />
        <Stat label="Features" value={totals.features} />
      </div>

      {Object.keys(categories).length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">
            Feature categories
          </div>
          {Object.entries(categories).map(([cat, n]) => (
            <div key={cat} className="flex justify-between text-xs text-zinc-400">
              <span>{cat.toLowerCase()}</span>
              <span className="text-zinc-200">{n}</span>
            </div>
          ))}
        </div>
      )}

      {(missing.departments.length > 0 ||
        missing.agents.length > 0 ||
        missing.features.length > 0) && (
        <div className="rounded-lg bg-[color:var(--state-danger)]/50 border border-red-800/60 p-2 text-xs text-red-200">
          {missing.departments.length + missing.agents.length + missing.features.length}{' '}
          references won't resolve
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-overlay p-2">
      <div className="text-lg font-bold text-zinc-100">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mt-0.5">{label}</div>
    </div>
  );
}
