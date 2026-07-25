'use client';

// components/wizard/WizardShell.tsx — Page chrome for all 11 sub-wizards.
//
// Now composed from the global @neurecore/ui-visual primitives — single
// source of truth for all visual chrome across the monorepo.

import type { ReactNode } from 'react';
import { GlassPanel, GradientText } from '@neurecore/ui-visual';

export interface WizardShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function WizardShell({ title, description, children }: WizardShellProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <GlassPanel variant="panel" padding="lg" className="w-full">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            <GradientText>{title}</GradientText>
          </h1>
          {description && (
            <p className="mt-1 text-sm text-zinc-400">{description}</p>
          )}
        </div>
        <div>{children}</div>
      </GlassPanel>
    </div>
  );
}