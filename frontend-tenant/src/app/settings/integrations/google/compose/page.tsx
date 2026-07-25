'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Send, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

import { PageShell, PageHero, GlassPanel } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { integrationsService } from '@/services/integrations.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ComposeEmailPage() {
  const router = useRouter();
  const user = useTenantAuth();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ messageId: string } | null>(null);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSend = async () => {
    setError(null);
    setSuccess(null);

    if (!to.trim()) {
      setError('Recipient email is required');
      return;
    }
    const recipients = to.split(',').map(s => s.trim()).filter(Boolean);
    if (recipients.some(r => !validateEmail(r))) {
      setError('One or more recipient emails are invalid');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!body.trim()) {
      setError('Email body cannot be empty');
      return;
    }

    setSending(true);
    try {
      const result = await integrationsService.sendEmail({
        to: recipients.join(', '),
        subject,
        body,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
      });
      setSuccess({ messageId: result.messageId });
      // Reset form after 2 seconds and redirect
      setTimeout(() => {
        router.push('/settings/integrations/google');
      }, 2000);
    } catch (err: unknown) {
      console.error('Failed to send email', err);
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  if (!user?.tenantId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Please log in.</p>
      </div>
    );
  }

  return (
    <PageShell variant="default">
      <PageHero
        title="Compose Email"
        actions={
          <Link href="/settings/integrations/google" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back to Inbox
          </Link>
        }
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div
          className="border border-[color:var(--state-success)]/30 bg-[color:var(--state-success)]/10 rounded-lg p-3 text-sm text-[color:var(--state-success)] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Email sent successfully! Redirecting to inbox...
        </div>
      )}

      <GlassPanel variant="panel" padding="lg" className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="to">To</Label>
            <button
              type="button"
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showCcBcc ? 'Hide Cc/Bcc' : 'Show Cc/Bcc'}
            </button>
          </div>
          <Input
            id="to"
            placeholder="recipient@example.com (comma-separate multiple)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={sending || !!success}
          />
        </div>

        {showCcBcc && (
          <>
            <div className="space-y-2">
              <Label htmlFor="cc">Cc</Label>
              <Input
                id="cc"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                disabled={sending || !!success}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcc">Bcc</Label>
              <Input
                id="bcc"
                placeholder="bcc@example.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                disabled={sending || !!success}
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            placeholder="What's this about?"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={sending || !!success}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <textarea
            id="body"
            placeholder="Write your email here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={sending || !!success}
            rows={16}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/settings/integrations/google">
            <Button variant="outline" disabled={sending}>Cancel</Button>
          </Link>
          <Button onClick={handleSend} disabled={sending || !!success}>
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Send
              </>
            )}
          </Button>
        </div>
      </GlassPanel>
    </PageShell>
  );
}