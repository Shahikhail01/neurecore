'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Unlink,
  Link2,
  Mail,
  Calendar,
  HardDrive as Drive,
  ChevronRight,
  Sheet,
} from 'lucide-react';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import { integrationsService, type IntegrationsList, type Integration } from '@/services/integrations.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function GoogleIntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  loading,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  loading: boolean;
}) {
  const scopes = integration.scopes ?? [];
  const hasGmail = scopes.some((s) => s.includes('gmail'));
  const hasDrive = scopes.some((s) => s.includes('drive'));
  const hasCalendar = scopes.some((s) => s.includes('calendar'));
  const hasSheets = scopes.some((s) => s.includes('spreadsheets'));

  return (
    <Card className="p-5">
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
            <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
          </div>
        </div>
        <Badge variant={integration.connected ? 'default' : 'secondary'}>
          {integration.connected ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Not Connected
            </span>
          )}
        </Badge>
      </div>

      {integration.connected && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hasGmail && (
            <Badge variant="outline" className="text-xs gap-1">
              <Mail className="w-3 h-3" /> Gmail
            </Badge>
          )}
          {hasDrive && (
            <Badge variant="outline" className="text-xs gap-1">
              <Drive className="w-3 h-3" /> Drive
            </Badge>
          )}
          {hasCalendar && (
            <Badge variant="outline" className="text-xs gap-1">
              <Calendar className="w-3 h-3" /> Calendar
            </Badge>
          )}
          {hasSheets && (
            <Badge variant="outline" className="text-xs gap-1">
              <Sheet className="w-3 h-3" /> Sheets
            </Badge>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2 flex-wrap">
        {integration.connected ? (
          <>
            <Link href="/settings/integrations/google">
              <Button size="sm">
                <ChevronRight className="w-4 h-4" /> Manage
              </Button>
            </Link>
            {hasSheets && (
              <Link href="/settings/integrations/sheets">
                <Button variant="outline" size="sm">
                  <Sheet className="w-4 h-4" /> Sheets
                </Button>
              </Link>
            )}
            {hasCalendar && (
              <Link href="/settings/integrations/calendar">
                <Button variant="outline" size="sm">
                  <Calendar className="w-4 h-4" /> Calendar
                </Button>
              </Link>
            )}
            <Button variant="destructive" size="sm" onClick={onDisconnect} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onConnect} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect Google
          </Button>
        )}
      </div>
    </Card>
  );
}

function BrevoIntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  loading,
}: {
  integration: Integration;
  onConnect: (apiKey: string) => void;
  onDisconnect: () => void;
  loading: boolean;
}) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [usage, setUsage] = useState<{
    sentToday: number;
    dailyLimit: number;
    isAtWarning: boolean;
    isAtLimit: boolean;
  } | null>(null);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [testSendTo, setTestSendTo] = useState('');
  const [testSendSubject, setTestSendSubject] = useState('Neurecore Brevo test email');
  const [testSendBody, setTestSendBody] = useState(
    '<p>This is a test email from Neurecore. If you received it, Brevo is configured correctly.</p>',
  );
  const [testSendResult, setTestSendResult] = useState<{
    success: boolean;
    messageId?: string;
    error?: string;
  } | null>(null);
  const [testSendLoading, setTestSendLoading] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setApiKeyError(null);
    setIsValidating(true);
    try {
      await onConnect(apiKey.trim());
      setShowSetupDialog(false);
      setApiKey('');
      showToast('Brevo connected successfully! Your AI agents can now send emails.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid API key or connection failed';
      setApiKeyError(message);
      showToast(message, 'error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Brevo? Agent email aliases will stop working and any scheduled emails may fail.')) {
      return;
    }
    try {
      await onDisconnect();
      showToast('Brevo disconnected. Email sending is now disabled.', 'success');
    } catch {
      showToast('Failed to disconnect Brevo. Please try again.', 'error');
    }
  };

  const handleSendTest = async () => {
    if (!testSendTo.trim()) {
      setTestSendResult({ success: false, error: 'Recipient email is required' });
      return;
    }
    setTestSendLoading(true);
    setTestSendResult(null);
    try {
      const res = await integrationsService.brevoTestSend({
        to: testSendTo.trim(),
        subject: testSendSubject.trim() || 'Neurecore Brevo test email',
        htmlContent: testSendBody,
      });
      setTestSendResult({
        success: !!res.success,
        messageId: typeof res.messageId === 'string' ? res.messageId : undefined,
        error: typeof res.error === 'string' ? res.error : undefined,
      });
    } catch (err) {
      setTestSendResult({
        success: false,
        error: err instanceof Error ? err.message : 'Send failed',
      });
    } finally {
      setTestSendLoading(false);
    }
  };

  useEffect(() => {
    if (!integration.connected) {
      setUsage(null);
      return;
    }
    void integrationsService
      .getBrevoUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [integration.connected]);

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Brevo Email</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Transactional &amp; bulk email relay</p>
            </div>
          </div>
        <Badge variant={integration.connected ? 'default' : 'secondary'}>
          {integration.connected ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {integration.source === 'master' ? 'Connected (Master Key)' : 'Connected'}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Not Connected
            </span>
          )}
        </Badge>
      </div>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">What this does:</strong> Brevo enables AI agents to send emails
          on behalf of your organization. This includes project updates, notifications, alerts, and bulk
          communications to stakeholders.
        </p>
        {integration.connected && integration.source === 'master' && (
          <p className="text-xs text-amber-600 mt-2">
            Currently using the platform fallback master key. Connect your own Brevo
            API key below to use your own sender identity and quota.
          </p>
        )}
      </div>

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-green-500/15 border border-green-500/30 text-green-600'
                : 'bg-red-500/15 border border-red-500/30 text-red-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            {toast.message}
          </motion.div>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {integration.connected && usage && (
              <Badge
                variant={usage.isAtLimit ? 'destructive' : usage.isAtWarning ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {usage.sentToday}/{usage.dailyLimit} emails today
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              size="sm" 
              onClick={() => setShowSetupDialog(true)} 
              disabled={loading || isValidating}
              className="gap-1.5"
            >
              {loading || isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              {integration.connected ? 'Edit Connection' : 'Setup Brevo'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowGuide(true)}
              className="gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Setup Guide
            </Button>

            {integration.connected && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTestSendOpen(true)}
                className="gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                Send Test Email
              </Button>
            )}

            {integration.connected && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDisconnect} 
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={testSendOpen} onOpenChange={setTestSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Send test email via Brevo
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Confirms Brevo is configured end-to-end. The email is sent via the
              tenant's Brevo account (or the platform master key fallback).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="test-to" className="text-sm">Recipient (to)</Label>
              <Input
                id="test-to"
                type="email"
                placeholder="you@example.com"
                value={testSendTo}
                onChange={(e) => setTestSendTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="test-subject" className="text-sm">Subject</Label>
              <Input
                id="test-subject"
                value={testSendSubject}
                onChange={(e) => setTestSendSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="test-body" className="text-sm">HTML body</Label>
              <textarea
                id="test-body"
                value={testSendBody}
                onChange={(e) => setTestSendBody(e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-surface-border bg-surface-overlay px-3 py-2 text-sm"
              />
            </div>
            {testSendResult && (
              <div
                className={`px-3 py-2 rounded-md text-xs flex items-start gap-2 ${
                  testSendResult.success
                    ? 'bg-green-500/15 border border-green-500/30 text-green-600'
                    : 'bg-red-500/15 border border-red-500/30 text-red-600'
                }`}
              >
                {testSendResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                )}
                <span className="break-all">
                  {testSendResult.success
                    ? `Sent. messageId=${testSendResult.messageId}`
                    : `Failed: ${testSendResult.error}`}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setTestSendOpen(false)}>
              Close
            </Button>
            <Button onClick={handleSendTest} disabled={testSendLoading}>
              {testSendLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Test
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Connect Brevo Email
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Follow these steps to enable AI agents to send emails on your behalf.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">1</div>
                <div>
                  <p className="text-sm font-medium">Create Brevo Account</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sign up at{' '}
                    <a href="https://www.brevo.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">brevo.com</a>
                    {' '}or log in to your existing account.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">2</div>
                <div>
                  <p className="text-sm font-medium">Get Your API Key</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Go to <strong>Settings → API Keys</strong> in Brevo and create a new API key.
                  </p>
                  <a
                    href="https://app.brevo.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary underline mt-1"
                  >
                    Open Brevo API Keys <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">3</div>
                <div>
                  <p className="text-sm font-medium">Verify Your Sending Domain</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    In Brevo, go to <strong>Senders → Domains</strong> and add your domain (e.g., yourcompany.com).
                    This is required for reliable email delivery and to avoid spam filters.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">4</div>
                <div>
                  <p className="text-sm font-medium">Create a Sender Identity</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    In Brevo, go to <strong>Senders → Senders</strong> and create a sender with:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-1 ml-3 list-disc space-y-0.5">
                    <li><strong>From Name:</strong> Your organization name (e.g., &quot;Acme Corp&quot;)</li>
                    <li><strong>From Email:</strong> An email on your verified domain (e.g., &quot;notifications@yourcompany.com&quot;)</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">5</div>
                <div>
                  <p className="text-sm font-medium">Paste API Key Below</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Copy the API key from Brevo and paste it below to complete the connection.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="brevo-api-key" className="text-sm font-medium">
                Brevo API Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brevo-api-key"
                type="password"
                placeholder="xkeys-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setApiKeyError(null);
                }}
                className={apiKeyError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {apiKeyError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {apiKeyError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Your API key is encrypted and stored securely. It is only used to send emails through Brevo.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => { setShowSetupDialog(false); setApiKey(''); setApiKeyError(null); }}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={!apiKey.trim() || isValidating}>
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Connect Brevo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Brevo Setup Guide
            </DialogTitle>
            <DialogDescription className="text-sm">
              Complete guide to setting up Brevo for your AI email agents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto text-sm">
            <div className="space-y-3">
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">1</div>
                  Create Brevo Account
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  If you don&apos;t have a Brevo account, sign up at{' '}
                  <a href="https://www.brevo.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">brevo.com</a>.
                  The free plan includes 300 emails/day.
                </p>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">2</div>
                  Get Your API Key
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  After logging into Brevo, navigate to <strong>Settings → API Keys</strong> and create a new key.
                  Make sure to copy it immediately as Brevo won&apos;t show it again.
                </p>
                <a
                  href="https://app.brevo.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary underline ml-7"
                >
                  Open Brevo API Keys <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">3</div>
                  Verify Your Sending Domain
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  <strong>Why this matters:</strong> Unverified domains often land in spam. Brevo requires DNS
                  verification (DKIM, SPF, DMARC) to ensure deliverability.
                </p>
                <p className="text-xs text-muted-foreground pl-7">
                  Go to <strong>Senders → Domains</strong> and add your company domain. Brevo will provide
                  DNS records to add to your domain registrar.
                </p>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">4</div>
                  Create Sender Identity
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  Go to <strong>Senders → Senders</strong> and create a sender:
                </p>
                <ul className="text-xs text-muted-foreground pl-7 list-disc ml-4 space-y-1">
                  <li><strong>From Name:</strong> Your organization name (e.g., &quot;Acme Corp AI&quot;)</li>
                  <li><strong>From Email:</strong> Use your verified domain (e.g., &quot;noreply@yourcompany.com&quot;)</li>
                  <li><strong>Reply-To:</strong> A monitored inbox where replies go</li>
                </ul>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center">5</div>
                  Connect to Platform
                </div>
                <p className="text-xs text-muted-foreground pl-7">
                  Enter your Brevo API key in the connection dialog above. Once connected, AI agents
                  can send emails using your verified sender identity.
                </p>
              </div>

              <div className="border rounded-lg p-3 bg-amber-500/10 border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 font-medium text-amber-600">
                  <div className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">!</div>
                  Important Notes
                </div>
                <ul className="text-xs text-muted-foreground pl-7 list-disc space-y-1">
                  <li>Your daily sending limit depends on your Brevo plan</li>
                  <li>Monitor your usage via the badge on the integration card</li>
                  <li>Bounces and unsubscribes are tracked automatically</li>
                  <li>For production, use a dedicated domain separate from personal email</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowGuide(false)}>Got It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlackIntegrationCard() {
  return (
    <Card className="p-5 opacity-60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 17.688 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM17.688 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 17.688 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 18.956a2.528 2.528 0 0 1-2.523-2.522 2.526 2.526 0 0 1 2.52-2.522h6.313A2.527 2.527 0 0 1 24 17.688a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Slack</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Team notifications and alerts</p>
          </div>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" disabled>
          Notify Me
        </Button>
      </div>
    </Card>
  );
}

function MicrosoftIntegrationCard() {
  return (
    <Card className="p-5 opacity-60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M11.4 0H0v11.4h11.4V0zM24 0H12.6v11.4H24V0zM11.4 12.6H0V24h11.4V12.6zM24 12.6H12.6V24H24V12.6z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Microsoft 365</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Outlook, OneDrive, Teams</p>
          </div>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" disabled>
          Notify Me
        </Button>
      </div>
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external services to power your AI agents.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}

function IntegrationsContent() {
  const user = useTenantAuth();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const errorParam = searchParams.get('error');
  const connectedParam = searchParams.get('connected');
  const emailParam = searchParams.get('email');

  useEffect(() => {
    if (errorParam) {
      try {
        setError(atob(errorParam));
      } catch {
        setError('Connection failed');
      }
    }
    if (connectedParam === 'true') {
      setSuccessMessage(emailParam
        ? `Google Workspace connected with ${emailParam}!`
        : 'Google Workspace connected!'
      );
    }
  }, [errorParam, connectedParam, emailParam]);

  const fetchIntegrations = useCallback(async () => {
    try {
      setError(null);
      const data = await integrationsService.listIntegrations();
      setIntegrations(data);
    } catch (err) {
      setError('Failed to load integrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleGoogleConnect = async () => {
    try {
      setActionLoading('google');
      const { url } = await integrationsService.initiateGoogleOAuth();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to initiate Google OAuth', err);
      setError('Failed to start Google authorization');
      setActionLoading(null);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm('Disconnect Google Workspace? Agents will lose access to Gmail, Drive, and Calendar.')) {
      return;
    }
    try {
      setActionLoading('google');
      await integrationsService.disconnectGoogle();
      await fetchIntegrations();
    } catch (err) {
      setError('Failed to disconnect Google');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBrevoConnect = async (apiKey: string) => {
    try {
      setActionLoading('brevo');
      await integrationsService.connectBrevo(apiKey);
      await fetchIntegrations();
      setIntegrations((prev) => prev ? {
        ...prev,
        brevo: { ...prev.brevo, connected: true },
      } : prev);
    } catch (err) {
      setError('Failed to connect Brevo. Check your API key.');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBrevoDisconnect = async () => {
    if (!confirm('Disconnect Brevo? Agent email aliases will stop working.')) {
      return;
    }
    try {
      setActionLoading('brevo');
      await integrationsService.disconnectBrevo();
      setIntegrations((prev) => prev ? {
        ...prev,
        brevo: { ...prev.brevo, connected: false },
      } : prev);
      await fetchIntegrations();
    } catch (err) {
      setError('Failed to disconnect Brevo');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services to power your AI agents.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive"
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-500 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {successMessage}
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      <div>
        <h2 className="text-sm font-medium mb-3">Connected</h2>
        <div className="space-y-3">
          {loading ? (
            <>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              {integrations?.google && (
                <GoogleIntegrationCard
                  integration={integrations.google}
                  onConnect={handleGoogleConnect}
                  onDisconnect={handleGoogleDisconnect}
                  loading={actionLoading === 'google'}
                />
              )}
              <BrevoIntegrationCard
                integration={integrations?.brevo ?? { provider: 'brevo', label: 'Brevo', description: 'Email relay for AI agents', connected: false }}
                onConnect={handleBrevoConnect}
                onDisconnect={handleBrevoDisconnect}
                loading={actionLoading === 'brevo'}
              />
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Available Integrations</h2>
        <div className="space-y-3">
          <SlackIntegrationCard />
          <MicrosoftIntegrationCard />
        </div>
      </div>
    </div>
  );
}
