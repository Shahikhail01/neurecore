/**
 * Phase 29 — axe-core runtime engine (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29)
 * — "Add axe-core-based audit runner to CI on the tenant + admin
 * apps."
 *
 * Runs only the WCAG 2.0/2.1/2.2 A + AA rule tags, so the report
 * contains conformance failures and not stylistic best practices.
 *
 * SOLID
 *   SRP — owns ONLY the axe invocation and result translation.
 *   LSP — implements `IA11yRuntimeEngine` exactly.
 *   DIP — the axe module is injected (default: the real one), so the
 *         engine is unit-testable without a DOM.
 */

import axe, { type AxeResults, type RunOptions } from 'axe-core';
import type {
  IA11yRuntimeEngine,
  RuntimeImpact,
  RuntimeViolation,
} from './IA11yRuntimeEngine';

/** WCAG 2.2 AA = every A and AA tag axe publishes. */
export const WCAG_22_AA_TAGS: ReadonlyArray<string> = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

type AxeRunner = (
  root: Element,
  options: RunOptions,
) => Promise<AxeResults>;

const defaultRunner: AxeRunner = (root, options) =>
  axe.run(root, options) as Promise<AxeResults>;

export class AxeRuntimeEngine implements IA11yRuntimeEngine {
  constructor(private readonly run: AxeRunner = defaultRunner) {}

  async analyze(root: Element): Promise<ReadonlyArray<RuntimeViolation>> {
    const results = await this.run(root, {
      runOnly: { type: 'tag', values: [...WCAG_22_AA_TAGS] },
      resultTypes: ['violations'],
    });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: (violation.impact ?? 'minor') as RuntimeImpact,
      help: violation.help,
      wcagTags: violation.tags.filter((t) => t.startsWith('wcag')),
      targets: violation.nodes.map((node) => String(node.target[0] ?? '')),
    }));
  }
}
