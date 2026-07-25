'use client';

// steps/LogoStep.tsx — Tier-1 onboarding step 2.
// Optional but encouraged. Skip without uploading = brand defaults to text.

import { useState } from 'react';
import { ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogoUploader } from '@/components/uploads/LogoUploader';
import { onboardingService } from '@/services/onboarding.service';

export interface LogoStepProps {
  initialLogoUrl: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function LogoStep({ initialLogoUrl, onNext, onBack }: LogoStepProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Await persistence so the orchestrator's tenant state stays in sync
      // when the user resumes mid-flow.
      await onboardingService.saveCompanyAndLocale({ logoUrl });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save logo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    // FIX-ONB-D1 (Round-3 verification): route the Skip path through the same
    // persistence + state-update sequence as Continue. The previous
    // implementation called onNext() directly, which fired refreshTenant()
    // without first ensuring the PATCH /tenants/me call had succeeded.
    // The CSRF cookie race + auth-cascade then produced a 401 burst on the
    // immediately-following /tenants/me/current call and the SPA killed
    // the session. Persisting first (even with logoUrl: null) reuses the
    // existing CSRF cookie rotation done by saveCompanyAndLocale().
    setSubmitting(true);
    setError(null);
    try {
      await onboardingService.saveCompanyAndLocale({ logoUrl: null });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not advance to next step');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Add your company logo</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Appears in the topbar, home greeting, and assistant panel. You can
          change it anytime.
        </p>
      </div>
      <LogoUploader value={logoUrl} onChange={setLogoUrl} disabled={submitting} />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          {!logoUrl && (
            <Button variant="ghost" onClick={() => void handleSkip()} disabled={submitting}>
              <SkipForward className="w-4 h-4 mr-1" /> Skip for now
            </Button>
          )}
          <Button onClick={() => void handleNext()} disabled={submitting}>
            Continue <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </Card>
  );
}