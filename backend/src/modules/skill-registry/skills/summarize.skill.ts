/**
 * Phase 11 — Summarize skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0101 / GEN-001.
 *
 * Faithfully summarizes a record, thread, document, or text input
 * while preserving citations. The model is asked to produce JSON
 * `{ content: markdown, limits?: string[] }` so the parse step is
 * type-safe.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import { SourceRef, SkillCitation } from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface SummarizeInput {
  readonly source: SourceRef;
  readonly maxLength?: number;
  readonly tone?: 'bullets' | 'narrative';
  readonly locale?: string;
}

export interface SummarizeOutput {
  readonly content: string;
  readonly limits: ReadonlyArray<string>;
  readonly citations: ReadonlyArray<SkillCitation>;
}

@Injectable()
export class SummarizeSkill extends BaseSkill<SummarizeInput, SummarizeOutput> {
  readonly id: SkillId = 'summarize';
  readonly displayName = 'Summarize';
  readonly shortDescription =
    'Produce a concise summary of a record, thread, or document with citations.';

  validateInput(input: unknown): input is SummarizeInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (!('source' in i)) return false;
    const s = i['source'] as Record<string, unknown> | undefined;
    if (!s || typeof s !== 'object') return false;
    const kind = s['kind'];
    return kind === 'record' || kind === 'thread' || kind === 'file' || kind === 'text';
  }

  buildPrompt(
    input: SummarizeInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<SummarizeOutput>; options?: ExecutorOptions } {
    const limit = Math.min(800, Math.max(60, input.maxLength ?? 360));
    const tone = input.tone ?? 'bullets';
    const systemInstruction =
      'You are a careful summarizer. Preserve dates, names, and figures. Cite each non-trivial claim with the record/thread/file reference. If you cannot verify a claim, declare it in `limits`.';
    const userInstruction =
      `Summarize the source in ${tone === 'bullets' ? 'concise bullet points' : 'narrative prose'} under ${limit} words. ` +
      'Reply as JSON: {"content": string, "limits": string[]}.';

    return {
      prompt: {
        skillId: this.id,
        capability: 'conversation',
        systemInstruction,
        userInstruction,
        sources: [input.source],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const parsed = parseTextReply(raw);
          return {
            content: parsed.content,
            limits: parsed.limits,
            citations: [],
          };
        },
        limits: ['citation-locator:empty-by-default-till-phase-12'],
      },
      options: { temperature: 0, maxTokens: 768 },
    };
  }
}
