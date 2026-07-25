'use client';

import { useState } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, SkipForward } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';

const INVOICE_CADENCES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

export function BillingWizard({ slug }: { slug: WizardSlug }) {
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [invoiceCadence, setInvoiceCadence] = useState('monthly');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressCountry, setAddressCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenantsService.updateMine({
        billingProfileJson: {
          taxId,
          contactName,
          contactEmail,
          invoiceCadence,
          address: {
            line1: addressLine1,
            city: addressCity,
            country: addressCountry,
          },
        },
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
      <WizardShell title="Billing Profile">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Billing profile saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Billing Profile" description="Tax ID, billing contact, payment method, and invoice cadence.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tax-id">Tax ID / VAT Number</Label>
            <Input id="tax-id" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="US-XX-XXXXX" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-cadence">Invoice cadence</Label>
            <Select value={invoiceCadence} onValueChange={setInvoiceCadence}>
              <SelectTrigger id="invoice-cadence"><SelectValue /></SelectTrigger>
              <SelectContent>{INVOICE_CADENCES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="billing-contact">Billing contact name</Label>
            <Input id="billing-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing-email">Billing email</Label>
            <Input id="billing-email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="billing@acme.com" type="email" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="addr1">Billing address</Label>
          <Input id="addr1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 Main St" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="New York" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input id="country" value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} placeholder="US" />
          </div>
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
