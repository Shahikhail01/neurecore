/**
 * Phase 11 — Draft Email skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0107 / GEN-007.
 *
 * IMPORTANT INVARIANT (P−1): this skill DRAFTS only. It never sends.
 * Sending remains the mutating channel through `nc.dispatch_channel`
 * with approval. The output is an email body (subject + text/html
 * content) the human reviews and explicitly approves.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import { SourceRef, SkillOutput } from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface DraftEmailRecipient {
  readonly email: string;
  readonly name?: string;
}

export interface DraftEmailInput {
  readonly source: SourceRef;
  readonly recipient: DraftEmailRecipient;
  readonly intent: string;
  readonly brandVoice?: string;
  readonly attachments?: ReadonlyArray<SourceRef>;
  readonly locale?: string;
}

export interface DraftEmailOutput extends SkillOutput<{
  readonly subject: string;
  readonly body: string;
  readonly contentType: 'text' | 'html';
}> {}

const DEFAULT_BRAND_VOICE = 'professional, concise, friendly';

@Injectable()
export class DraftEmailSkill extends BaseSkill<DraftEmailInput, DraftEmailOutput> {
  readonly id: SkillId = 'draft-email';
  readonly displayName = 'Draft email';
  readonly shortDescription =
    'Draft an email reply grounded in the source — sends only after explicit user approval.';

  validateInput(input: unknown): input is DraftEmailInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['intent'] !== 'string') return false;
    const r = i['recipient'] as Record<string, unknown> | undefined;
    if (!r || typeof r['email'] !== 'string') return false;
    return 'source' in i;
  }

  buildPrompt(
    input: DraftEmailInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<DraftEmailOutput>; options?: ExecutorOptions } {
    const voice = input.brandVoice ?? DEFAULT_BRAND_VOICE;
    const systemInstruction = [
      'You draft email replies grounded in a source record/thread.',
      'You NEVER send. You produce subject + body only.',
      'Match the brand voice supplied by the caller.',
      'Cite each non-trivial claim to the source record/thread it came from.',
      'Reply as JSON: {"content": {"subject": string, "body": string, "contentType": "text"|"html"}, "limits": string[]}.',
    ].join(' ');
    const recipientLine = input.recipient.name
      ? `${input.recipient.name} <${input.recipient.email}>`
      : input.recipient.email;
    const userInstruction =
      `Draft a reply to ${recipientLine}. Intent: "${input.intent}". ` +
      `Brand voice: ${voice}. Body in plaintext unless HTML is requested.`;

    const sources: SourceRef[] = [input.source, ...(input.attachments ?? [])];

    return {
      prompt: {
        skillId: this.id,
        capability: 'conversation',
        systemInstruction,
        userInstruction,
        sources,
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content, limits } = parseTextReply(raw);
          let parsed: { subject?: string; body?: string; contentType?: 'text' | 'html' } = {};
          try {
            const trimmed = content.trim();
            const fenced = trimmed.startsWith('```')
              ? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```$/, '')
              : trimmed;
            parsed = JSON.parse(fenced);
          } catch {
            parsed = { body: content };
          }
          const out = {
            content: {
              subject: parsed.subject ?? '(no subject suggested)',
              body: parsed.body ?? content,
              contentType: (parsed.contentType ?? 'text') as 'text' | 'html',
            },
            citations: [{ locator: `email:${recipientLine}`, quote: '' }],
            limits,
            confidence: 0.9,
            durationMs: 0,
            skillId: this.id,
          } satisfies DraftEmailOutput;
          return out;
        },
        limits: ['outbound-send-not-triggered:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 1500 },
    };
  }
}
