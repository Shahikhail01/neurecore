'use client';

import { useState } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';

export function PreferencesWizard({ slug }: { slug: WizardSlug }) {
  const [digestCadence, setDigestCadence] = useState('daily');
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [theme, setTheme] = useState('dark');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenantsService.updateMine({
        defaultsJson: { digestCadence, quietHours: { start: quietStart, end: quietEnd }, theme },
      } as Record<string, unknown>);
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
      <WizardShell title="Notifications & UX">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Preferences saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Notifications & UX" description="Digest cadence, quiet hours, theme, default landing.">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="digest">Digest cadence</Label>
          <Select value={digestCadence} onValueChange={setDigestCadence}>
            <SelectTrigger id="digest"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quiet-start">Quiet hours start</Label>
            <Select value={quietStart} onValueChange={setQuietStart}>
              <SelectTrigger id="quiet-start"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiet-end">Quiet hours end</Label>
            <Select value={quietEnd} onValueChange={setQuietEnd}>
              <SelectTrigger id="quiet-end"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`).map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="theme">Theme preference</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger id="theme"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save & complete
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
