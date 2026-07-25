'use client';

import { useState } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, X, Mail } from 'lucide-react';
import { onboardingService } from '@/services/onboarding.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';

interface InviteEntry {
  email: string;
  role: 'USER' | 'ADMIN';
}

export function TeamWizard({ slug }: { slug: WizardSlug }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const addInvite = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    if (invites.some((i) => i.email === trimmed)) return;
    setInvites([...invites, { email: trimmed, role }]);
    setEmail('');
  };

  const removeInvite = (idx: number) => {
    setInvites(invites.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (invites.length === 0) {
      await storeComplete(slug);
      setCompleted(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onboardingService.inviteMembers(invites);
      await storeComplete(slug);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <WizardShell title="Invite Team">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">
            {invites.length > 0 ? 'Invitations sent!' : 'Skipped team invitations.'}
          </p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Invite Team" description="Bulk-invite teammates with role assignments.">
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@acme.com"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInvite(); } }}
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'USER' | 'ADMIN')}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="invisible">Add</Label>
            <Button variant="outline" onClick={addInvite} disabled={!email.trim()}>
              Add
            </Button>
          </div>
        </div>

        {invites.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{invites.length} teammate(s) to invite</p>
            {invites.map((inv, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm">{inv.email}</span>
                  <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                </div>
                <button onClick={() => removeInvite(i)} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleSend()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {invites.length > 0 ? 'Send invites & complete' : 'Skip & complete'}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
