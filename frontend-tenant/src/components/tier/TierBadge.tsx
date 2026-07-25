'use client';

/**
 * TierBadge — top-bar pill that shows the tenant's current plan.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.6 / TIER-SYSTEM-CONCEPT.md §8.2 — Phase 6.
 *
 * SRP: this component is render-only. It takes a `Tier` (resolved by the
 *       caller via `tiersService.list()` or similar) and renders a small
 *       badge. Click behaviour is owned by the parent (the TopBar wires
 *       it to <TierChangeModal />).
 *
 * Visual treatment per tier (Basic / Business / Professional / Enterprise)
 * uses the same colour scheme as the rest of the tenant app — a tier-2
 * background for Basic, escalating to a tier-4 / accent background for
 * Enterprise. Keeping these colours in one place (this constant) avoids
 * the "every consumer defines their own tier badge" drift we had in the
 * TopBar before Phase 6.
 *
 * The component intentionally does NOT fetch the tier itself — the tenant
 * self endpoint already carries the tierId, and the parent page is the
 * canonical owner of that resolution. This keeps the badge re-render free
 * (it only re-renders when the parent's tier prop changes).
 */

import { Layers, Sparkles } from 'lucide-react';

export interface TierBadgeTier {
  slug: string;
  name: string;
  tagline?: string | null;
  /** Phase 6 G15: `trialDays` controls whether the badge shows a TRIAL pill. */
  trialDays?: number | null;
}

interface TierBadgeProps {
  tier: TierBadgeTier;
  /**
   * Optional click handler — when set, the badge becomes a button and
   * opens the TierChangeModal in the TopBar. When omitted, the badge is
   * rendered as a non-interactive span (e.g. on a settings page where
   * the modal is unreachable).
   */
  onClick?: () => void;
  /**
   * Compact mode strips the tagline to fit the TopBar's narrow slot. The
   * Settings page uses the full mode so users see the plan description.
   */
  compact?: boolean;
}

/**
 * Visual treatment per tier slug. Centralised so a future re-skin (dark
 * mode toggle, brand refresh) changes one place, not every consumer.
 * Order matches the canonical upgrade path basic → business → professional
 * → enterprise; the index in this array IS the tier rank.
 */
const TIER_PRESENTATION: Record<
  string,
  { rank: number; bgClass: string; textClass: string; label: string }
> = {
  basic: {
    rank: 0,
    bgClass: 'bg-zinc-500/15 border-zinc-500/30',
    textClass: 'text-zinc-300',
    label: 'Basic',
  },
  business: {
    rank: 1,
    bgClass: 'bg-[color:var(--state-info)]/15 border-[color:var(--state-info)]/30',
    textClass: 'text-blue-300',
    label: 'Business',
  },
  professional: {
    rank: 2,
    bgClass: 'bg-[color:var(--accent-500)]/15 border-violet-500/30',
    textClass: 'text-violet-300',
    label: 'Professional',
  },
  enterprise: {
    rank: 3,
    bgClass: 'bg-accent-500/15 border-accent-500/30',
    textClass: 'text-accent-300',
    label: 'Enterprise',
  },
};

export function getTierPresentation(slug: string) {
  return (
    TIER_PRESENTATION[slug] ?? {
      rank: -1,
      bgClass: 'bg-zinc-500/15 border-zinc-500/30',
      textClass: 'text-zinc-300',
      label: slug,
    }
  );
}

export function TierBadge({ tier, onClick, compact = false }: TierBadgeProps) {
  const presentation = getTierPresentation(tier.slug);
  // Phase 6 G15 — show "TRIAL" pill when the tier has a non-zero trialDays.
  const isTrial = (tier.trialDays ?? 0) > 0;
  const TrialIcon = isTrial ? Sparkles : Layers;

  const className = `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium ${presentation.bgClass} ${presentation.textClass}`;

  const content = (
    <>
      <TrialIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{tier.name ?? presentation.label}</span>
      {isTrial && (
        <span
          className="ml-0.5 rounded-full bg-[color:var(--state-warning)]/20 text-amber-300 text-[9px] px-1.5 py-px font-semibold uppercase tracking-wide"
          title={`${tier.trialDays}-day trial`}
        >
          Trial · {tier.trialDays}d
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} hover:brightness-125 transition cursor-pointer`}
        aria-label={`Current plan: ${tier.name}. Click to change.`}
        data-testid="tier-badge-button"
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={className}
      data-testid="tier-badge"
      title={tier.tagline ?? tier.name}
    >
      {content}
      {!compact && tier.tagline && (
        <span className="text-[10px] text-zinc-500 truncate ml-1 hidden md:inline">
          · {tier.tagline}
        </span>
      )}
    </span>
  );
}
