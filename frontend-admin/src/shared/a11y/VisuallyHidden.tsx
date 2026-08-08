'use client';

/**
 * Phase 29 — VisuallyHidden (CR-AI-1304).
 *
 * Renders content that only assistive technology reads. Used to give
 * icon-only controls and data tables the text context sighted users
 * get from layout (WCAG 1.3.1).
 *
 * SOLID
 *   SRP — owns ONLY visual hiding. It reuses `srOnlyStyle` rather
 *         than re-declaring the clip rectangle, so there is exactly
 *         one sr-only implementation in the app.
 */

import { srOnlyStyle } from './index';

export interface VisuallyHiddenProps {
  readonly as?: 'span' | 'div';
  readonly children: React.ReactNode;
}

export function VisuallyHidden({
  as = 'span',
  children,
}: VisuallyHiddenProps): React.ReactElement {
  if (as === 'div') return <div style={srOnlyStyle}>{children}</div>;
  return <span style={srOnlyStyle}>{children}</span>;
}
