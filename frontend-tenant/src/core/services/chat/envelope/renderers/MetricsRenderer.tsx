// ─── MetricsRenderer.tsx ───────────────────────────────────────────────────────
// Extracted from UnifiedChatMessage.tsx with no behavioural changes.

'use client';

export interface MetricsRendererProps {
  items: Array<{ label: string; value: string | number; color?: string }>;
}

export function MetricsRenderer({ items }: MetricsRendererProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" data-component="metrics">
      {items.map((item) => (
        <span
          key={item.label}
          className="rounded-md bg-surface-raised px-2 py-0.5 text-[10px] text-zinc-300"
        >
          <span className="text-zinc-500">{item.label}:</span> {item.value}
        </span>
      ))}
    </div>
  );
}
