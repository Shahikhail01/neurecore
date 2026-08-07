/**
 * Phase 11 — Rewrite skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0102 / GEN-002.
 *
 * Reformulates input text along an axis (tone / shorten / expand).
 * Preserves meaning, entities, dates, currency, proper nouns.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import { SourceRef, SkillOutput } from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';
import type { RewriteMode, RewriteTone } from '../interfaces/skill.types';

export interface RewriteInput {
  readonly text: string;
  readonly mode: RewriteMode;
  readonly targetTone?: RewriteTone;
  readonly locale?: string;
}

export interface RewriteOutput extends SkillOutput<string> {}

@Injectable()
export class RewriteSkill extends BaseSkill<RewriteInput, RewriteOutput> {
  readonly id: SkillId = 'rewrite';
  readonly displayName = 'Rewrite';
  readonly shortDescription =
    'Rewrite text for clarity, brevity, or tone without changing the meaning.';

  validateInput(input: unknown): input is RewriteInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    const text = i['text'];
    const mode = i['mode'];
    if (typeof text !== 'string' || text.length === 0 || text.length > 200_000) {
      return false;
    }
    return mode === 'tone' || mode === 'shorten' || mode === 'expand';
  }

  buildPrompt(
    input: RewriteInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<RewriteOutput>; options?: ExecutorOptions } {
    const direction =
      input.mode === 'tone'
        ? `Rewrite for a ${input.targetTone ?? 'neutral'} tone.`
        : input.mode === 'shorten'
          ? 'Shorten the text while preserving every concrete detail (dates, names, numbers, currency).'
          : 'Expand the text with illustrative detail. Do not invent facts.';
    const systemInstruction =
      'You reformulate text along an axis. You preserve meaning, entities, dates, currency, and proper nouns. You never invent facts. Reply as JSON: {"content": string, "limits": string[]}.';
    const userInstruction = `${direction} Reply ONLY with the rewritten text inside JSON.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'conversation',
        systemInstruction,
        userInstruction,
        // The text input wraps as a SourceRef so citations work.
        sources: [{ kind: 'text', text: input.text } satisfies SourceRef],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content, limits } = parseTextReply(raw);
          return {
            content,
            citations: [
              {
                locator: 'inline',
                quote: input.text.slice(0, 200),
              },
            ],
            limits,
            confidence: 0.95,
            durationMs: 0,
            skillId: this.id,
          } satisfies RewriteOutput;
        },
      },
      options: { temperature: 0, maxTokens: 1024 },
    };
  }
}
