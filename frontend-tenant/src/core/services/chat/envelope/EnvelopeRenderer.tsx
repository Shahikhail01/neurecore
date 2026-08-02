// ─── EnvelopeRenderer.tsx ──────────────────────────────────────────────────────
// SRP: Maps EnvelopeComponent.type → JSX. Thin routing layer — no new
// rendering code lives here. Extracted renderers live alongside the parser
// and consume the same prop shape as the legacy `metadata.chart/metrics/table`
// blocks did (so the visual behaviour is identical).

'use client';

import { MiniChart } from './renderers/MiniChart';
import { MetricsRenderer } from './renderers/MetricsRenderer';
import { TableRenderer } from './renderers/TableRenderer';
import type { EnvelopeComponent } from './interfaces/IEnvelopeParser';

export interface EnvelopeRendererProps {
  components: EnvelopeComponent[];
}

export function EnvelopeRenderer({ components }: EnvelopeRendererProps) {
  if (!components || components.length === 0) return null;
  return (
    <>
      {components.map((c, i) => {
        switch (c.type) {
          case 'chart':
            return (
              <MiniChart
                key={i}
                data={
                  (c.props.chartData as Array<{ label: string; value: number }>) ??
                  []
                }
              />
            );
          case 'table':
            return (
              <TableRenderer
                key={i}
                headers={(c.props.headers as string[]) ?? []}
                rows={
                  (c.props.rows as Array<
                    Record<string, string | number | boolean>
                  >) ?? []
                }
              />
            );
          case 'metrics':
            return (
              <MetricsRenderer
                key={i}
                items={
                  (c.props.items as Array<{
                    label: string;
                    value: string | number;
                    color?: string;
                  }>) ?? []
                }
              />
            );
          default:
            return null; // unreachable per parser validation
        }
      })}
    </>
  );
}
