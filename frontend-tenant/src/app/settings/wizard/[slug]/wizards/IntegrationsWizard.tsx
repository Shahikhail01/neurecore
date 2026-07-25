'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, ExternalLink, Link2 } from 'lucide-react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import { integrationsService, type IntegrationsList } from '@/services/integrations.service';
import type { WizardSlug } from '@/lib/wizard/types';

export function IntegrationsWizard({ slug }: { slug: WizardSlug }) {
  const [status, setStatus] = useState<IntegrationsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  useEffect(() => {
    let cancelled = false;
    void integrationsService.listIntegrations().then((s) => { if (!cancelled) setStatus(s); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleComplete = async () => {
    setSaving(true);
    try {
      await storeComplete(slug);
      setCompleted(true);
    } catch { /* ignored */ } finally { setSaving(false); }
  };

  if (completed) {
    return (
      <WizardShell title="Integrations">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Integrations reviewed.</p>
        </div>
      </WizardShell>
    );
  }

  const hasAny = status && (status.google?.connected || status.brevo?.connected);

  return (
    <WizardShell title="Integrations" description="Connect Slack, Microsoft 365, and other services.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Google Workspace and Brevo are configured from their dedicated wizards.
              Additional integrations can be connected from the Integrations page.
            </p>

            {status && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    <span className="text-sm">Google Workspace</span>
                  </div>
                  <Badge variant={status.google?.connected ? 'default' : 'secondary'}>
                    {status.google?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    <span className="text-sm">Brevo Email</span>
                  </div>
                  <Badge variant={status.brevo?.connected ? 'default' : 'secondary'}>
                    {status.brevo?.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
              </div>
            )}

            <a
              href="/settings/integrations"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Manage all integrations
            </a>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleComplete()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Mark as reviewed
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
