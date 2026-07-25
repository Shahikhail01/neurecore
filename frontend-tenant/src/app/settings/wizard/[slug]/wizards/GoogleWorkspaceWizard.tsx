'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, ExternalLink, ChevronRight, Mail, Calendar, HardDrive as Drive, Sheet } from 'lucide-react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import { integrationsService, type IntegrationStatus } from '@/services/integrations.service';
import type { WizardSlug } from '@/lib/wizard/types';

export function GoogleWorkspaceWizard({ slug }: { slug: WizardSlug }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  useEffect(() => {
    let cancelled = false;
    void integrationsService.getGoogleStatus().then((s) => {
      if (!cancelled) setStatus(s);
    }).catch(() => { /* ignore */ }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      // The wizard is at /settings/wizard/[slug], not in /onboarding/setup —
      // the callback should return to /settings/integrations.
      const { url } = await integrationsService.initiateGoogleOAuth(
        window.location.origin + '/settings/integrations/callback/google',
        'tenant',
        'settings',
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await integrationsService.disconnectGoogle();
      setStatus({ connected: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await storeComplete(slug);
      setCompleted(true);
    } catch { /* ignored */ } finally { setSaving(false); }
  };

  if (completed) {
    return (
      <WizardShell title="Google Workspace">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Google Workspace configured.</p>
        </div>
      </WizardShell>
    );
  }

  const hasGmail = status?.scopes?.some((s) => s.includes('gmail'));
  const hasDrive = status?.scopes?.some((s) => s.includes('drive'));
  const hasCalendar = status?.scopes?.some((s) => s.includes('calendar'));
  const hasSheets = status?.scopes?.some((s) => s.includes('spreadsheets'));

  return (
    <WizardShell title="Google Workspace" description="Connect Gmail, Drive, Calendar, and Sheets for AI employees.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Google Workspace</h3>
                    {status?.connected && status?.email && (
                      <p className="text-xs text-muted-foreground mt-0.5">Connected as {status.email}</p>
                    )}
                  </div>
                </div>
                <Badge variant={status?.connected ? 'default' : 'secondary'}>
                  {status?.connected ? 'Connected' : 'Not connected'}
                </Badge>
              </div>

              {status?.connected && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {hasGmail && <Badge variant="outline" className="text-xs gap-1"><Mail className="w-3 h-3" /> Gmail</Badge>}
                  {hasDrive && <Badge variant="outline" className="text-xs gap-1"><Drive className="w-3 h-3" /> Drive</Badge>}
                  {hasCalendar && <Badge variant="outline" className="text-xs gap-1"><Calendar className="w-3 h-3" /> Calendar</Badge>}
                  {hasSheets && <Badge variant="outline" className="text-xs gap-1"><Sheet className="w-3 h-3" /> Sheets</Badge>}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {status?.connected ? (
                  <Button variant="outline" size="sm" onClick={handleDisconnect}>
                    <XCircle className="w-4 h-4 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => void handleConnect()} disabled={connecting}>
                    {connecting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Connect Google Workspace
                  </Button>
                )}
                {status?.connected && (
                  <a href="/settings/integrations/google" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Manage settings <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </Card>

            {!status?.connected && (
              <div className="rounded-lg border border-muted p-4 text-sm text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">What this enables:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>AI employees send and receive emails via Gmail</li>
                  <li>Create, read, and manage documents in Google Drive</li>
                  <li>Schedule and manage calendar events</li>
                  <li>Read and write Google Sheets for reports and data</li>
                </ul>
              </div>
            )}

            <a href="/settings/integrations" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ChevronRight className="w-3.5 h-3.5" /> Integration settings page
            </a>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleComplete()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {status?.connected ? 'Continue' : 'Skip for now'}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
