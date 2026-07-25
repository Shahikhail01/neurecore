'use client';

// steps/TemplateStep.tsx — Tier-1 onboarding step 5.
// Unchanged logic from the legacy wizard, extracted.

import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { onboardingService } from '@/services/onboarding.service';
import { tenantsService } from '@/services/tenants.service';
import {
  departmentTemplatesService,
  type DepartmentTemplate,
} from '@/services/department-templates.service';

export interface TemplateStepProps {
  initialSlug: string | null;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function TemplateStep({
  initialSlug,
  onNext,
  onSkip,
  onBack,
}: TemplateStepProps) {
  const [templates, setTemplates] = useState<DepartmentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    let industryGroup: string | undefined;
    tenantsService
      .getCurrent()
      .then((tenant) => {
        const t = tenant as { industryGroup?: string; industry?: string };
        industryGroup = t.industryGroup ?? undefined;
      })
      .catch(() => {
        industryGroup = undefined;
      })
      .finally(() => {
        if (cancelled) return;
        departmentTemplatesService
          .list(industryGroup ? { industryGroup } : undefined)
          .then((list) => {
            if (!cancelled) {
              setTemplates(list);
              setLoading(false);
            }
          })
          .catch((e) => {
            if (!cancelled) {
              setError(
                e instanceof Error ? e.message : 'Failed to load templates.',
              );
              setLoading(false);
            }
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = async (slug: string) => {
    setSubmitting(true);
    setError(null);
    try {
      setSelectedSlug(slug);
      await onboardingService.selectTemplate(slug);
      // Onboarding complete happens at the final step (CompleteStep).
      // This step advances the backend step to 'review'.
      onNext(); // navigates to integrations step
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to deploy template.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Pick a starting template</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We will deploy these departments and agents for you automatically.
        </p>
      </div>
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No department templates available. You can create departments manually
          later.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void handleSelect(t.slug)}
              disabled={submitting}
              aria-pressed={selectedSlug === t.slug}
              className={`text-left p-4 rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                selectedSlug === t.slug
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="font-semibold">{t.name}</div>
              {t.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t.description}
                </p>
              )}
              <div className="mt-2 text-xs">
                <Badge variant="outline">
                  {(t.structure ?? []).length} departments
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
      {submitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Deploying…
        </div>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button variant="outline" onClick={onSkip} disabled={submitting}>
          Skip for now
        </Button>
      </div>
    </Card>
  );
}