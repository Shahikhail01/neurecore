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
import {
  COMMON_TIMEZONES,
  COMMON_CURRENCIES,
  COMMON_DATE_FORMATS,
  COMMON_TIME_FORMATS,
} from '@/lib/locale-options';

const LOCALES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'ur-PK', label: 'Urdu (Pakistan)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'ar-AE', label: 'Arabic (UAE)' },
  { code: 'id-ID', label: 'Indonesian (Indonesia)' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja-JP', label: 'Japanese (Japan)' },
];

export function LocalizationWizard({ slug }: { slug: WizardSlug }) {
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');
  const [locale, setLocale] = useState('en-US');
  const [dateFormat, setDateFormat] = useState('medium');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [fiscalYearStart, setFiscalYearStart] = useState('january');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenantsService.updateMine({
        timezone,
        currency,
        locale,
        dateFormat,
        timeFormat,
        fiscalYearStart,
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
      <WizardShell title="Localization & Currency">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Localization saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Localization & Currency" description="Set timezone, locale, currency, and date format.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="tz"><SelectValue /></SelectTrigger>
              <SelectContent>{COMMON_TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="cur"><SelectValue /></SelectTrigger>
              <SelectContent>{COMMON_CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">Locale</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="locale"><SelectValue /></SelectTrigger>
            <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="df">Date format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id="df"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON_DATE_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf">Time format</Label>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger id="tf"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMMON_TIME_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fiscal">Fiscal year start</Label>
          <Select value={fiscalYearStart} onValueChange={setFiscalYearStart}>
            <SelectTrigger id="fiscal"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['january','february','march','april','may','june','july','august','september','october','november','december'].map((m) => (
                <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
              ))}
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
