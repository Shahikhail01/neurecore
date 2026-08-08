'use client';

/**
 * Phase 30 — Cost ceiling + resilience card (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30)
 * — "`CostDashboard` surface in Command Center (admin FE)".
 *
 * Shows, per dimension, how much of the hard ceiling a tenant has
 * consumed, whether containment is currently active, and the four
 * resilience counters an operator needs during an incident.
 *
 * Accessibility (Phase 29): the utilisation bars are `progressbar`s
 * with explicit `aria-valuenow`/`aria-valuemax`, the table has real
 * headers, and containment state is announced through a live region
 * rather than colour alone.
 *
 * SOLID
 *   SRP — presentation only. Transport and narrowing live in the
 *         client; policy lives in the backend service.
 *   DIP — the data arrives as a prop; the card fetches nothing.
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  DIMENSION_LABEL,
  type CostCeilingEntry,
  type CostResilienceDashboard,
} from './cost-ceiling.types';

export interface CostCeilingCardProps {
  readonly loading: boolean;
  readonly error: string | null;
  readonly data: CostResilienceDashboard | null;
}

function formatValue(entry: CostCeilingEntry, value: number): string {
  if (entry.unit === 'cents') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(value / 100);
  }
  return new Intl.NumberFormat(undefined).format(value);
}

function percent(utilization: number): number {
  return Math.min(100, Math.round(utilization * 100));
}

export function CostCeilingCard({
  loading,
  error,
  data,
}: CostCeilingCardProps): React.ReactElement {
  if (loading) {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-raised p-4 text-sm text-zinc-400">
        Loading cost ceilings…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!data) return <></>;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised p-4 space-y-4">
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        {data.containmentActive ? (
          <>
            <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span className="text-sm text-amber-300">
              Containment active — at least one cost ceiling is denying AI calls.
            </span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span className="text-sm text-emerald-300">
              All cost ceilings within limits.
            </span>
          </>
        )}
      </div>

      {data.ceilings.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No ceiling configured for this tenant. AI spend is bounded only by the
          soft budget policy.
        </p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">
            Per-dimension cost ceiling utilisation
          </caption>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th scope="col" className="pb-2 font-medium">Dimension</th>
              <th scope="col" className="pb-2 font-medium">Used</th>
              <th scope="col" className="pb-2 font-medium">Ceiling</th>
              <th scope="col" className="pb-2 font-medium">Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {data.ceilings.map((entry) => (
              <tr key={entry.dimension} className="border-t border-surface-border">
                <th scope="row" className="py-2 font-normal text-zinc-300">
                  {DIMENSION_LABEL[entry.dimension]}
                </th>
                <td className="py-2 text-zinc-400">
                  {formatValue(entry, entry.used)}
                </td>
                <td className="py-2 text-zinc-400">
                  {formatValue(entry, entry.limitValue)}
                </td>
                <td className="py-2">
                  <div
                    role="progressbar"
                    aria-label={`${DIMENSION_LABEL[entry.dimension]} ceiling utilisation`}
                    aria-valuenow={percent(entry.utilization)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-full rounded bg-surface-overlay"
                  >
                    <div
                      className={
                        entry.exceeded
                          ? 'h-2 rounded bg-red-500'
                          : 'h-2 rounded bg-emerald-500'
                      }
                      style={{ width: `${percent(entry.utilization)}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">
                    {percent(entry.utilization)}%
                    {entry.exceeded ? ' — exceeded' : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Routing denial rate
          </dt>
          <dd className="text-zinc-200">{percent(data.denialRate)}%</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Latency p95
          </dt>
          <dd className="text-zinc-200">{Math.round(data.latencyP95Ms)} ms</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Duplicate effects
          </dt>
          <dd className="text-zinc-200">{data.duplicateEffects}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Recoveries
          </dt>
          <dd className="text-zinc-200">{data.recoveries}</dd>
        </div>
      </dl>
    </div>
  );
}
