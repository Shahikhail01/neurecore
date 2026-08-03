/**
 * NeureCore Harness - Prompt Registry (Phase 4)
 *
 * Implements the §9 "Prompt" row and §10 Phase 4 deliverable:
 *   "Prompt registry and lineage ... immutable versions, lineage, canary
 *    comparison, rollback and secret scanning."
 *
 * §5.2 invariants enforced here:
 *   - "Immutable raw evidence; corrections create new versions or annotations."
 *   - "No secrets, credentials, raw tokens, unnecessary personal data, or
 *      hidden chain-of-thought in evidence."
 *   - "Explicit provenance for ... prompt, policy, ..., dataset ..."
 *   - "Fail closed for authorization, policy, evidence integrity, and release
 *      verdicts."
 *
 * SOLID alignment:
 *   - SRP: prompt registry only; no model / eval / RAG logic.
 *   - OCP: new prompt kinds and scan rules register without core changes.
 *   - DIP: ports only (no Prisma / Redis / external HTTP imports).
 *
 * Document ID: NC-HARNESS-PROMPT-001
 * Version: 1.0
 * Status: PHASE_4_IMPLEMENTED
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import {
  UuidSchema,
  IsoDateTimeSchema,
  SemverSchema,
  Sha256ChecksumSchema,
  type AuthorizationContext,
} from '../contracts';

// ============================================================
// VERSION & METADATA
// ============================================================

export const PROMPT_VERSION = '1.0.0';
export const PROMPT_COMPATIBILITY_POLICY =
  'strict-v1: additive-variable = minor, required-variable-removed = major, maxTokens-tightened = major';

export const PromptKindSchema = z.enum([
  'SYSTEM',
  'USER_TEMPLATE',
  'TOOL_DESCRIPTION',
  'CHAT_GREETING',
  'CHAT_HANDOFF',
  'CLASSIFIER',
  'EVALUATION',
]);
export type PromptKind = z.infer<typeof PromptKindSchema>;

export const PromptVariableSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(
        /^[a-zA-Z_][a-zA-Z0-9_]*$/,
        'variable name must be a valid identifier',
      ),
    description: z.string().min(1),
    required: z.boolean().default(true),
    type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON']),
    defaultValue: z.unknown().optional(),
  })
  .strict();
export type PromptVariable = z.infer<typeof PromptVariableSchema>;

export const PromptVersionSchema = z
  .object({
    schemaVersion: SemverSchema,
    promptId: z.string().min(1),
    version: SemverSchema,
    kind: PromptKindSchema,
    /** Imperative title visible in the UI. */
    title: z.string().min(1),
    /** Plain-language description of the prompt's purpose. */
    description: z.string().min(1),
    /** Owner team / actor. */
    owner: z.string().min(1),
    /** The actual prompt body, with {{variable}} placeholders. */
    template: z.string().min(1),
    /** Declared variables; renderer must reject undeclared variables. */
    variables: z.array(PromptVariableSchema).default([]),
    /** Optional anti-patterns and safety rules in natural language. */
    safetyRules: z.array(z.string().min(1)).default([]),
    /** Required model features (e.g. "json_mode", "tool_use"). */
    requiredModelFeatures: z.array(z.string().min(1)).default([]),
    /** Token ceiling enforced at render time. */
    maxTokens: z.number().int().positive().default(4096),
    /** SHA-256 of the canonical template (post-canonicalization). */
    contentChecksum: Sha256ChecksumSchema,
    /** Hash of secret-scan plus injection-scan output. */
    scanChecksum: Sha256ChecksumSchema,
    /** Provenance. */
    createdAt: IsoDateTimeSchema,
    createdBy: z.string().min(1),
    /** §5.2 line of custody. */
    approvalChain: z
      .array(
        z.object({
          approverId: z.string().min(1),
          approvedAt: IsoDateTimeSchema,
          role: z.enum(['AUTHOR', 'REVIEWER', 'SECURITY', 'DOMAIN_OWNER']),
          note: z.string().optional(),
        }),
      )
      .default([]),
    /** Status; only ACTIVE / DRAFT can be referenced from a scenario. */
    status: z.enum(['DRAFT', 'ACTIVE', 'DEPRECATED', 'REVOKED']),
    /** Pointer to the prompt version this one supersedes, if any. */
    supersedes: SemverSchema.optional(),
    /** Tags for query / grouping. */
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((p, ctx) => {
    // §5.2 tokens ceiling must be reasonable.
    if (p.maxTokens > 32768) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxTokens exceeds harness ceiling of 32768',
      });
    }
    // Variables referenced in template must be declared.
    const declared = new Set(p.variables.map((v) => v.name));
    const referenced = extractVariableNames(p.template);
    for (const name of referenced) {
      if (!declared.has(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `template references undeclared variable: ${name}`,
        });
      }
    }
    // Required variable default, if present, must be type-compatible.
    for (const v of p.variables) {
      if (v.defaultValue === undefined) continue;
      switch (v.type) {
        case 'STRING':
          if (typeof v.defaultValue !== 'string') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `defaultValue for ${v.name} must be string`,
            });
          }
          break;
        case 'NUMBER':
          if (
            typeof v.defaultValue !== 'number' ||
            !Number.isFinite(v.defaultValue)
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `defaultValue for ${v.name} must be finite number`,
            });
          }
          break;
        case 'BOOLEAN':
          if (typeof v.defaultValue !== 'boolean') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `defaultValue for ${v.name} must be boolean`,
            });
          }
          break;
        case 'JSON':
          if (typeof v.defaultValue !== 'object' || v.defaultValue === null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `defaultValue for ${v.name} must be a JSON value`,
            });
          }
          break;
      }
    }
  });
