'use client';

// app/settings/wizard/[slug]/page.tsx — Generic route for each of the 13
// progressive onboarding wizards. Renders the appropriate form content per slug
// using the WizardShell component. Each wizard wires save/complete/skip to the
// existing checklist service endpoints.

import { useParams } from 'next/navigation';
import { PageShell, PageHero } from '@neurecore/ui-visual';
import { WizardShell } from '@/components/wizard/WizardShell';
import { WIZARD_SLUGS } from '@/lib/wizard/types';
import type { WizardSlug } from '@/lib/wizard/types';
import { CompanyWizard } from './wizards/CompanyWizard';
import { LocalizationWizard } from './wizards/LocalizationWizard';
import { BillingWizard } from './wizards/BillingWizard';
import { ProfileWizard } from './wizards/ProfileWizard';
import { PreferencesWizard } from './wizards/PreferencesWizard';
import { SecurityWizard } from './wizards/SecurityWizard';
import { AiOpsWizard } from './wizards/AiOpsWizard';
import { OrgWizard } from './wizards/OrgWizard';
import { IntegrationsWizard } from './wizards/IntegrationsWizard';
import { ComplianceWizard } from './wizards/ComplianceWizard';
import { TeamWizard } from './wizards/TeamWizard';
import { GoogleWorkspaceWizard } from './wizards/GoogleWorkspaceWizard';
import { BrevoWizard } from './wizards/BrevoWizard';

const WIZARD_COMPONENTS: Record<string, React.ComponentType<{ slug: WizardSlug }>> = {
  company: CompanyWizard,
  localization: LocalizationWizard,
  billing: BillingWizard,
  profile: ProfileWizard,
  preferences: PreferencesWizard,
  security: SecurityWizard,
  'ai-ops': AiOpsWizard,
  org: OrgWizard,
  integrations: IntegrationsWizard,
  compliance: ComplianceWizard,
  team: TeamWizard,
  'google-workspace': GoogleWorkspaceWizard,
  brevo: BrevoWizard,
};

export default function WizardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as WizardSlug | undefined;

  if (!slug || !WIZARD_SLUGS.includes(slug)) {
    return (
      <PageShell variant="default">
        <p className="text-sm text-destructive">Unknown wizard: {String(slug)}</p>
      </PageShell>
    );
  }

  const WizardComponent = WIZARD_COMPONENTS[slug];

  return (
    <PageShell variant="default">
      <PageHero
        eyebrow="Settings"
        title={slug
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' ')}
        subtitle="Configure this setting from its dedicated page."
      />
      {WizardComponent ? (
        <WizardComponent slug={slug} />
      ) : (
        <WizardShell
          title={slug
            .split('-')
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(' ')}
          description="Configure this setting from its dedicated page."
        >
          <p className="text-sm text-muted-foreground">
            This wizard&apos;s form is not yet implemented. Please configure it from the
            relevant settings page.
          </p>
        </WizardShell>
      )}
    </PageShell>
  );
}
