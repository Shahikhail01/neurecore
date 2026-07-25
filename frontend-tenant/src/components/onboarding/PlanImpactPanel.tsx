'use client';

/**
 * PlanImpactPanel — onboarding-time preview of "what this tier unlocks
 * for your industry". Phase 3 G15 (INDUSTRY-SETUP-CONCEPT.md §9.8).
 *
 * CONSUMES:  GET /api/v1/industries/:slug/capabilities?tier=<tierSlug>
 *            (IndustriesService.getCapabilities in this codebase)
 *
 * Single Responsibility: render the capability matrix returned by the
 * backend. The backend matrix is the single source of truth; this
 * component does NOT duplicate the limits/features locally — it just
 * maps the JSON shape into a usable visual layout.
 */

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Users, Bot, FolderKanban, Check, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { industriesService, type CapabilityResponse } from '@/services/industries.service';
import { tenantsService } from '@/services/tenants.service';

const FEATURE_LABELS: Record<string, string> = {
  'core-platform': 'Core platform',
  'workflow-automation': 'Workflow automation',
  'api-access': 'API access',
  'audit-logs': 'Audit logs',
  'sso': 'Single sign-on',
  'two-factor': 'Two-factor auth',
  'white-label': 'White-label',
  'custom-branding': 'Custom branding',
  'predictive-analytics': 'Predictive analytics',
  'custom-dashboards': 'Custom dashboards',
  'multi-tenant': 'Multi-tenant',
  'multi-office': 'Multi-office',
};

function formatLimit(value: number): string {
  return value >= 9999 ? 'Unlimited' : String(value);
}

export interface PlanImpactPanelProps {
  /** Tier slug the user is hovering / has selected. */
  tierSlug: string;
  /**
   * Optional explicit industry slug — if omitted, we read the current
   * tenant's industry via tenantsService.getCurrent(). Pass explicitly
   * when rendering in a context that has no tenant yet (e.g. re-run).
   */
  industrySlug?: string | null;
}

export function PlanImpactPanel({ tierSlug, industrySlug }: PlanImpactPanelProps) {
  const [effectiveIndustry, setEffectiveIndustry] = useState<string | null>(
    industrySlug ?? null,
  );
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve industry if not supplied explicitly.
  useEffect(() => {
    if (industrySlug !== undefined && industrySlug !== null) {
      setEffectiveIndustry(industrySlug);
      return;
    }
    let cancelled = false;
    tenantsService
      .getCurrent()
      .then((t) => {
        // FIX-COMPREHENSIVE-R3 (2026-07-24): when the tenant has no
        // industry yet (Skip-industry path or first-run), show the
        // universal-baseline preview so the user can still see what
        // their tier unlocks. The backend sentinel `__universal__`
        // resolves to the `other` group capability row.
        if (!cancelled) setEffectiveIndustry(t.industry ?? '__universal__');
      })
      .catch(() => {
        if (!cancelled) setEffectiveIndustry('__universal__');
      });
    return () => {
      cancelled = true;
    };
  }, [industrySlug]);

  // Fetch the capability matrix whenever (industry, tier) changes.
  useEffect(() => {
    if (!effectiveIndustry || !tierSlug) {
      setCapabilities(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    industriesService
      .getCapabilities(effectiveIndustry, tierSlug)
      .then((data) => {
        if (!cancelled) setCapabilities(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load plan impact');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveIndustry, tierSlug]);

  if (loading && !capabilities) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading plan impact…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        {error}
      </div>
    );
  }

  if (!capabilities) return null;

  const c = capabilities.capabilities;
  const maxAgentAgents = c.activeAgentSlugs.length;
  const previewAgents = c.activeAgentSlugs.slice(0, 6);
  const moreAgents = Math.max(0, maxAgentAgents - previewAgents.length);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
      data-testid="plan-impact-panel"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        {capabilities.universal
          ? `Plan impact (universal baseline) on ${capabilities.tier}`
          : `Plan impact for ${capabilities.industry.name} on ${capabilities.tier}`}
      </div>
      {capabilities.universal && (
        <p className="text-[11px] text-muted-foreground">
          Showing the universal baseline. Pick an industry in the Company step to see industry-specific defaults.
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <ImpactStat icon={Bot} label="Agents" value={formatLimit(c.maxAgents)} />
        <ImpactStat icon={FolderKanban} label="Departments" value={formatLimit(c.maxDepartments)} />
        <ImpactStat icon={Users} label="Storage" value={`${formatLimit(c.maxStorageGB)} GB`} />
        <ImpactStat icon={Layers} label="Approval stages" value={formatLimit(c.maxApprovalStages)} />
      </div>

      {previewAgents.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">
            Default agents for your industry ({maxAgentAgents} in pool · {formatLimit(c.maxAgents)} tier cap)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {previewAgents.map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium"
              >
                <Check className="w-2.5 h-2.5" />
                {slug.replace(/-/g, ' ')}
              </span>
            ))}
            {moreAgents > 0 && (
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px]">
                +{moreAgents} more
              </span>
            )}
          </div>
        </div>
      )}

      {c.featureFlags.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">
            Feature flags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.featureFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {FEATURE_LABELS[flag] ?? flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {c.integrationsAvailable.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1.5">
            Integrations available
          </div>
          <div className="flex flex-wrap gap-1.5">
            {c.integrationsAvailable.map((integration) => (
              <span
                key={integration}
                className="rounded-md bg-background border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {integration}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{c.description}</p>
    </motion.div>
  );
}

function ImpactStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
