"use client";
// ─── RecentActivityFeed.tsx ───────────────────────────────────────────────────
// SRP: Dashboard wrapper around the ActivityTimeline feature component.
// OCP: ActivityTimeline handles event types — RecentActivityFeed only adapts props.
// DIP: Data injected via props; ActivityTimeline is a pure display component.

import { ActivityTimeline } from "@/features/dashboard/components/ActivityTimeline";
import type { ActivityEvent } from "@/shared/types/domain.types";

interface RecentActivityFeedProps {
  timeline: ActivityEvent[];
  loading: boolean;
}

export function RecentActivityFeed({
  timeline,
  loading,
}: RecentActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading activity">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 rounded bg-surface-muted animate-pulse w-1/3" />
              <div className="h-2.5 rounded bg-surface-muted animate-pulse w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <ActivityTimeline events={timeline} loading={false} />;
}
