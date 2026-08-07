'use client';
// ─── /quotes — Phase 10.6 R1 stub. Backend ships in Phase 11. ───────────────────
import { PendingSurfacePage } from '@/components/industry/PendingSurfacePage';
import { quotesService } from '@/services/quotes.service';

export default function QuotesPage() {
  return (
    <PendingSurfacePage
      title="Quotes"
      description="Quote → counter-signature lifecycle tied to Deals. Pricing, terms, valid-until, accept/decline."
      fetcher={() => quotesService.list({ limit: 20 })}
      searchPlaceholder="Search quotes by number"
      createLabel="New Quote"
      plannedPhase="Phase 11"
      rowSingular="quote"
    />
  );
}