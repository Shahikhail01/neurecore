/**
 * Phase 11 — shared skill types.
 *
 * SRP: this file owns ONLY the shared value types (SourceRef,
 * SkillOutput, ExtractField, etc). Each skill defines its own
 * task-specific input type at the file boundary.
 */

/**
 * A reference to a content source — one of:
 *   - record        : a typed CRM record
 *   - thread        : a chat/email/inbox thread
 *   - file          : a tenant file (uploaded document) — Phase 12 wires pull-through
 *   - text          : inline raw text
 */
export type SourceRef =
  | { readonly kind: 'record'; readonly recordType: string; readonly recordId: string }
  | { readonly kind: 'thread'; readonly threadId: string }
  | { readonly kind: 'file';   readonly fileId: string }
  | { readonly kind: 'text';   readonly text: string };

/** A citation emitted by a skill — the exact span the claim was sourced from. */
export interface SkillCitation {
  /** Optional record reference when the claim came from a CRM record. */
  readonly recordType?: string;
  readonly recordId?: string;
  /** Optional thread reference. */
  readonly threadId?: string;
  /** Optional file reference. */
  readonly fileId?: string;
  /** Page number, line range, or field locator when applicable. */
  readonly locator: string;
  /** Verbatim excerpt. */
  readonly quote: string;
}

/**
 * Canonical skill result envelope.
 *
 * Tenancy: every record/file/thread reference MUST be tenant-scoped by
 * the executor before the LLM call. Cross-tenant access is a fatal
 * error (AuthorizationError).
 */
export interface SkillOutput<T> {
  /** Primary payload — string for text-output skills, object for extract. */
  readonly content: T;
  /** Source attribution for every claim. May be empty when the skill has no sources. */
  readonly citations: ReadonlyArray<SkillCitation>;
  /** Declared abstentions or limitations. NEVER fabricate certainty. */
  readonly limits: ReadonlyArray<string>;
  /** 0..1 — the executor's parse-and-validate confidence. */
  readonly confidence: number;
  /** Wall-clock duration. */
  readonly durationMs: number;
  /** Skill id — echoes the input descriptor. */
  readonly skillId: string;
}

/** Typed schema entry for the `extract` skill. */
export type ExtractFieldType = 'string' | 'number' | 'date' | 'currency' | 'enum' | 'boolean';

export interface ExtractField {
  readonly type: ExtractFieldType;
  readonly enum?: ReadonlyArray<string>;
  readonly required?: boolean;
  /** Optional regex pattern validation when type='string'. */
  readonly pattern?: string;
}

/** Tone options for the rewrite skill. */
export type RewriteMode = 'tone' | 'shorten' | 'expand';
export type RewriteTone = 'formal' | 'casual' | 'friendly' | 'urgent' | 'neutral';

/** Report output formats. */
export type ReportFormat = 'markdown' | 'html' | 'plain';
