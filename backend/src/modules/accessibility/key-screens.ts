/**
 * Phase 29 — Certified key screens (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29)
 * — "0 critical/serious violations on key screens (chat, customers,
 * projects, command-center, skills, meetings)".
 *
 * These are the surfaces G29 certifies at zero findings of ANY
 * severity. Everything outside this set is tracked by the repo-wide
 * ratchet in `A11Y_BLOCKING_BASELINE` and may only ever decrease.
 *
 * SOLID
 *   SRP — owns ONLY the scope definition. The runner reads it; the
 *         CLI reads it; neither redefines it.
 *   OCP — certifying a new screen is one entry in this list.
 */

export interface KeyScreen {
  readonly id: string;
  /** POSIX path fragment every file of the screen contains. */
  readonly pathFragment: string;
}

export const KEY_SCREENS: ReadonlyArray<KeyScreen> = [
  { id: 'chat', pathFragment: 'frontend-tenant/src/shared/components/chat/' },
  { id: 'chat-history', pathFragment: 'frontend-tenant/src/app/chat-history/' },
  { id: 'customers', pathFragment: 'frontend-tenant/src/app/customers/' },
  { id: 'projects', pathFragment: 'frontend-tenant/src/app/projects/' },
  {
    id: 'command-center',
    pathFragment: 'frontend-tenant/src/app/command-center/',
  },
  {
    id: 'command-center-admin',
    pathFragment: 'frontend-admin/src/app/command-center/',
  },
  { id: 'skills', pathFragment: 'frontend-tenant/src/app/skills/' },
  { id: 'meetings', pathFragment: 'frontend-tenant/src/app/meetings/' },
];

/** True when the path belongs to a certified key screen. */
export function isKeyScreenPath(path: string): boolean {
  const normalised = path.split('\\').join('/');
  return KEY_SCREENS.some((screen) => normalised.includes(screen.pathFragment));
}

/**
 * Repo-wide ratchet. Recorded 2026-08-08 from the first full audit
 * after the P29 key-screen remediation. The G29 gate fails if the
 * repository-wide blocking count exceeds it, so the backlog outside
 * the certified screens can only ever shrink.
 *
 * This number is intentionally published rather than hidden: it is
 * the honest, measured size of the remaining WCAG backlog.
 */
export const A11Y_BLOCKING_BASELINE = 342;
