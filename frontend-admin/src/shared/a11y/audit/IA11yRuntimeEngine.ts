/**
 * Phase 29 — Runtime a11y engine contract (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * The static audit (backend `A11yAuditRunner`) proves properties of
 * the *source*. This contract covers the other half: properties of
 * the *rendered tree* — computed roles, accessible names, ARIA
 * relationships and focus order that only exist after React renders.
 *
 * SOLID
 *   ISP — a single method.
 *   LSP — `AxeRuntimeEngine` is one implementation; a different
 *         engine (or a stub in a unit test) substitutes it.
 *   DIP — specs and dev tooling depend on this contract, never on
 *         `axe-core` directly.
 */

/** Impact vocabulary, identical to the static engine's severities. */
export type RuntimeImpact = 'critical' | 'serious' | 'moderate' | 'minor';

export interface RuntimeViolation {
  readonly id: string;
  readonly impact: RuntimeImpact;
  readonly help: string;
  readonly wcagTags: ReadonlyArray<string>;
  readonly targets: ReadonlyArray<string>;
}

export interface IA11yRuntimeEngine {
  analyze(root: Element): Promise<ReadonlyArray<RuntimeViolation>>;
}

/** Impacts that fail the G29 gate. */
export const BLOCKING_IMPACTS: ReadonlyArray<RuntimeImpact> = [
  'critical',
  'serious',
];
