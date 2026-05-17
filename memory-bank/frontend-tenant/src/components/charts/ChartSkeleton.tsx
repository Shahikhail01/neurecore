'use client';
// ─── Chart Skeleton ───────────────────────────────────────────────────────────
// S — Single Responsibility: loading placeholder for all charts
export function ChartSkeleton({ height = 200, className = '' }: { height?: number; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-surface-raised border border-surface-border ${className}`}
      style={{ height }}
    >
      <div className="h-full flex flex-col justify-end gap-1 p-4">
        {[60, 45, 75, 50, 80, 65, 70].map((h, i) => (
          <div
            key={i}
            className="bg-surface-muted rounded"
            style={{ height: `${h}%`, width: `${100 / 7}%`, alignSelf: 'flex-end', display: 'inline-block', marginRight: 2 }}
          />
        ))}
      </div>
    </div>
  );
}
