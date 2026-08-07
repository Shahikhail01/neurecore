'use client';
// ─── /emails — Phase 10.6 R1 stub. Backend ships in Phase 11. ───────────────────
import { PendingSurfacePage } from '@/components/industry/PendingSurfacePage';
import { emailsService } from '@/services/emails.service';

export default function EmailsPage() {
  return (
    <PendingSurfacePage
      title="Emails"
      description="Outreach sequences, replies, meeting-booked signals. Synced from Gmail / Outlook, surfaced on the customer 360."
      fetcher={() => emailsService.list({ limit: 20 })}
      searchPlaceholder="Search emails by subject or sender"
      createLabel="Compose Email"
      plannedPhase="Phase 11"
      rowSingular="email"
    />
  );
}