export type PromptVersion = z.infer<typeof PromptVersionSchema>;

export const PromptLineageEdgeSchema = z
  .object({
    fromPromptId: z.string().min(1),
    fromVersion: SemverSchema,
    toPromptId: z.string().min(1),
    toVersion: SemverSchema,
    relation: z.enum([
      'SUPERSEDES',
      'DERIVED_FROM',
      'CANARY_OF',
      'ROLLED_BACK_TO',
    ]),
    reason: z.string().min(1),
    actorId: z.string().min(1),
    at: IsoDateTimeSchema,
  })
  .strict();
export type PromptLineageEdge = z.infer<typeof PromptLineageEdgeSchema>;

// ============================================================
// SCANS (§9 Prompt row: "secret/injection scanning")
// ============================================================

export const ScanFindingSeveritySchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
]);
export type ScanFindingSeverity = z.infer<typeof ScanFindingSeveritySchema>;

export const ScanFindingCategorySchema = z.enum([
  'SECRET',
  'INJECTION',
  'PII',
  'CHAIN_OF_THOUGHT',
  'UNSAFE_TEMPLATE',
  'TOKEN_LEAK',
  'OFFENSIVE',
]);
export type ScanFindingCategory = z.infer<typeof ScanFindingCategorySchema>;

export const ScanFindingSchema = z
  .object({
    code: z.string().min(1),
    category: ScanFindingCategorySchema,
    severity: ScanFindingSeveritySchema,
    message: z.string().min(1),
    /** zero-based offset in the input string. */
    offset: z.number().int().nonnegative().optional(),
    snippet: z.string().optional(),
  })
  .strict();
export type ScanFinding = z.infer<typeof ScanFindingSchema>;

export const ScanReportSchema = z
  .object({
    scanId: UuidSchema,
    promptId: z.string().min(1),
    version: SemverSchema,
    scannedAt: IsoDateTimeSchema,
    findings: z.array(ScanFindingSchema),
    /** sha256 of the canonical finding JSON, for envelope/lineage. */
    digestChecksum: Sha256ChecksumSchema,
    /** Counts by severity. */
    counts: z.object({
      critical: z.number().int().nonnegative(),
      high: z.number().int().nonnegative(),
      medium: z.number().int().nonnegative(),
      low: z.number().int().nonnegative(),
      info: z.number().int().nonnegative(),
    }),
  })
  .strict();
