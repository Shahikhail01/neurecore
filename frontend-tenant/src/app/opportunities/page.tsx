'use client';
// ─── /opportunities — Phase 10.6 R1 stub. Backend alias of /deals. ──────────────
import { PendingSurfacePage } from '@/components/industry/PendingSurfacePage';
import { opportunitiesService } from '@/services/opportunities.service';

export default function OpportunitiesPage() {
  return (
    <PendingSurfacePage
      title="Opportunities"
      description="Qualified deals in motion. Mirrors Deals today; will diverge with qualification metadata in a later phase."
      fetcher={() => opportunitiesService.list({ limit: 20 })}
      searchPlaceholder="Search opportunities"
      createLabel="New Opportunity"
      plannedPhase="Phase 11"
      rowSingular="opportunity"
    />
  );
}