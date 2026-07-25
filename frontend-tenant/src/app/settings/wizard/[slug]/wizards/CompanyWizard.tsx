'use client';

import { useState } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, CheckCircle2, SkipForward } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';

const SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-1000', label: '201-1000 employees' },
  { value: '1001+', label: '1001+ employees' },
];

const BUSINESS_TYPES = [
  { value: 'private', label: 'Private Limited' },
  { value: 'public', label: 'Public Limited' },
  { value: 'nonprofit', label: 'Non-Profit' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'government', label: 'Government' },
  { value: 'other', label: 'Other' },
];

export function CompanyWizard({ slug }: { slug: WizardSlug }) {
  const [website, setWebsite] = useState('');
  const [sizeBucket, setSizeBucket] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phone, setPhone] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenantsService.updateMine({
        website: website || null,
        sizeBucket: sizeBucket || null,
        foundedYear: foundedYear ? parseInt(foundedYear) : null,
        businessType: businessType || null,
        phone: phone || null,
        supportEmail: supportEmail || null,
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
      <WizardShell title="Company Profile">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Company profile saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Company Profile" description="Add your website, address, industry, and size.">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="size">Company size</Label>
            <Select value={sizeBucket} onValueChange={setSizeBucket}>
              <SelectTrigger id="size"><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="founded">Founded year</Label>
            <Input id="founded" value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} placeholder="2020" type="number" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-type">Business type</Label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger id="business-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-1234" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">Support email</Label>
            <Input id="support-email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@acme.com" type="email" />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Save className="w-4 h-4 mr-1" /> Save & complete
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
