/**
 * Phase 11 — SkillPrompt envelope.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md §2.
 *
 * Owns ONLY the prompt payload passed from a skill to the executor.
 * Includes both the typed instructions AND the parser that turns
 * raw model output into the skill-declared output type.
 *
 * SRP:
 *   - No LLM calls (executor owns that).
 *   - No telemetry (executor owns that).
 *   - No provider choice (`capability` is a hint to the executor).
 *
 * DIP:
 *   - `parse` is a callback supplied by the skill; the executor does
 *     not need to know the output schema.
 */

import type { Capability } from '../ai-gateway/domain/capabilities';
import type { SourceRef, SkillCitation } from './interfaces/skill.types';

export interface SkillPrompt<TParsed = unknown> {
  /** Skill id, echos the descriptor. */
  readonly skillId: string;

  /**
   * Capability hint forwarded to the gateway's resolver.
   *
   * Allowed values are the canonical capabilities declared in
   * ai-gateway/domain/capabilities. Skills that need a domain-specific
   * capability (extraction, communication, generation, analysis)
   * map onto the canonical ones via SkillExecutor.canonicalCapability.
   */
  readonly capability?: Capability;

  /** System instruction (the "you are a careful summarizer…" preamble). */
  readonly systemInstruction: string;

  /** User instruction (the "summarize this for an executive" line). */
  readonly userInstruction: string;

  /** Source refs to be resolved and prepended to the user content. */
  readonly sources: ReadonlyArray<SourceRef>;

  /** Default model output ceiling. */
  readonly maxTokens?: number;

  /** When true, the gateway forces JSON response format. */
  readonly responseJsonRequired: boolean;

  /** Declared abstentions / limits the skill wants surfaced. */
  readonly limits?: ReadonlyArray<string>;

  /**
   * Parse raw model output into the skill-declared output type.
   *
   * Skills that target text (summarize, rewrite, translate,
   * draft-email, draft-report) parse JSON `{ content, limits? }`
   * gracefully when available, falling back to `{ content: raw }`.
   *
   * Skills that target structured data (extract) run a Zod schema here.
   */
  parse: (raw: string) => TParsed;

  /** Optional confidence calibration. Default = 1 (no calibration). */
  confidenceFor?: (parsed: TParsed) => number;
}

/**
 * Build a citation envelope from a SourceRef. The executor uses this
 * helper to avoid each skill re-implementing the same boilerplate.
 */
export function buildSkillCitation(source: SourceRef): SkillCitation {
  switch (source.kind) {
    case 'record':
      return {
        recordType: source.recordType,
        recordId: source.recordId,
        locator: `${source.recordType}:${source.recordId}`,
        quote: '',
      };
    case 'thread':
      return {
        threadId: source.threadId,
        locator: `thread:${source.threadId}`,
        quote: '',
      };
    case 'file':
      return {
        fileId: source.fileId,
        locator: `file:${source.fileId}`,
        quote: '',
      };
    case 'text':
      return { locator: 'inline', quote: source.text };
  }
}

/**
 * Parse a free-form (non-JSON) model reply.
 * Skills like summarize, rewrite, translate, draft-email, draft-report
 * receive markdown or plain text — the executor wraps the parse callback.
 */
export function parseTextReply(raw: string): { content: string; limits: string[] } {
  // Try JSON first (the structured path).
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj['content'] === 'string') {
        const limits = Array.isArray(obj['limits'])
          ? (obj['limits'] as unknown[]).filter((l): l is string => typeof l === 'string')
          : [];
        return { content: obj['content'], limits };
      }
    }
  } catch {
    // fall through
  }
  return { content: raw, limits: [] };
}

/** Apply limits to a parse result (use after parseTextReply). */
export function withLimits(parsed: { content: string; limits: string[] }, extra: ReadonlyArray<string>): { content: string; limits: string[] } {
  return { content: parsed.content, limits: [...parsed.limits, ...extra] };
}
