'use client';

/**
 * Phase 29 — SkipLink (CR-AI-1304).
 *
 * WCAG 2.4.1 "Bypass Blocks": a keyboard user must be able to jump
 * past the navigation rail straight to the page content. The link is
 * visually hidden until focused, then rendered as a normal control.
 *
 * SOLID
 *   SRP — owns ONLY the skip affordance.
 *   DIP — the target id is a prop, so a shell with a different main
 *         region reuses the component unchanged.
 */

import { MAIN_CONTENT_ID } from './landmarks';

export interface SkipLinkProps {
  /** id of the element focus should jump to. */
  readonly targetId?: string;
  readonly label?: string;
}

export function SkipLink({
  targetId = MAIN_CONTENT_ID,
  label = 'Skip to main content',
}: SkipLinkProps): React.ReactElement {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
    >
      {label}
    </a>
  );
}
