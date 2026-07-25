'use client';

import { PageShell, PageHero } from '@neurecore/ui-visual';
import { TemplateManager } from '@/components/templates/TemplateManager';

export default function TemplatesPage() {
  return (
    <PageShell variant="default">
      <PageHero
        eyebrow="Settings"
        title="Templates"
        subtitle="Manage your tenant templates for customer lifecycles, agent roles, routines, reports, tasks, and departments."
      />
      <TemplateManager />
    </PageShell>
  );
}
