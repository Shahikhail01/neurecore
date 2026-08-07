'use client';
// ─── /leads — Phase 10.6 R1 stub. Backend ships in Phase 11. ────────────────────
import { PendingSurfacePage } from '@/components/industry/PendingSurfacePage';
import { leadsService } from '@/services/leads.service';

export default function LeadsPage() {
  return (
    <PendingSurfacePage
      title="Leads"
      description="Top-of-funnel prospects, source attribution, qualification score. Pipeline feeds Deals once qualified."
      fetcher={() => leadsService.list({ limit: 20 })}
      searchPlaceholder="Search leads by name or email"
      createLabel="New Lead"
      plannedPhase="Phase 11"
      rowSingular="lead"
    />
  );
}