export type ScanReport = z.infer<typeof ScanReportSchema>;

// Pattern kinds used by the in-process scanner; new patterns register here.
export const ScanPatternKindSchema = z.enum([
  'REGEX',
  'KEYWORD',
  'PLACEHOLDER',
  'FORBIDDEN_PHRASE',
]);
export type ScanPatternKind = z.infer<typeof ScanPatternKindSchema>;

export const ScanPatternSchema = z
  .object({
    patternId: z.string().min(1),
    category: ScanFindingCategorySchema,
    severity: ScanFindingSeveritySchema,
    kind: ScanPatternKindSchema,
    /** REGEX: regex pattern. KEYWORD: literal phrase. FORBIDDEN_PHRASE: literal. */
    phrase: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();
export type ScanPattern = z.infer<typeof ScanPatternSchema>;

export const DEFAULT_SCAN_PATTERNS: ReadonlyArray<ScanPattern> = Object.freeze([
  // SECRETS — §5.2 "No secrets, credentials, raw tokens..."
  {
    patternId: 'secret.aws-access-key',
    category: 'SECRET',
    severity: 'CRITICAL',
    kind: 'REGEX',
    phrase: 'AKIA[0-9A-Z]{16}',
    description: 'AWS access key id literal',
  },
  {
    patternId: 'secret.bearer-token',
    category: 'SECRET',
    severity: 'CRITICAL',
    kind: 'REGEX',
    phrase: 'Bearer\\s+[A-Za-z0-9\\-_]{20,}',
    description: 'Bearer literal token',
  },
  {
    patternId: 'secret.private-key',
    category: 'SECRET',
    severity: 'CRITICAL',
    kind: 'KEYWORD',
    phrase: 'BEGIN PRIVATE KEY',
    description: 'PEM private key block',
  },
  {
    patternId: 'secret.openai-key',
    category: 'SECRET',
    severity: 'CRITICAL',
    kind: 'REGEX',
    phrase: 'sk-(?:proj-)?[A-Za-z0-9]{20,}',
    description: 'OpenAI / Anthropic-style API key',
  },
  // INJECTION — §9 Security row.
  {
    patternId: 'injection.ignore-previous',
    category: 'INJECTION',
    severity: 'HIGH',
    kind: 'REGEX',
    phrase: 'ignore\\s+(?:all\\s+)?previous\\s+instructions',
    description: 'Classic prompt injection directive',
  },
  {
    patternId: 'injection.system-token',
    category: 'INJECTION',
    severity: 'HIGH',
    kind: 'REGEX',
    phrase: '<\\|im_start\\|>|<\\|im_end\\|>',
    description: 'Special model control tokens',
  },
  // CHAIN-OF-THOUGHT — §7.3 "Never store model hidden reasoning".
  {
    patternId: 'cot.reveal-thinking',
    category: 'CHAIN_OF_THOUGHT',
    severity: 'MEDIUM',
    kind: 'REGEX',
    phrase: 'think\\s+step\\s+by\\s+step',
    description: 'Prompt that asks model to expose hidden reasoning',
  },
  // PII — §5.2.
  {
    patternId: 'pii.ssn',
    category: 'PII',
    severity: 'HIGH',
    kind: 'REGEX',
    phrase: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
    description: 'US Social Security Number',
  },
  {
    patternId: 'pii.email',
    category: 'PII',
    severity: 'MEDIUM',
    kind: 'REGEX',
    phrase: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}',
    description: 'Email address literal',
  },
]);

// ============================================================
// SCANNER & RENDERER
// ============================================================

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scanPrompt(
  template: string,
  patterns: ReadonlyArray<ScanPattern> = DEFAULT_SCAN_PATTERNS,
): ScanFinding[] {
  const findings: ScanFinding[] = [];
  for (const pattern of patterns) {
    if (pattern.kind === 'REGEX') {
      const re = new RegExp(pattern.phrase, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(template)) !== null) {
        findings.push({
          code: pattern.patternId,
          category: pattern.category,
          severity: pattern.severity,
          message: pattern.description,
          offset: m.index,
          snippet: m[0],
        });
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    } else if (
      pattern.kind === 'KEYWORD' ||
      pattern.kind === 'FORBIDDEN_PHRASE'
    ) {
      const needle = pattern.phrase;
      const re = new RegExp(escapeRegex(needle), 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(template)) !== null) {
        findings.push({
          code: pattern.patternId,
          category: pattern.category,
          severity: pattern.severity,
          message: pattern.description,
          offset: m.index,
          snippet: m[0],
        });
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    }
    // PLACEHOLDER reserved for future expansion.
  }
  return findings;
}

export function computeScanChecksum(findings: readonly ScanFinding[]): string {
  const canonical = JSON.stringify(
    findings.map((f) => ({
      code: f.code,
      category: f.category,
      severity: f.severity,
      message: f.message,
      offset: f.offset ?? null,
      snippet: f.snippet ?? null,
    })),
  );
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`;
}

export function buildScanReport(input: {
  promptId: string;
  version: string;
  template: string;
  patterns?: ReadonlyArray<ScanPattern>;
  now?: Date;
  scanIdFactory?: () => string;
}): ScanReport {
  const findings = scanPrompt(input.template, input.patterns);
  const counts = {
    critical: findings.filter((f) => f.severity === 'CRITICAL').length,
    high: findings.filter((f) => f.severity === 'HIGH').length,
    medium: findings.filter((f) => f.severity === 'MEDIUM').length,
    low: findings.filter((f) => f.severity === 'LOW').length,
    info: findings.filter((f) => f.severity === 'INFO').length,
  };
  const scanIdFactory = input.scanIdFactory ?? (() => randomUUID());
  const scannedAt = (input.now ?? new Date()).toISOString();
  return ScanReportSchema.parse({
    scanId: scanIdFactory(),
    promptId: input.promptId,
    version: input.version,
    scannedAt,
    findings,
    digestChecksum: computeScanChecksum(findings),
    counts,
  });
}

/** Extract {{var}} and {var} variable names from a template. */
export function extractVariableNames(template: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) out.add(m[1]);
  return Array.from(out);
}

export function canonicalizeTemplate(template: string): string {
  // Collapse whitespace runs and trailing whitespace per line, preserving
  // the visible structure. Strip BOM and trailing newline.
  return template
    .replace(/\uFEFF/g, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}

export function computeTemplateChecksum(template: string): string {
  return `sha256:${createHash('sha256').update(canonicalizeTemplate(template)).digest('hex')}`;
}

export type PromptVariableMap = Record<string, unknown>;

export class PromptRenderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'UNDECLARED_VARIABLE'
      | 'MISSING_VARIABLE'
      | 'TYPE_MISMATCH'
      | 'TOKEN_OVERFLOW',
  ) {
    super(message);
    this.name = 'PromptRenderError';
  }
}

export function renderPrompt(
  prompt: PromptVersion,
  values: PromptVariableMap,
): string {
  // Render declared {{var}} placeholders.
  const remaining = new Set(extractVariableNames(prompt.template));
  const interpolated = prompt.template.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (_match, name: string) => {
      const declared = prompt.variables.find((v) => v.name === name);
      if (!declared) {
        throw new PromptRenderError(
          `Template references undeclared variable: ${name}`,
          'UNDECLARED_VARIABLE',
        );
      }
      const hasValue = Object.prototype.hasOwnProperty.call(
        values,
        name,
      ) as boolean;
      const value: unknown = hasValue
        ? (values as Record<string, unknown>)[name]
        : declared.defaultValue;
      if (declared.required && (value === undefined || value === null)) {
        throw new PromptRenderError(
          `Missing required variable: ${name}`,
          'MISSING_VARIABLE',
        );
      }
      let rendered: string;
      switch (declared.type) {
        case 'STRING':
          if (typeof value !== 'string') {
            throw new PromptRenderError(
              `Variable ${name} expected string`,
              'TYPE_MISMATCH',
            );
          }
          rendered = value;
          break;
        case 'NUMBER':
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new PromptRenderError(
              `Variable ${name} expected finite number`,
              'TYPE_MISMATCH',
            );
          }
          rendered = String(value);
          break;
        case 'BOOLEAN':
          if (typeof value !== 'boolean') {
            throw new PromptRenderError(
              `Variable ${name} expected boolean`,
              'TYPE_MISMATCH',
            );
          }
          rendered = value ? 'true' : 'false';
          break;
        case 'JSON':
          rendered = JSON.stringify(value);
          break;
      }
      remaining.delete(name);
      return rendered;
    },
  );
  // All declared required variables without defaults must be present.
  for (const v of prompt.variables) {
    if (!v.required) continue;
    if (v.defaultValue !== undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(values, v.name)) {
      throw new PromptRenderError(
        `Missing required variable: ${v.name}`,
        'MISSING_VARIABLE',
      );
    }
  }
  // Token ceiling check (rough heuristic: 4 chars per token).
  const estimatedTokens = Math.ceil(interpolated.length / 4);
  if (estimatedTokens > prompt.maxTokens) {
    throw new PromptRenderError(
      `Rendered prompt exceeds maxTokens: ${estimatedTokens} > ${prompt.maxTokens}`,
      'TOKEN_OVERFLOW',
    );
  }
  return interpolated;
}

// ============================================================
// PORTS & STORAGE
// ============================================================

export interface IPromptRegistry {
  register(
    input: RegisterPromptInput,
    ctx: AuthorizationContext,
  ): PromptVersion;
  supersede(input: {
    promptId: string;
    newVersion: z.infer<typeof SemverSchema>;
    template: string;
    variables: PromptVariable[];
    safetyRules: string[];
    requiredModelFeatures: string[];
    title: string;
    description: string;
    changelog: string;
    ctx: AuthorizationContext;
  }): PromptVersion;
  revoke(
    promptId: string,
    version: string,
    reason: string,
    ctx: AuthorizationContext,
  ): PromptVersion;
  get(promptId: string, version: string): PromptVersion | undefined;
  getActive(promptId: string): PromptVersion | undefined;
  list(promptId: string): PromptVersion[];
  listAll(): PromptVersion[];
  search(query: {
    promptId?: string;
    tag?: string;
    kind?: PromptKind;
  }): PromptVersion[];
  appendLineage(edge: PromptLineageEdge): void;
  listLineage(promptId: string, version: string): PromptLineageEdge[];
  attachScan(scan: ScanReport): void;
  getScan(promptId: string, version: string): ScanReport | undefined;
  canary(input: {
    promptId: string;
    baselineVersion: string;
    candidateVersion: string;
    evaluations: Array<{
      metric: string;
      baselineValue: number;
      candidateValue: number;
    }>;
    threshold: number;
    ctx: AuthorizationContext;
  }): CanaryComparison;
  rollback(input: {
    promptId: string;
    targetVersion: string;
    reason: string;
    ctx: AuthorizationContext;
  }): PromptVersion;
}

export const RegisterPromptInputSchema = z
  .object({
    promptId: z.string().min(1),
    version: SemverSchema,
    kind: PromptKindSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    owner: z.string().min(1),
    template: z.string().min(1),
    variables: z.array(PromptVariableSchema).default([]),
    safetyRules: z.array(z.string().min(1)).default([]),
    requiredModelFeatures: z.array(z.string().min(1)).default([]),
    maxTokens: z.number().int().positive().default(4096),
    status: z.enum(['DRAFT', 'ACTIVE']).default('DRAFT'),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type RegisterPromptInput = z.infer<typeof RegisterPromptInputSchema>;

// ============================================================
// CANARY COMPARISON (§9 Prompt row: "canary comparison")
// ============================================================

export const CanaryComparisonSchema = z
  .object({
    promptId: z.string().min(1),
    baselineVersion: SemverSchema,
    candidateVersion: SemverSchema,
    metrics: z.array(
      z.object({
        metric: z.string().min(1),
        baselineValue: z.number().finite(),
        candidateValue: z.number().finite(),
        delta: z.number().finite(),
        deltaPct: z.number().finite(),
        passesThreshold: z.boolean(),
      }),
    ),
    overallPass: z.boolean(),
    threshold: z.number().finite(),
    comparedAt: IsoDateTimeSchema,
    comparedBy: z.string().min(1),
  })
  .strict();
export type CanaryComparison = z.infer<typeof CanaryComparisonSchema>;

export function compareCanary(
  promptId: string,
  baselineVersion: string,
  candidateVersion: string,
  evaluations: ReadonlyArray<{
    metric: string;
    baselineValue: number;
    candidateValue: number;
  }>,
  threshold: number,
  ctx: AuthorizationContext,
  now: Date = new Date(),
): CanaryComparison {
  const metrics = evaluations.map((e) => {
    const delta = e.candidateValue - e.baselineValue;
    const deltaPct =
      e.baselineValue === 0 ? 0 : (delta / Math.abs(e.baselineValue)) * 100;
    const passesThreshold = deltaPct >= -threshold;
    return {
      metric: e.metric,
      baselineValue: e.baselineValue,
      candidateValue: e.candidateValue,
      delta,
      deltaPct,
      passesThreshold,
    };
  });
  return CanaryComparisonSchema.parse({
    promptId,
    baselineVersion,
    candidateVersion,
    metrics,
    overallPass: metrics.every((m) => m.passesThreshold),
    threshold,
    comparedAt: now.toISOString(),
    comparedBy: ctx.actorId,
  });
}

// ============================================================
// IN-MEMORY REGISTRY
// ============================================================

type StoredScan = ScanReport;

export class InMemoryPromptRegistry implements IPromptRegistry {
  private readonly versions = new Map<string, PromptVersion[]>();
  private readonly byKey = new Map<string, PromptVersion>();
  private readonly lineage: PromptLineageEdge[] = [];
  private readonly scans = new Map<string, StoredScan>();

  private key(promptId: string, version: string): string {
    return `${promptId}@${version}`;
  }

  register(
    input: RegisterPromptInput,
    ctx: AuthorizationContext,
  ): PromptVersion {
    // Authorization: only AUTHOR / DOMAIN_OWNER / SECURITY / QA_LEAD may register.
    const allowedRoles = [
      'AUTHOR',
      'REVIEWER',
      'SECURITY',
      'DOMAIN_OWNER',
      'QA_LEAD',
      'ARCHITECTURE',
    ];
    if (
      !ctx.actorRoles.some((r) => allowedRoles.includes(r as never)) &&
      ctx.isSuperAdmin !== true
    ) {
      throw new Error(
        `Authorization denied for actor ${ctx.actorId} (missing prompt-management role)`,
      );
    }
    const scan = buildScanReport({
      promptId: input.promptId,
      version: input.version,
      template: input.template,
      now: new Date(),
    });
    if (scan.findings.some((f) => f.severity === 'CRITICAL')) {
      // §5.2 "fail closed": a CRITICAL scan finding blocks registration.
      throw new Error(
        `Prompt registration blocked: CRITICAL scan finding (${scan.findings.find((f) => f.severity === 'CRITICAL')?.code})`,
      );
    }
    const version: PromptVersion = PromptVersionSchema.parse({
      schemaVersion: PROMPT_VERSION,
      promptId: input.promptId,
      version: input.version,
      kind: input.kind,
      title: input.title,
      description: input.description,
      owner: input.owner,
      template: input.template,
      variables: input.variables,
      safetyRules: input.safetyRules,
      requiredModelFeatures: input.requiredModelFeatures,
      maxTokens: input.maxTokens,
      contentChecksum: computeTemplateChecksum(input.template),
      scanChecksum: scan.digestChecksum,
      createdAt: new Date().toISOString(),
      createdBy: ctx.actorId,
      approvalChain: [
        {
          approverId: ctx.actorId,
          approvedAt: new Date().toISOString(),
          role: 'AUTHOR',
        },
      ],
      status: input.status,
      tags: input.tags,
    });
    const list = this.versions.get(input.promptId) ?? [];
    if (list.some((v) => v.version === version.version)) {
      throw new Error(
        `Prompt version already exists: ${input.promptId}@${version.version}`,
      );
    }
    list.push(version);
    this.versions.set(input.promptId, list);
    this.byKey.set(this.key(input.promptId, version.version), version);
    this.scans.set(this.key(input.promptId, version.version), scan);
    return version;
  }

  supersede(input: {
    promptId: string;
    newVersion: z.infer<typeof SemverSchema>;
    template: string;
    variables: PromptVariable[];
    safetyRules: string[];
    requiredModelFeatures: string[];
    title: string;
    description: string;
    changelog: string;
    ctx: AuthorizationContext;
  }): PromptVersion {
    const previous = this.versions.get(input.promptId) ?? [];
    const latest = previous[previous.length - 1];
    if (!latest) {
      throw new Error(
        `Cannot supersede: prompt ${input.promptId} has no prior version`,
      );
    }
    const next = this.register(
      RegisterPromptInputSchema.parse({
        promptId: input.promptId,
        version: input.newVersion,
        kind: latest.kind,
        title: input.title,
        description: input.description,
        owner: latest.owner,
        template: input.template,
        variables: input.variables,
        safetyRules: input.safetyRules,
        requiredModelFeatures: input.requiredModelFeatures,
        maxTokens: latest.maxTokens,
        status: 'DRAFT',
        tags: latest.tags,
      }),
      input.ctx,
    );
    this.appendLineage({
      fromPromptId: latest.promptId,
      fromVersion: latest.version,
      toPromptId: next.promptId,
      toVersion: next.version,
      relation: 'SUPERSEDES',
      reason: input.changelog,
      actorId: input.ctx.actorId,
      at: new Date().toISOString(),
    });
    next.supersedes = latest.version;
    return next;
  }

  revoke(
    promptId: string,
    version: string,
    reason: string,
    ctx: AuthorizationContext,
  ): PromptVersion {
    const key = this.key(promptId, version);
    const existing = this.byKey.get(key);
    if (!existing) throw new Error(`Prompt version not found: ${key}`);
    if (existing.status === 'REVOKED') return existing;
    const revoked: PromptVersion = {
      ...existing,
      status: 'REVOKED',
      approvalChain: [
        ...existing.approvalChain,
        {
          approverId: ctx.actorId,
          approvedAt: new Date().toISOString(),
          role: 'SECURITY',
          note: `REVOKED: ${reason}`,
        },
      ],
    };
    this.byKey.set(key, revoked);
    const list = this.versions.get(promptId) ?? [];
    const idx = list.findIndex((v) => v.version === version);
    if (idx >= 0) list[idx] = revoked;
    this.versions.set(promptId, list);
    return revoked;
  }

  get(promptId: string, version: string): PromptVersion | undefined {
    return this.byKey.get(this.key(promptId, version));
  }

  getActive(promptId: string): PromptVersion | undefined {
    return (this.versions.get(promptId) ?? []).find(
      (v) => v.status === 'ACTIVE',
    );
  }

  list(promptId: string): PromptVersion[] {
    return [...(this.versions.get(promptId) ?? [])];
  }

  listAll(): PromptVersion[] {
    const out: PromptVersion[] = [];
    for (const list of this.versions.values()) out.push(...list);
    return out;
  }

  search(query: {
    promptId?: string;
    tag?: string;
    kind?: PromptKind;
  }): PromptVersion[] {
    const all = this.listAll();
    return all.filter((v) => {
      if (query.promptId && v.promptId !== query.promptId) return false;
      if (query.tag && !v.tags.includes(query.tag)) return false;
      if (query.kind && v.kind !== query.kind) return false;
      return true;
    });
  }

  appendLineage(edge: PromptLineageEdge): void {
    this.lineage.push(PromptLineageEdgeSchema.parse(edge));
  }

  listLineage(promptId: string, version: string): PromptLineageEdge[] {
    return this.lineage.filter(
      (e) => e.toPromptId === promptId && e.toVersion === version,
    );
  }

  attachScan(scan: ScanReport): void {
    this.scans.set(this.key(scan.promptId, scan.version), scan);
  }

  getScan(promptId: string, version: string): ScanReport | undefined {
    return this.scans.get(this.key(promptId, version));
  }

  canary(input: {
    promptId: string;
    baselineVersion: string;
    candidateVersion: string;
    evaluations: Array<{
      metric: string;
      baselineValue: number;
      candidateValue: number;
    }>;
    threshold: number;
    ctx: AuthorizationContext;
  }): CanaryComparison {
    return compareCanary(
      input.promptId,
      input.baselineVersion,
      input.candidateVersion,
      input.evaluations,
      input.threshold,
      input.ctx,
    );
  }

  rollback(input: {
    promptId: string;
    targetVersion: string;
    reason: string;
    ctx: AuthorizationContext;
  }): PromptVersion {
    const target = this.get(input.promptId, input.targetVersion);
    if (!target)
      throw new Error(
        `Rollback target not found: ${input.promptId}@${input.targetVersion}`,
      );
    if (target.status === 'REVOKED') {
      throw new Error(
        `Cannot rollback to REVOKED version ${input.targetVersion}`,
      );
    }
    const previousActive = this.getActive(input.promptId);
    // Create a new ACTIVE version that mirrors target (immutability).
    // We re-register with bumped patch version + ACTIVE status.
    const current = this.versions.get(input.promptId) ?? [];
    const bumped = bumpPatch(current[current.length - 1]?.version ?? '0.0.0');
    const restored = this.register(
      RegisterPromptInputSchema.parse({
        promptId: input.promptId,
        version: bumped,
        kind: target.kind,
        title: `[ROLLBACK] ${target.title}`,
        description: target.description,
        owner: target.owner,
        template: target.template,
        variables: target.variables,
        safetyRules: target.safetyRules,
        requiredModelFeatures: target.requiredModelFeatures,
        maxTokens: target.maxTokens,
        status: 'ACTIVE',
        tags: [...target.tags, 'rollback'],
      }),
      input.ctx,
    );
    // Demote the previously active version.
    if (previousActive && previousActive.version !== restored.version) {
      const demoted = { ...previousActive, status: 'DEPRECATED' as const };
      this.byKey.set(this.key(input.promptId, previousActive.version), demoted);
      const list = this.versions.get(input.promptId) ?? [];
      const idx = list.findIndex((v) => v.version === previousActive.version);
      if (idx >= 0) list[idx] = demoted;
      this.versions.set(input.promptId, list);
    }
    this.appendLineage({
      fromPromptId: input.promptId,
      fromVersion: previousActive?.version ?? '0.0.0',
      toPromptId: input.promptId,
      toVersion: restored.version,
      relation: 'ROLLED_BACK_TO',
      reason: input.reason,
      actorId: input.ctx.actorId,
      at: new Date().toISOString(),
    });
    return restored;
  }
}

function bumpPatch(v: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (!m) return '0.0.1';
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

// ============================================================
// RE-EXPORTS
// ============================================================

export function _uuidPlaceholder(): string {
  return '00000000-0000-0000-0000-000000000000';
}

function randomUUID(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const c = require('crypto') as typeof import('crypto');
  return c.randomUUID();
}
