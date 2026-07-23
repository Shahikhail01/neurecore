'use client';

// steps/CompanyStep.tsx — Tier-1 onboarding step 1.
// Captures company name + industry via INDUSTRY-GROUPS-CONCEPT.md IndustryGroupPicker.
// Persists via PATCH /tenants/me so the fields land in the additive nullable columns.
//
// INDUSTRY-SETUP-CONCEPT.md §3.1 G8 (Phase 1 G8): when `isReRun` is true,
// the industry picker is replaced with a read-only badge — Industry is
// a Super-Admin-only field per INDUSTRY-GROUPS-CONCEPT.md §1.2 D7 and
// must not be changed by the tenant.

import { useEffect, useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { onboardingService } from '@/services/onboarding.service';
import {
  IndustryGroupPicker,
  type IndustryOption,
} from '@/components/onboarding/IndustryGroupPicker';
import { industriesService } from '@/services/industries.service';
import { INDUSTRY_GROUPS, INDUSTRY_GROUP_INDUSTRIES } from '@/lib/industryGroups';

export interface CompanyStepProps {
  initialName: string;
  initialIndustry: string;
  /**
   * INDUSTRY-SETUP-CONCEPT.md §3.1 G8 (Phase 1 G8) — when true the industry
   * picker is locked and the tenant can only progress to the next step.
   * The company name input stays editable so the tenant can still correct
   * spelling without re-running onboarding.
   */
  isReRun?: boolean;
  onNext: () => void;
}

export function CompanyStep({
  initialName,
  initialIndustry,
  isReRun = false,
  onNext,
}: CompanyStepProps) {
  const [companyName, setCompanyName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [industriesLoading, setIndustriesLoading] = useState(!isReRun);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Explicit "skip industry" acknowledgement. Industry is Super-Admin-only
   * once set (INDUSTRY-GROUPS-CONCEPT.md §1.2 D7), so we must never let
   * the picker fall through silently. The toggle surfaces the consequence
   * (generic templates only) and forces the tenant to opt in.
   */
  const [skipIndustry, setSkipIndustry] = useState(false);

  // Fetch the canonical industry list (already grouped server-side).
  // NOTE: `GET /api/v1/industries/groups` returns `{slug, label, industrySlugs: string[]}`
  // (slugs only — no names/icons). Use `industriesService.listAllIndustries()` which
  // walks `/industries/by-group/:slug` for each group to get full Industry objects.
  useEffect(() => {
    if (isReRun) return;
    let cancelled = false;
    void (async () => {
      try {
        const all = await industriesService.listAllIndustries();
        if (cancelled) return;
        setIndustries(all);
        if (all.length === 0) {
          setIndustriesError('Industries are unavailable. Please reload this page.');
        }
      } catch {
        if (!cancelled) {
          setIndustriesError('Industries are unavailable. Please reload this page.');
        }
      } finally {
        if (!cancelled) setIndustriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReRun]);

  const handleContinue = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // On re-run, omit `industry` so we never overwrite the Super-Admin
      // value. We still persist name + locale so the wizard can update
      // any incidental corrections the tenant makes.
      //
      // First-run: send `industry: null` only when the tenant
      // explicitly ticked "Skip industry". Otherwise the backend keeps
      // the tenant-industry null and downstream project-types +
      // recommendations + industry dashboards fall back to generic.
      const payload: { name: string; industry?: string | null } = {
        name: companyName,
      };
      if (!isReRun) {
        payload.industry = skipIndustry ? null : industry;
      }
      await onboardingService.saveCompanyAndLocale(payload);
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSubmitting(false);
    }
  };

  // Derive a human label for the locked industry badge from the local
  // industryGroups map (single source of truth — DRY with the picker).
  const lockedIndustryLabel = (() => {
    if (!industry) return 'Not set';
    for (const group of INDUSTRY_GROUPS) {
      if (INDUSTRY_GROUP_INDUSTRIES[group.slug].includes(industry)) {
        return `${industry} · ${group.label}`;
      }
    }
    return industry;
  })();

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tell us about your company</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isReRun
            ? 'Your industry is locked. You can still update the company name.'
            : 'We will personalize your portal with these details.'}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-name">Company name</Label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Inc."
        />
      </div>
      {isReRun ? (
        <div className="space-y-2">
          <Label>Industry</Label>
          <div
            className="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm"
            data-testid="industry-locked-badge"
          >
            <Lock className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="font-medium">{lockedIndustryLabel}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Only your platform admin can change this.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Industry</Label>
          <IndustryGroupPicker
            industries={industries}
            value={skipIndustry ? '' : industry}
            onChange={(slug) => {
              setSkipIndustry(false);
              setIndustry(slug);
            }}
          />
          {industriesLoading && (
            <p className="text-sm text-muted-foreground">Loading industries…</p>
          )}
          {industriesError && (
            <p className="text-sm text-destructive" role="alert">
              {industriesError}
            </p>
          )}
          <label className="flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={skipIndustry}
              onChange={(e) => setSkipIndustry(e.target.checked)}
              data-testid="industry-skip-toggle"
            />
            <span>
              <span className="font-medium text-foreground">
                Skip industry for now
              </span>
              <br />
              Without an industry you&apos;ll only see generic templates,
              dashboards, and recommendations. Contact your platform admin
              later to set it.
            </span>
          </label>
        </div>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => void handleContinue()}
          disabled={
            !companyName.trim() ||
            (!isReRun &&
              !skipIndustry &&
              (!industry || industriesLoading || Boolean(industriesError))) ||
            submitting
          }
        >
          Continue <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
