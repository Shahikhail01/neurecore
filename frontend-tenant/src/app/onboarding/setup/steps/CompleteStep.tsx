'use client';

// steps/CompleteStep.tsx — Initial onboarding final step.
// Triggers POST /onboarding/complete (seeds checklist, sets
// onboardingCompletedAt) and shows a preview of the Setup Center phases
// that await the user after they enter the portal.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, ArrowRight, Sparkles, Lock, Shield, Globe, Mail, Bot, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { onboardingService } from '@/services/onboarding.service';

interface PhasePreview {
  icon: React.ReactNode;
  label: string;
  items: string;
  description: string;
}

const PHASES: PhasePreview[] = [
  {
    icon: <Shield className="w-3.5 h-3.5" />,
    label: 'Foundation',
    items: 'Company, Localization, Security',
    description: 'Essential settings',
  },
  {
    icon: <Mail className="w-3.5 h-3.5" />,
    label: 'Communication',
    items: 'Google Workspace, Brevo',
    description: 'Connect your tools',
  },
  {
    icon: <Bot className="w-3.5 h-3.5" />,
    label: 'Operations',
    items: 'AI & Ops, Integrations',
    description: 'Configure AI & services',
  },
  {
    icon: <Building2 className="w-3.5 h-3.5" />,
    label: 'Team & Admin',
    items: 'Billing, Team, Profiles, Org',
    description: 'Team & admin setup',
  },
  {
    icon: <Sparkles className="w-3.5 h-3.5" />,
    label: 'Polish',
    items: 'Preferences, Compliance',
    description: 'Fine-tune your experience',
  },
];

export function CompleteStep() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onboardingService.complete();
      setCompleted(true);
      setTimeout(() => router.push('/home'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish.');
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <Card className="p-8 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 mx-auto text-[color:var(--state-success)]" />
        <h2 className="text-xl font-semibold">Welcome to NeureCore!</h2>
        <p className="text-sm text-muted-foreground">Redirecting to your portal...</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="text-center space-y-2">
        <CheckCircle2 className="w-12 h-12 mx-auto text-[color:var(--state-success)]" />
        <h2 className="text-xl font-semibold">Almost there!</h2>
        <p className="text-sm text-muted-foreground">
          Your workspace is set up. Complete these remaining steps from your
          home page to fully configure NeureCore.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Setup progress</span>
          <span className="text-xs text-muted-foreground">~20% complete</span>
        </div>
        <Progress value={20} className="h-1.5" />
      </div>

      <div className="space-y-1.5">
        {PHASES.map((phase) => (
          <div
            key={phase.label}
            className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2"
          >
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              {phase.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{phase.label}</p>
              <p className="text-xs text-muted-foreground">{phase.items}</p>
            </div>
            <span className="text-xs text-muted-foreground">{phase.description}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-center pt-2">
        <Button onClick={() => void handleFinish()} disabled={submitting} size="lg">
          {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Open portal <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
