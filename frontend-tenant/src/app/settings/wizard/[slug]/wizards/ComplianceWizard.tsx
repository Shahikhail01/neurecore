'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import complianceService from '@/services/compliance.service';
import type { WizardSlug } from '@/lib/wizard/types';

const RETENTION_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
  { value: '365', label: '1 year' },
  { value: '730', label: '2 years' },
  { value: '0', label: 'Indefinite' },
];

export function ComplianceWizard({ slug }: { slug: WizardSlug }) {
  const [dataResidency, setDataResidency] = useState<'auto' | 'us' | 'eu' | 'uk' | 'asia'>('auto');
  const [retentionDays, setRetentionDays] = useState('90');
  const [aupAccepted, setAupAccepted] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [aupAlreadyAcceptedAt, setAupAlreadyAcceptedAt] = useState<string | null>(null);
  const [dpaAlreadyAcceptedAt, setDpaAlreadyAcceptedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  // Hydrate from the backend
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await complianceService.get();
        if (cancelled) return;
        setDataResidency((s.dataResidency as typeof dataResidency) ?? 'auto');
        setRetentionDays(String(s.retentionDays ?? 90));
        if (s.aupAcceptedAt) {
          setAupAlreadyAcceptedAt(s.aupAcceptedAt);
          setAupAccepted(true);
        }
        if (s.dpaAcceptedAt) {
          setDpaAlreadyAcceptedAt(s.dpaAcceptedAt);
          setDpaAccepted(true);
        }
      } catch {
        // best-effort hydration
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
      // 1) Accept AUP/DPA — idempotent; safe to call even if already accepted.
      if (aupAccepted && !aupAlreadyAcceptedAt) {
        await complianceService.acceptAup();
      }
      if (dpaAccepted && !dpaAlreadyAcceptedAt) {
        await complianceService.acceptDpa();
      }
      // 2) Persist residency + retention
      await complianceService.setResidency(dataResidency);
      await complianceService.setRetention(parseInt(retentionDays, 10));
      // 3) Mark the wizard completed
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
      <WizardShell title="Compliance">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Compliance settings saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Compliance" description="Data residency, AUP/DPA acceptance, retention policy.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="residency">Data residency</Label>
              <Select value={dataResidency} onValueChange={(v) => setDataResidency(v as typeof dataResidency)}>
                <SelectTrigger id="residency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (best latency)</SelectItem>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="eu">European Union</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="asia">Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention">Data retention</Label>
              <Select value={retentionDays} onValueChange={setRetentionDays}>
                <SelectTrigger id="retention"><SelectValue /></SelectTrigger>
                <SelectContent>{RETENTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox id="aup" checked={aupAccepted} onCheckedChange={(v) => setAupAccepted(v === true)} disabled={Boolean(aupAlreadyAcceptedAt)} />
              <div className="flex-1">
                <label htmlFor="aup" className="text-sm font-medium cursor-pointer">Acceptable Use Policy</label>
                <p className="text-xs text-muted-foreground">
                  {aupAlreadyAcceptedAt
                    ? `Accepted on ${new Date(aupAlreadyAcceptedAt).toLocaleDateString()}`
                    : 'I have read and agree to the AUP'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Checkbox id="dpa" checked={dpaAccepted} onCheckedChange={(v) => setDpaAccepted(v === true)} disabled={Boolean(dpaAlreadyAcceptedAt)} />
              <div className="flex-1">
                <label htmlFor="dpa" className="text-sm font-medium cursor-pointer">Data Processing Agreement</label>
                <p className="text-xs text-muted-foreground">
                  {dpaAlreadyAcceptedAt
                    ? `Accepted on ${new Date(dpaAlreadyAcceptedAt).toLocaleDateString()}`
                    : 'I have read and agree to the DPA'}
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => void handleSave()} disabled={saving || !aupAccepted || !dpaAccepted}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save & complete
              </Button>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}
