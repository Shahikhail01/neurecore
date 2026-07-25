'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, Send, ChevronRight } from 'lucide-react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import { integrationsService } from '@/services/integrations.service';
import type { WizardSlug } from '@/lib/wizard/types';

export function BrevoWizard({ slug }: { slug: WizardSlug }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [savedSenderEmail, setSavedSenderEmail] = useState<string | null>(null);
  const [savedSenderName, setSavedSenderName] = useState<string | null>(null);
  const [sentToday, setSentToday] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(300);
  const [connecting, setConnecting] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const status = await integrationsService.getBrevoStatus();
        if (cancelled) return;
        setConnected(status.connected);
        if (status.connected) {
          const usage = await integrationsService.getBrevoUsage();
          if (!cancelled) {
            setSentToday(usage.sentToday);
            setDailyLimit(usage.dailyLimit);
          }
          // Hydrate sender identity so user sees what's currently set
          try {
            const sender = await integrationsService.getBrevoSender();
            if (!cancelled) {
              setSavedSenderEmail(sender.tenant.brevoSenderEmail);
              setSavedSenderName(sender.tenant.brevoSenderName);
              if (sender.tenant.brevoSenderEmail) setSenderEmail(sender.tenant.brevoSenderEmail);
              if (sender.tenant.brevoSenderName) setSenderName(sender.tenant.brevoSenderName);
            }
          } catch {
            // best-effort — sender identity is optional
          }
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      await integrationsService.connectBrevo(apiKey.trim());
      setConnected(true);
      const usage = await integrationsService.getBrevoUsage();
      setSentToday(usage.sentToday);
      setDailyLimit(usage.dailyLimit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handlePersistSender = async () => {
    if (!senderEmail.trim()) {
      setError('Enter a sender email before saving.');
      return;
    }
    setPersisting(true);
    setError(null);
    try {
      const r = await integrationsService.setBrevoSender({
        brevoSenderEmail: senderEmail.trim(),
        brevoSenderName: senderName.trim() || undefined,
      });
      if (!r?.success) {
        setError(r?.error ?? 'Could not save sender identity.');
        return;
      }
      setSavedSenderEmail(senderEmail.trim());
      setSavedSenderName(senderName.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPersisting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await integrationsService.disconnectBrevo();
      setConnected(false);
      setApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      // If user filled sender fields but didn't click "Save sender", persist now.
      if (connected && senderEmail.trim() && senderEmail.trim() !== savedSenderEmail) {
        await integrationsService.setBrevoSender({
          brevoSenderEmail: senderEmail.trim(),
          brevoSenderName: senderName.trim() || undefined,
        });
      }
      await storeComplete(slug);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finalize wizard.');
    } finally { setSaving(false); }
  };

  if (completed) {
    return (
      <WizardShell title="Brevo Email">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Brevo email configured.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Brevo Email" description="Connect transactional email for notifications and alerts.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-[color:var(--state-info)]" />
                    <h3 className="font-semibold text-sm">Brevo Transactional Email</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enables AI agents to send notifications, alerts, and transactional emails.
                  </p>
                </div>
                <Badge variant={connected ? 'default' : 'secondary'}>
                  {connected ? 'Connected' : 'Not connected'}
                </Badge>
              </div>

              {!connected ? (
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="brevo-key">Brevo API Key</Label>
                    <Input
                      id="brevo-key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="xkeysib-..."
                      type="password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Find your API key in Brevo dashboard → SMTP & API → API Keys.
                      If your tier uses the platform master key, leave empty.
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void handleConnect()} disabled={connecting}>
                    {connecting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    Connect
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-muted/30 p-3 text-center">
                      <p className="text-lg font-semibold">{sentToday}</p>
                      <p className="text-xs text-muted-foreground">Sent today</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-3 text-center">
                      <p className="text-lg font-semibold">{dailyLimit - sentToday}</p>
                      <p className="text-xs text-muted-foreground">Remaining today</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sender-name">Sender name</Label>
                    <Input
                      id="sender-name"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Acme Inc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sender-email">Sender email (required)</Label>
                    <Input
                      id="sender-email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="notifications@acme.com"
                      type="email"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used in the "From" field of every email sent by this tenant.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => void handlePersistSender()} disabled={persisting || !senderEmail.trim()}>
                      {persisting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Save sender identity
                    </Button>
                    {savedSenderEmail && (
                      <span className="text-xs text-[color:var(--state-success)] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Saved as {savedSenderEmail}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDisconnect}>
                    <XCircle className="w-4 h-4 mr-1" /> Disconnect
                  </Button>
                </div>
              )}
            </Card>

            <a href="/settings/integrations" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              <ChevronRight className="w-3.5 h-3.5" /> Integration settings page
            </a>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleComplete()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {connected ? 'Continue' : 'Skip for now'}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
