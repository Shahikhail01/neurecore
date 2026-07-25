'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Loader2, CheckCircle2, Shield, Key, QrCode, XCircle } from 'lucide-react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import meService from '@/services/me.service';
import type { WizardSlug } from '@/lib/wizard/types';

type TwoFactorStep = 'idle' | 'initiated' | 'enabling' | 'enabled';

export function SecurityWizard({ slug }: { slug: WizardSlug }) {
  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStep>('idle');
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');

  // Disable 2FA
  const [disablePassword, setDisablePassword] = useState('');

  // Session timeout
  const [sessionTimeout, setSessionTimeout] = useState('60');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordChangeDone, setPasswordChangeDone] = useState(false);

  // Submit state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  // Hydrate security status
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await meService.security.status();
        if (cancelled) return;
        setTwoFactorEnabled(Boolean(s.twoFactor?.enabled));
        setTwoFactorStep(s.twoFactor?.enabled ? 'enabled' : 'idle');
        setSessionTimeout(String(s.sessionTimeoutMinutes ?? 60));
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleStartEnable = async () => {
    try {
      const r = await meService.security.init2fa();
      setSecret(r.secret);
      setOtpauthUri(r.otpauthUri);
      setTwoFactorStep('initiated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start 2FA setup.');
    }
  };

  const handleVerifyEnable = async () => {
    if (!/^\d{6}$/.test(verifyCode)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await meService.security.enable2fa(verifyCode);
      setTwoFactorEnabled(true);
      setTwoFactorStep('enabled');
      setVerifyCode('');
      setOtpauthUri(null);
      setSecret(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify code.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword) {
      setError('Enter your password to disable 2FA.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await meService.security.disable2fa(disablePassword);
      setTwoFactorEnabled(false);
      setTwoFactorStep('idle');
      setDisablePassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable 2FA. Wrong password?');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      setError('Enter your current password and a new password (≥ 8 chars).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await meService.security.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordChangeDone(true);
      setTimeout(() => setPasswordChangeDone(false), 4_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSessionTimeoutChange = async (value: string) => {
    setSessionTimeout(value);
    try {
      await meService.security.update({ sessionTimeoutMinutes: Number(value) });
    } catch {
      // Non-critical — settings can be saved again on the next save click.
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Persist final session timeout (idempotent)
      await meService.security.update({ sessionTimeoutMinutes: Number(sessionTimeout) });
      await storeComplete(slug);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <WizardShell title="Security">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Security settings saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Security" description="Enable 2FA, configure session timeout, change your password.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ─── 2FA Section ─────────────────────────────────────────── */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">
                    {twoFactorEnabled ? 'Enabled — your account requires a TOTP code at login.' : 'Add a TOTP-based second factor.'}
                  </p>
                </div>
                <Badge type={twoFactorEnabled ? 'default' : 'secondary'}>
                  {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {!twoFactorEnabled && twoFactorStep === 'idle' && (
                <Button size="sm" variant="outline" onClick={() => void handleStartEnable()}>
                  <Key className="w-3 h-3 mr-1" /> Set up 2FA
                </Button>
              )}

              {!twoFactorEnabled && twoFactorStep === 'initiated' && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Scan the QR code with your authenticator app, or paste the secret manually:
                  </p>
                  <code className="block text-xs font-mono bg-background p-2 rounded break-all">
                    {otpauthUri}
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Manual entry key: <span className="font-mono">{secret}</span>
                  </p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="verify-code" className="text-xs">6-digit code</Label>
                      <Input
                        id="verify-code"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </div>
                    <Button size="sm" onClick={() => void handleVerifyEnable()} disabled={saving}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify & enable'}
                    </Button>
                  </div>
                </div>
              )}

              {twoFactorEnabled && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    To disable, enter your password:
                  </p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="disable-pw" className="text-xs">Password</Label>
                      <Input
                        id="disable-pw"
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleDisable()} disabled={saving}>
                      <XCircle className="w-3 h-3 mr-1" /> Disable
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* ─── Session Timeout ──────────────────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="session">Session timeout (minutes)</Label>
              <Select value={sessionTimeout} onValueChange={handleSessionTimeoutChange}>
                <SelectTrigger id="session"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">You'll be signed out after this period of inactivity.</p>
            </div>

            {/* ─── Change Password ───────────────────────────────────────── */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-2">Change password</p>
              <div className="space-y-2">
                <Input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" type="password" />
                <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (≥ 8 chars)" type="password" />
                <div className="flex items-center justify-between gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handleChangePassword()} disabled={saving}>
                    {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Update password
                  </Button>
                  {passwordChangeDone && (
                    <span className="text-xs text-[color:var(--state-success)] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Updated
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <Shield className="w-4 h-4 mr-1" /> Save & complete
              </Button>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}

// Lightweight inline badge (avoids import of internal Badge)
function Badge({ type, children }: { type: 'default' | 'secondary'; children: React.ReactNode }) {
  return (
    <span
      className={
        type === 'default'
          ? 'inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary'
          : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
      }
    >
      {children}
    </span>
  );
}
