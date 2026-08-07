/**
 * Phase 19 — CampaignBriefSkill (CR-AI-0802).
 *
 * Generates a typed campaign brief with themes, subject lines,
 * brand voice, and forbidden phrases. Drafts only — never sends.
 *
 * SRP — owns ONLY the brief drafting surface.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseSkill } from '../../skill-registry/skills/base.skill';
import { SkillId, SkillExecutionContext } from '../../skill-registry/interfaces/skill.interface';
import {
  SourceRef,
  SkillCitation,
  SkillOutput,
} from '../../skill-registry/interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../../skill-registry/skill-prompt';
import { ExecutorOptions } from '../../skill-registry/skill-executor.service';

export interface CampaignBriefInput {
  readonly tenantId: string;
  readonly topic: string;
  readonly brandVoice?: 'formal' | 'casual' | 'friendly' | 'urgent' | 'neutral';
  readonly forbiddenPhrases?: ReadonlyArray<string>;
  readonly audience?: string;
}

export interface CampaignBriefOutput extends SkillOutput<{
  readonly title: string;
  readonly themes: ReadonlyArray<string>;
  readonly subjectLines: ReadonlyArray<string>;
  readonly body: string;
  readonly forbiddenPhrases: ReadonlyArray<string>;
  readonly brandVoice: string;
}> {}

@Injectable()
export class CampaignBriefSkill extends BaseSkill<CampaignBriefInput, CampaignBriefOutput> {
  readonly id: SkillId = 'campaign-brief';
  readonly displayName = 'Campaign brief';
  readonly shortDescription =
    'Generate a campaign brief with themes, subject lines, and brand voice. Drafts only.';

  private readonly logger = new Logger(CampaignBriefSkill.name);

  validateInput(input: unknown): input is CampaignBriefInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['tenantId'] !== 'string' || i['tenantId'].length === 0) {
      return false;
    }
    if (typeof i['topic'] !== 'string' || (i['topic'] as string).trim().length === 0) {
      return false;
    }
    if (i['brandVoice'] !== undefined) {
      const ok = ['formal', 'casual', 'friendly', 'urgent', 'neutral'].includes(
        i['brandVoice'] as string,
      );
      if (!ok) return false;
    }
    return true;
  }

  buildPrompt(
    input: CampaignBriefInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<CampaignBriefOutput>; options?: ExecutorOptions } {
    void _ctx;
    const voice = input.brandVoice ?? 'neutral';
    const forbidden = input.forbiddenPhrases ?? [];
    const sources: ReadonlyArray<SourceRef> = [{ kind: 'text', text: input.topic }];
    const systemInstruction = [
      'You write campaign briefs. You draft only — never send.',
      'Reply as JSON: { "content": { "title": string, "themes": string[], "subjectLines": string[], "body": string, "forbiddenPhrases": string[], "brandVoice": string }, "limits": string[] }.',
      'Every draft must respect the brand voice and never use a forbidden phrase; if you would, surface a `limits` entry explaining the substitution.',
    ].join('\n');
    const userInstruction = [
      `Topic: "${input.topic}".`,
      input.audience ? `Audience: ${input.audience}.` : '',
      `Brand voice: ${voice}.`,
      forbidden.length > 0
        ? `Forbidden phrases (replace with a neutral rewrite): ${forbidden.join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      prompt: {
        skillId: this.id,
        capability: 'conversation',
        systemInstruction,
        userInstruction,
        sources,
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content: text, limits } = parseTextReply(raw);
          const parsed = parseBriefJson(text);
          const citations: SkillCitation[] = [
            { locator: 'topic-source', quote: input.topic.slice(0, 200) },
          ];
          return {
            content: {
              title: parsed.title,
              themes: parsed.themes,
              subjectLines: parsed.subjectLines,
              body: parsed.body,
              forbiddenPhrases: forbidden,
              brandVoice: voice,
            },
            citations,
            limits,
            confidence: 0.85,
            durationMs: 0,
            skillId: this.id,
          } satisfies CampaignBriefOutput;
        },
        limits: ['publisher-not-invoked:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 1500 },
    };
  }
}

function parseBriefJson(text: string): {
  title: string;
  themes: string[];
  subjectLines: string[];
  body: string;
  forbiddenPhrases: string[];
} {
  try {
    const trimmed = text.trim();
    const fenced = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```$/, '')
      : trimmed;
    const obj = JSON.parse(fenced) as unknown;
    if (obj && typeof obj === 'object') {
      const o = obj as Record<string, unknown>;
      const inner = (o['content'] && typeof o['content'] === 'object')
        ? (o['content'] as Record<string, unknown>)
        : o;
      return {
        title: typeof inner['title'] === 'string' ? (inner['title'] as string) : 'Untitled brief',
        themes: Array.isArray(inner['themes'])
          ? (inner['themes'] as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            )
          : [],
        subjectLines: Array.isArray(inner['subjectLines'])
          ? (inner['subjectLines'] as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            )
          : [],
        body: typeof inner['body'] === 'string' ? (inner['body'] as string) : text,
        forbiddenPhrases: Array.isArray(inner['forbiddenPhrases'])
          ? (inner['forbiddenPhrases'] as unknown[]).filter(
              (t): t is string => typeof t === 'string',
            )
          : [],
      };
    }
  } catch {
    // fall through
  }
  return {
    title: 'Untitled brief',
    themes: [],
    subjectLines: [],
    body: text,
    forbiddenPhrases: [],
  };
}
