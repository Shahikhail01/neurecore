/**
 * SkillExecutor — Phase 12 closed.
 *
 * Phase 11 NOTE: this class used to throw `SkillAbstainedError('resolver-not-built:<kind>')`
 * for any non-`text` SourceRef. Phase 12 closes that gap by injecting
 * `SourceRefResolverRegistry` (concrete resolvers for `record`,
 * `thread`, `file`). The `(text)` case stays inline because no I/O is
 * needed.
 *
 * Owns ONLY the LLM glue — prompt construction, schema-validated
 * parsing, citation emission, telemetry, tenant-scope enforcement.
 *
 * SRP:
 *   - Does NOT know about a specific skill. Prompts come from the
 *     skill via the SkillPrompt envelope.
 *   - Does NOT know about specific providers. Calls AiGatewayService
 *     (the canonical facade) and lets its capability resolver pick
 *     the model.
 *   - Does NOT know about specific record/thread/file shapes.
 *     Delegates to typed resolvers via the registry.
 *
 * DIP:
 *   - Depends on the AiGatewayService facade + SourceRefResolverRegistry
 *     abstraction, never on Prisma tables directly.
 *
 * Zero stub:
 *   - Every public method either returns a typed result or throws a
 *     typed error. No `{ ok: true }` fallbacks.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TenantContext } from '../../common/context/tenant-context';
import {
  AiGatewayService,
} from '../ai-gateway/ai-gateway.service';
import { SkillTelemetry, SkillTelemetryRun } from './skill-telemetry';
import { buildSkillCitation, SkillPrompt } from './skill-prompt';
import { SourceRef, SkillCitation, SkillOutput } from './interfaces/skill.types';
import {
  SourceRefResolverRegistry,
  SOURCE_REF_RESOLVER_REGISTRY,
} from '../knowledge/resolvers/source-ref-resolver.registry';

export class SkillAuthorizationError extends Error {
  constructor(
    message: string,
    readonly reason: 'CROSS_TENANT' | 'MISSING_TENANT' | 'AUTH_REJECTED',
  ) {
    super(message);
    this.name = 'SkillAuthorizationError';
  }
}

export class SkillAbstainedError extends Error {
  constructor(
    message: string,
    readonly limits: ReadonlyArray<string>,
  ) {
    super(message);
    this.name = 'SkillAbstainedError';
  }
}

export interface ExecutorOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
}

@Injectable()
export class SkillExecutor {
  private readonly logger = new Logger(SkillExecutor.name);

  constructor(
    private readonly ai: AiGatewayService,
    private readonly telemetry: SkillTelemetry,
    @Inject(SOURCE_REF_RESOLVER_REGISTRY)
    private readonly resolvers: SourceRefResolverRegistry,
  ) {}

  /**
   * Enforce tenant scope on every SourceRef the caller passes.
   *
   * The ref kinds `record` / `thread` / `file` MUST carry non-empty ids;
   * the actual ownership check happens in each resolver. Here we
   * merely reject empty-id forgery.
   */
  assertSourcesAuthorized(
    sources: ReadonlyArray<SourceRef>,
    ctx: TenantContext,
  ): void {
    if (!ctx.tenantId || ctx.tenantId === '*') {
      throw new SkillAuthorizationError(
        'tenant context required to invoke a skill',
        'MISSING_TENANT',
      );
    }
    for (const src of sources) {
      const id =
        src.kind === 'record'
          ? src.recordId
          : src.kind === 'thread'
            ? src.threadId
            : src.kind === 'file'
              ? src.fileId
              : null;
      if (id !== null && id.length === 0) {
        throw new SkillAuthorizationError(
          `source of kind=${src.kind} carries empty id`,
          'AUTH_REJECTED',
        );
      }
    }
  }

  /**
   * Phase 12 — resolve a SourceRef to (text + citations).
   *
   * Returns a string only for symmetry with downstream callers.
   * Resolved citations are written to `SkillOutput.citations` via
   * `invokeSkill()` which threads the resolver envelope end-to-end.
   */
  async resolveSourceText(
    source: SourceRef,
    ctx: TenantContext,
  ): Promise<string> {
    if (source.kind === 'text') return source.text;
    const resolved = await this.resolvers.resolve(ctx.tenantId, source);
    return resolved.text;
  }

  /**
   * The core call: invoke the model with a typed prompt, parse the
   * response through the skill-declared parser, return a typed
   * SkillOutput.
   */
  async invokeSkill<T>(
    prompt: SkillPrompt,
    ctx: TenantContext,
    opts: ExecutorOptions = {},
  ): Promise<SkillOutput<T>> {
    const started = Date.now();

    // 1. Enforce tenant scope structurally
    this.assertSourcesAuthorized(prompt.sources, ctx);

    // 2. Resolve sources in parallel — capture both text AND citations
    const resolved = await Promise.all(
      prompt.sources.map((s) => this.resolveSourceEnvelope(s, ctx)),
    );
    const sourceBlob = resolved.map((r) => r.text).join('\n\n---\n\n');
    const resolvedCitations: SkillCitation[] = resolved.flatMap(
      (r) => r.citations as SkillCitation[],
    );

    // 3. Build the final prompt
    const userContent = [
      prompt.userInstruction,
      '',
      '--- BEGIN SOURCE CONTENT ---',
      sourceBlob,
      '--- END SOURCE CONTENT ---',
    ].join('\n');

    // 4. Invoke the model
    const modelResp = await this.ai.invoke({
      tenantId: ctx.tenantId,
      capability: prompt.capability ?? 'conversation',
      sourceModule: `skill-registry:${prompt.skillId}`,
      prompt: userContent,
      systemPrompt: prompt.systemInstruction,
      temperature: opts.temperature ?? 0,
      maxTokens: opts.maxTokens ?? prompt.maxTokens ?? 1024,
      responseFormatJson: prompt.responseJsonRequired,
    });

    const raw = modelResp.content ?? '';
    const content = prompt.parse(raw) as T;
    const limits: ReadonlyArray<string> = prompt.limits ?? [];

    // 5. Merge citations — prefer resolver-supplied (more specific);
    //    fall back to the inline buildSkillCitation for `text` refs.
    const baseCitations = prompt.sources.map(buildSkillCitation);
    const citationsByRef = new Map<string, SkillCitation>();
    for (let i = 0; i < baseCitations.length; i += 1) {
      const base = baseCitations[i]!;
      const resolverCitations = (resolved[i]?.citations ?? []) as SkillCitation[];
      if (resolverCitations.length > 0) {
        citationsByRef.set(`${prompt.sources[i]!.kind}:${i}`, {
          ...base,
          quote: resolverCitations[0]?.quote ?? base.quote,
        });
      } else {
        citationsByRef.set(`${prompt.sources[i]!.kind}:${i}`, base);
      }
    }
    const citations = Array.from(citationsByRef.values());

    const durationMs = Date.now() - started;
    const tokensIn = modelResp.usage?.inputTokens ?? 0;
    const tokensOut = modelResp.usage?.outputTokens ?? 0;
    const confidence = prompt.confidenceFor ? prompt.confidenceFor(content) : 1;

    // 6. Telemetry — include resolved-citation count for honest metrics
    const tRun: SkillTelemetryRun = {
      skillId: prompt.skillId,
      tenantId: ctx.tenantId,
      actorId: ctx.actorUserId,
      durationMs,
      tokensIn,
      tokensOut,
      confidence,
      limits: [
        ...limits,
        ...(resolvedCitations.length > 0
          ? []
          : prompt.sources.filter((s) => s.kind !== 'text').length > 0
            ? ['citation-locator:empty-by-default']
            : []),
      ],
    };
    await this.telemetry.recordRun(tRun);

    return {
      content,
      citations,
      limits,
      confidence,
      durationMs,
      skillId: prompt.skillId,
    };
  }

  /**
   * Phase 12 — resolve a SourceRef to (text + citations).
   * Public so other consumers (chat dispatcher, RAG pipeline) can
   * reuse the same resolver chain.
   */
  async resolveSourceEnvelope(
    source: SourceRef,
    ctx: TenantContext,
  ): Promise<{ text: string; citations: ReadonlyArray<unknown> }> {
    if (source.kind === 'text') return { text: source.text, citations: [] };
    const out = await this.resolvers.resolve(ctx.tenantId, source);
    return { text: out.text, citations: out.citations };
  }
}

/** Helper: build a citation from a source ref. */
export function citationsFor(
  sources: ReadonlyArray<SourceRef>,
  build: (s: SourceRef) => Partial<SkillCitation>,
): SkillCitation[] {
  return sources.map((s) => {
    const partial = build(s) ?? {};
    return {
      locator: partial.locator ?? 'inline',
      quote: partial.quote ?? '',
      recordType: partial.recordType ?? (s.kind === 'record' ? s.recordType : undefined),
      recordId: partial.recordId ?? (s.kind === 'record' ? s.recordId : undefined),
      threadId: partial.threadId ?? (s.kind === 'thread' ? s.threadId : undefined),
      fileId: partial.fileId ?? (s.kind === 'file' ? s.fileId : undefined),
    } as SkillCitation;
  });
}
