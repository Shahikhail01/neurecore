'use client';

// steps/IntegrationsStep.tsx — Initial onboarding step for connecting
// Google Workspace and Brevo. Both are vital for company working
// (documentation, calendar, email, notifications).
// User can skip and configure later from the Setup Center.

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { integrationsService } from '@/services/integrations.service';
import type { IntegrationStatus } from '@/services/integrations.service';

export interface IntegrationsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function IntegrationsStep({ onNext, onBack }: IntegrationsStepProps) {
  const [googleStatus, setGoogleStatus] = useState<IntegrationStatus | null>(null);
  const [brevoConnected, setBrevoConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoConnecting, setBrevoConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [gs, bs] = await Promise.all([
          integrationsService.getGoogleStatus(),
          integrationsService.getBrevoStatus(),
        ]);
        if (!cancelled) {
          setGoogleStatus(gs);
          setBrevoConnected(bs.connected);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true);
    setError(null);
    try {
      // origin='onboarding' tells the callback to return to this wizard
      // after the OAuth dance completes, NOT to /settings/integrations.
      const { url } = await integrationsService.initiateGoogleOAuth(
        window.location.origin + '/settings/integrations/callback/google',
        'tenant',
        'onboarding',
      );
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Google');
      setGoogleConnecting(false);
    }
  };

  const handleBrevoConnect = async () => {
    if (!brevoApiKey.trim()) return;
    setBrevoConnecting(true);
    setError(null);
    try {
      await integrationsService.connectBrevo(brevoApiKey.trim());
      setBrevoConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Brevo');
    } finally {
      setBrevoConnecting(false);
    }
  };

  const hasGmail = googleStatus?.scopes?.some((s) => s.includes('gmail'));
  const hasDrive = googleStatus?.scopes?.some((s) => s.includes('drive'));
  const hasCalendar = googleStatus?.scopes?.some((s) => s.includes('calendar'));

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Connect your tools</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect the tools your company relies on daily. You can skip this and
          set it up later from your home page.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Google Workspace Card */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm">Google Workspace</p>
                  <p className="text-xs text-muted-foreground">Gmail, Drive, Calendar, Sheets</p>
                </div>
              </div>
              <Badge variant={googleStatus?.connected ? 'default' : 'secondary'}>
                {googleStatus?.connected ? 'Connected' : 'Optional'}
              </Badge>
            </div>
            {googleStatus?.connected && (hasGmail || hasDrive || hasCalendar) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hasGmail && <Badge variant="outline" className="text-xs">Gmail</Badge>}
                {hasDrive && <Badge variant="outline" className="text-xs">Drive</Badge>}
                {hasCalendar && <Badge variant="outline" className="text-xs">Calendar</Badge>}
              </div>
            )}
            <div className="mt-3">
              {googleStatus?.connected ? (
                <p className="text-xs text-[color:var(--state-success)] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </p>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void handleGoogleConnect()} disabled={googleConnecting}>
                  {googleConnecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Connect Google Workspace
                </Button>
              )}
            </div>
          </Card>

          {/* Brevo Card */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Brevo Email</p>
                <p className="text-xs text-muted-foreground">Transactional email for notifications & alerts</p>
              </div>
              <Badge variant={brevoConnected ? 'default' : 'secondary'}>
                {brevoConnected ? 'Connected' : 'Optional'}
              </Badge>
            </div>
            {!brevoConnected && (
              <div className="mt-3 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="ob-brevo-key" className="text-xs">API Key</Label>
                  <Input
                    id="ob-brevo-key"
                    value={brevoApiKey}
                    onChange={(e) => setBrevoApiKey(e.target.value)}
                    placeholder="xkeysib-..."
                    type="password"
                    className="h-8 text-xs"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => void handleBrevoConnect()} disabled={brevoConnecting || !brevoApiKey.trim()}>
                  {brevoConnecting && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Connect Brevo
                </Button>
              </div>
            )}
            {brevoConnected && (
              <p className="mt-3 text-xs text-[color:var(--state-success)] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </p>
            )}
          </Card>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={onNext}>
          Continue <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
