'use client';

/**
 * IndustryStubPage — generic placeholder page for industry-specific workspace
 * routes (per INDUSTRY-GROUPS-CONCEPT.md §8.3).
 *
 * These stubs exist so the IconRail links don't 404. Real implementations
 * land in later phases.
 *
 * Two render paths:
 *   - <IndustryStubPage /> — direct prop API for callers that already have
 *     resolved metadata.
 *   - <IndustryStubFromNav featureId=... industryGroup=... /> — convenience
 *     wrapper that resolves title/description/group/plannedPhase from
 *     `industryNavigation.ts` (the single source of truth). Used by the
 *     8 explicit Financial & Compliance stub pages and the dynamic
 *     /workspace/[feature] route so they cannot drift from the runtime
 *     IconRail metadata.
 */

import { motion } from 'framer-motion';
import { Construction, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import {
  getIndustryNavConfig,
  type IndustryNavConfig,
} from '@/lib/industryNavigation';

export interface IndustryStubPageProps {
  title: string;
  description: string;
  industryGroup: string;
  plannedPhase: string;
}

export function IndustryStubPage({
  title,
  description,
  industryGroup,
  plannedPhase,
}: IndustryStubPageProps) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>
      <div
        role="note"
        className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-xs text-amber-900"
        data-testid="industry-stub-banner"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Placeholder page.</strong>{' '}
          This route exists so the navigation link resolves; the
          operational UI is not yet implemented. Contact your platform
          admin for the production rollout schedule.
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-dashed border-surface-border bg-surface-raised/50 p-8 text-center space-y-4"
      >
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
            <Construction className="w-6 h-6 text-accent" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            Industry Group:{' '}
            <strong className="text-foreground">{industryGroup}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Planned:{' '}
            <strong className="text-foreground">{plannedPhase}</strong>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export interface IndustryStubFromNavProps {
  /**
   * The rail item id to look up (e.g. "compliance", "loans"). Must exist
   * in the resolved `IndustryNavConfig.workspaceExtras`; otherwise the
   * wrapper falls back to a generic stub with the tenant's group label.
   */
  featureId: string;
  /** The tenant's industry-group slug (e.g. "financial-compliance"). */
  industryGroup: string;
}

/**
 * Convenience wrapper — looks up the rail item by id in the tenant's nav
 * config and renders the corresponding IndustryStubPage.
 *
 * SRP: this wrapper exists so explicit per-route stub pages don't each
 * carry their own copy of the metadata. Adding a new rail item to
 * `industryNavigation.ts` automatically lights up both the IconRail link
 * AND the stub page content.
 */
export function IndustryStubFromNav({
  featureId,
  industryGroup,
}: IndustryStubFromNavProps) {
  const navConfig: IndustryNavConfig = getIndustryNavConfig(industryGroup);
  const extra = navConfig.workspaceExtras.find((e) => e.id === featureId);
  return (
    <IndustryStubPage
      title={extra?.label ?? humanize(featureId)}
      description={
        extra?.description ??
        `${extra?.label ?? humanize(featureId)} workspace module for ${navConfig.groupLabel} industry group.`
      }
      industryGroup={navConfig.groupLabel}
      plannedPhase={extra?.plannedPhase ?? 'Future Phase'}
    />
  );
}

/** humanize('audit-engagements') → 'Audit Engagements' */
function humanize(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
