/**
 * Phase 11 — Translate skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0103 / GEN-003.
 *
 * Translates text preserving entities, dates, currency, proper nouns.
 * The `preserveEntities` flag defaults to true because in production
 * every translation must keep those landmarks.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import { SourceRef, SkillOutput } from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface TranslateInput {
  readonly text: string;
  readonly sourceLocale?: string;
  readonly targetLocale: string;
  readonly preserveEntities?: boolean;
}

export interface TranslateOutput extends SkillOutput<string> {}

@Injectable()
export class TranslateSkill extends BaseSkill<TranslateInput, TranslateOutput> {
  readonly id: SkillId = 'translate';
  readonly displayName = 'Translate';
  readonly shortDescription =
    'Translate text preserving entities, dates, currency, and proper nouns.';

  validateInput(input: unknown): input is TranslateInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['text'] !== 'string' || (i['text'] as string).length === 0) {
      return false;
    }
    if (typeof i['targetLocale'] !== 'string' || (i['targetLocale'] as string).length !== 2) {
      return false;
    }
    return true;
  }

  buildPrompt(
    input: TranslateInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<TranslateOutput>; options?: ExecutorOptions } {
    const preserve = input.preserveEntities ?? true;
    const systemInstruction = [
      'You are a precise translator.',
      preserve
        ? 'PRESERVE every entity, date, currency amount, and proper noun verbatim. NEVER translate product names, people\'s names, or company names.'
        : 'You may freely translate proper nouns where culturally appropriate.',
      'Reply as JSON: {"content": string, "limits": string[]}.',
    ].join(' ');
    const userInstruction =
      input.sourceLocale !== undefined
        ? `Translate the following text from ${input.sourceLocale} to ${input.targetLocale}.`
        : `Detect the source language and translate to ${input.targetLocale}.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'conversation',
        systemInstruction,
        userInstruction,
        sources: [{ kind: 'text', text: input.text } satisfies SourceRef],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content, limits } = parseTextReply(raw);
          return {
            content,
            citations: [],
            limits,
            confidence: preserve ? 0.9 : 0.8,
            durationMs: 0,
            skillId: this.id,
          } satisfies TranslateOutput;
        },
      },
      options: { temperature: 0, maxTokens: 2048 },
    };
  }
}
