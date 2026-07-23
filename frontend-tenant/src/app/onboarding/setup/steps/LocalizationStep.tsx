'use client';

// steps/LocalizationStep.tsx — Tier-1 onboarding step 3.
// Captures timezone + currency (both required for the Home hero to render
// correctly). Date/time format optional with sensible defaults.

import { useState } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { onboardingService } from '@/services/onboarding.service';
import {
  COMMON_TIMEZONES,
  COMMON_CURRENCIES,
} from '@/lib/locale-options';

export interface LocalizationStepProps {
  initialTimezone: string;
  initialCurrency: string;
  onNext: () => void;
  onBack: () => void;
}

export function LocalizationStep({
  initialTimezone,
  initialCurrency,
  onNext,
  onBack,
}: LocalizationStepProps) {
  const [timezone, setTimezone] = useState(initialTimezone || 'UTC');
  const [currency, setCurrency] = useState(initialCurrency || 'USD');
  const [dateFormat, setDateFormat] = useState('medium');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onboardingService.saveCompanyAndLocale({
        timezone,
        currency,
        dateFormat,
        timeFormat,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Localization & currency</h2>
        <p className="text-sm text-muted-foreground mt-1">
          So the home greeting and reports render correctly.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="tz">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cur">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger id="cur">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="df">Date format</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger id="df">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (1/15/26)</SelectItem>
              <SelectItem value="medium">Medium (Jan 15, 2026)</SelectItem>
              <SelectItem value="long">Long (January 15, 2026)</SelectItem>
              <SelectItem value="relative">Relative (2 days ago)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tf">Time format</Label>
          <Select value={timeFormat} onValueChange={setTimeFormat}>
            <SelectTrigger id="tf">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12-hour (3:42 PM)</SelectItem>
              <SelectItem value="24h">24-hour (15:42)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button onClick={() => void handleContinue()} disabled={submitting}>
          Continue <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}