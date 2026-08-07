/**
 * Phase 11 — Skill abstractions.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md.
 *
 * SRP: this file owns ONLY the typed contracts. Implementations live in
 * skill-registry/skills/*.skill.ts. The executor lives in
 * skill-executor.service.ts. The chat dispatcher lives in ChatService.
 *
 * Three interfaces, separated per ISP:
 *   - ISkill<I, O>                   — execute
 *   - ISkillWithCitations            — optional citation emission
 *   - ISkillWithSchemaValidation<T>  — optional Zod-like output schema
 *
 * Consumers (SkillRegistry, ChatService, ChatPanel FE) depend on the
 * narrowest interface that meets their flow.
 */

import type { TenantContext } from '../../../common/context/tenant-context';
import type { SourceRef, SkillOutput } from './skill.types';

/** Canonical skill id — same value as the registry's `SkillDescriptor.id`. */
export type SkillId =
  | 'summarize'
  | 'rewrite'
  | 'translate'
  | 'extract'
  | 'compare'
  | 'draft-report'
  | 'draft-email'
  // Phase 12 — knowledge-grounded generative skills.
  | 'article-draft'
  | 'knowledge-health'
  // Phase 13 — NL-driven skill graph drafting (never activates).
  | 'nl-draft'
  // Phase 19 — Marketing / Service skills.
  | 'segment'
  | 'campaign-brief'
  | 'case-resolve'
  | 'case-response'
  // Phase 20 — CRM-event-driven skills.
  | 'crm-event'
  | 'crm-webhook';

/**
 * Tenant-scoped execution context. Aliased to the canonical TenantContext
 * from the common module so we do not duplicate identity fields.
 */
export type SkillExecutionContext = TenantContext;

/**
 * Base skill contract — every skill implements this.
 *
 * Inputs are validated by the registry BEFORE the skill is dispatched.
 * Outputs are typed and pass through the executor's telemetry hook.
 */
export interface ISkill<I, O> {
  readonly id: SkillId;
  /** Human-readable skill display name. */
  readonly displayName: string;
  /** Short marketing-style description (1 line). */
  readonly shortDescription: string;

  /** Zod-style input schema — runtime validation lives in the registry. */
  validateInput(input: unknown): input is I;

  /**
   * Build the typed prompt envelope the executor will use.
   *
   * Implementations MUST:
   *   1. refuse inputs whose SourceRefs do not belong to ctx.tenantId
   *      (or carry an empty id);
   *   2. attach citations for any record/file-derived claim;
   *   3. declare abstentions in `SkillPrompt.limits` instead of guessing;
   *   4. defer LLM invocation to the executor (no provider imports).
   */
  buildPrompt(
    input: I,
    ctx: SkillExecutionContext,
  ): { prompt: import('../skill-prompt').SkillPrompt<O>; options?: import('../skill-executor.service').ExecutorOptions };

  /**
   * Execute the skill directly. The default implementation delegates
   * to buildPrompt + executor — kept on the interface so skills can
   * opt out of the standard executor flow when needed (e.g. compare
   * with structured diff instead of LLM diff).
   *
   * Most skills should NOT override this; bind(buildPrompt) suffices.
   */
  execute?(input: I, ctx: SkillExecutionContext): Promise<SkillOutput<O>>;
}

/** Optional — only for skills that emit source-attributed claims. */
export interface ISkillWithCitations {
  /** True iff the skill declares citations in its output. */
  readonly emitsCitations: true;
}

/** Optional — only for skills whose output is a typed object (extract). */
export interface ISkillWithSchemaValidation<T> {
  /** Runtime validator for the content payload. */
  validateOutput(output: unknown): output is T;
}

/** Re-exports for convenience. */
export type { SourceRef, SkillOutput };
