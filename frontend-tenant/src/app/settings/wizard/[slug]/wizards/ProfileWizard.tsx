'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { meService } from '@/services/me.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';
import { COMMON_TIMEZONES } from '@/lib/locale-options';

export function ProfileWizard({ slug }: { slug: WizardSlug }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [personalTz, setPersonalTz] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  // Hydrate from API
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await meService.profile.get();
        if (cancelled || !profile) return;
        setFirstName(profile.firstName ?? '');
        setLastName(profile.lastName ?? '');
        setPhone(profile.phone ?? '');
        setJobTitle(profile.jobTitle ?? '');
        if (profile.timezone) setPersonalTz(profile.timezone);
      } catch {
        // Hydration is best-effort; the user can still save fresh values.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await meService.profile.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || null,
        jobTitle: jobTitle.trim() || null,
        timezone: personalTz,
      });
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
      <WizardShell title="Your Profile">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Profile saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Your Profile" description="Avatar, phone, job title, and personal timezone.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-1234" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-title">Job title</Label>
                <Input id="job-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="CEO" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tz">Personal timezone</Label>
              <Select value={personalTz} onValueChange={setPersonalTz}>
                <SelectTrigger id="tz"><SelectValue /></SelectTrigger>
                <SelectContent>{COMMON_TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save & complete
              </Button>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}

