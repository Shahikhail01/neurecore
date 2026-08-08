/**
 * Phase 29 — Source loading contract (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * SOLID
 *   ISP — a single narrow method. A rule never sees this contract;
 *         only the runner does.
 *   DIP — the runner depends on this abstraction, so the audit can be
 *         driven from the filesystem in CI and from in-memory
 *         fixtures in tests without touching the runner.
 */

import type { A11ySourceDocument } from './IA11yRule';

export interface IA11ySourceLoader {
  load(
    roots: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<A11ySourceDocument>>;
}
