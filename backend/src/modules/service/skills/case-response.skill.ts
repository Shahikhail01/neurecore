/**
 * Phase 19 — CaseResponseSkill (CR-AI-0903).
 *
 * Drafts response + recommends escalation. Governed writes: the
 * skill NEVER sends. Returns typed escalation recommendation + draft
 * body.
 *
 * SRP — owns ONLY the response draft surface.
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

export interface CaseResponseInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly subjectText: string;
  readonly tone?: 'formal' | 'casual' | 'friendly' | 'urgent' | 'neutral';
}

export interface CaseResponseOutput extends SkillOutput<{
  readonly draftBody: string;
  readonly recommendedEscalation: 'NONE' | 'TIER_2' | 'TIER_3' | 'EXECUTIVE';
  readonly escalationReason: string;
}> {}

@Injectable()
export class CaseResponseSkill extends BaseSkill<CaseResponseInput, CaseResponseOutput> {
  readonly id: SkillId = 'case-response';
  readonly displayName = 'Case response draft';
  readonly shortDescription =
    'Draft a customer reply and recommend escalation. Drafts only.';

  private readonly logger = new Logger(CaseResponseSkill.name);

  validateInput(input: unknown): input is CaseResponseInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['tenantId'] !== 'string' || i['tenantId'].length === 0) return false;
    if (typeof i['caseId'] !== 'string' || i['caseId'].length === 0) return false;
    if (
      typeof i['subjectText'] !== 'string' ||
      (i['subjectText'] as string).trim().length === 0
    ) {
      return false;
    }
    if (i['tone'] !== undefined) {
      const ok = ['formal', 'casual', 'friendly', 'urgent', 'neutral'].includes(
        i['tone'] as string,
      );
      if (!ok) return false;
    }
    return true;
  }

  buildPrompt(
    input: CaseResponseInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<CaseResponseOutput>; options?: ExecutorOptions } {
    void _ctx;
    const tone = input.tone ?? 'neutral';
    const sources: ReadonlyArray<SourceRef> = [
      { kind: 'text', text: input.subjectText },
    ];
    const systemInstruction = [
      'You draft a customer reply for a support case. You NEVER send.',
      'Output JSON: { "content": { "draftBody": string, "recommendedEscalation": "NONE|TIER_2|TIER_3|EXECUTIVE", "escalationReason": string }, "limits": string[] }.',
      'Recommend escalation to TIER_2 for technical depth, TIER_3 for SLA risk, EXECUTIVE for revenue/legal impact.',
    ].join('\n');
    const userInstruction = `Case ${input.caseId}, tone=${tone}: "${input.subjectText}".`;

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
          const parsed = parseResponseJson(text);
          const citations: SkillCitation[] = [
            {
              locator: `case:${input.caseId}`,
              quote: input.subjectText.slice(0, 200),
            },
          ];
          return {
            content: {
              draftBody: parsed.draftBody,
              recommendedEscalation: parsed.recommendedEscalation,
              escalationReason: parsed.escalationReason,
            },
            citations,
            limits,
            confidence: 0.85,
            durationMs: 0,
            skillId: this.id,
          } satisfies CaseResponseOutput;
        },
        limits: ['publisher-not-invoked:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 1200 },
    };
  }
}

function parseResponseJson(text: string): {
  draftBody: string;
  recommendedEscalation: 'NONE' | 'TIER_2' | 'TIER_3' | 'EXECUTIVE';
  escalationReason: string;
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
      const tier = inner['recommendedEscalation'];
      const validTier =
        tier === 'NONE' || tier === 'TIER_2' || tier === 'TIER_3' || tier === 'EXECUTIVE'
          ? tier
          : 'NONE';
      return {
        draftBody:
          typeof inner['draftBody'] === 'string'
            ? (inner['draftBody'] as string)
            : text,
        recommendedEscalation: validTier,
        escalationReason:
          typeof inner['escalationReason'] === 'string'
            ? (inner['escalationReason'] as string)
            : '',
      };
    }
  } catch {
    // fall through
  }
  return {
    draftBody: text,
    recommendedEscalation: 'NONE',
    escalationReason: '',
  };
}
