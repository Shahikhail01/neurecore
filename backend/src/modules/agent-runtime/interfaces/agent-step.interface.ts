/**
 * Phase 23 — narrow step contracts used by individual executors.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §4 (P23) —
 * "ISP — narrow step contracts: IClarifyStep, ISearchStep, IDraftStep,
 * IWriteStep, IScoringStep".
 *
 * SOLID — ISP:
 *   Each executor composes the steps it needs; consumers depend only
 *   on the specific step interface, never on a god `run(ctx)`.
 *
 * SOLID — DIP:
 *   The step implementations inject the SkillRegistry / Prisma
 *   collaborators; they are not `new`'d inside executors.
 */

import type { TenantContext } from '../../../common/context/tenant-context';

// ──────────────────────────────────────────────────────────────
// IClarifyStep — typed, permission-safe clarification request.
// ──────────────────────────────────────────────────────────────

export interface ClarifyRequest {
  readonly intent: string;
  readonly reason: 'unsupported_intent' | 'missing_field' | 'ambiguous_target';
  readonly missingFields?: ReadonlyArray<string>;
}

export interface ClarifyResult {
  readonly prompt: string;
  readonly suggestions: ReadonlyArray<string>;
}

export interface IClarifyStep {
  clarify(req: ClarifyRequest): ClarifyResult;
}

// ──────────────────────────────────────────────────────────────
// ISkillStep — wraps SkillRegistry.dispatch so executors depend on
// this narrow contract instead of the whole SkillRegistry surface.
// ──────────────────────────────────────────────────────────────

export interface SkillStepResult {
  readonly output: string;
  readonly confidence: number;
  readonly citationsCount: number;
  readonly durationMs: number;
}

export interface ISkillStep {
  invoke(
    skillKey: string,
    input: unknown,
    ctx: TenantContext,
  ): Promise<SkillStepResult>;
}

// Suppress unused-import warning when the TenantContext type is only
// referenced as a structural shape.
export type _SkillStepCtx = TenantContext;

// ──────────────────────────────────────────────────────────────
// IWriteStep — every mutating write goes through here. Approval is
// checked BEFORE the write; the runtime never bypasses permission.
// ──────────────────────────────────────────────────────────────

export interface WriteRequest {
  readonly skillKey: string;
  readonly input: unknown;
  readonly tenantContext: TenantContext;
}

export interface WriteResult {
  readonly approved: boolean;
  /** Human-readable outcome. When approval is required this is the
   *  pending-approval message; when approved it is the skill output. */
  readonly output: string;
  readonly confidence: number;
  readonly citationsCount: number;
  readonly durationMs: number;
}

export interface IWriteStep {
  /**
   * Routes the mutating request through the approval chain when the
   * skill is approval-sensitive. Returns `approved: false` with a
   * human-readable message when approval is required; never writes.
   * When the skill is not approval-sensitive it delegates directly to
   * the underlying skill and returns `approved: true`.
   */
  submit(req: WriteRequest): Promise<WriteResult>;
}
