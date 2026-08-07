/**
 * Phase 19 — CaseResolveSkill (CR-AI-0902).
 *
 * Cited knowledge resolution recommendation. Returns a typed
 * ResolutionCandidate[] with citations to knowledge entries.
 *
 * SRP — owns ONLY the resolution surface. The case classification
 * provider (Phase 5 P5 + P19 SLA extensions) is separate.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BaseSkill } from '../../skill-registry/skills/base.skill';
import { SkillId, SkillExecutionContext } from '../../skill-registry/interfaces/skill.interface';
import {
  SourceRef,
  SkillCitation,
  SkillOutput,
} from '../../skill-registry/interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../../skill-registry/skill-prompt';
import { ExecutorOptions } from '../../skill-registry/skill-executor.service';

export interface CaseResolveInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly subjectText: string;
  readonly caseType?: string;
}

export interface ResolutionCandidate {
  readonly knowledgeEntryId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly matchScore: number;
}

export interface CaseResolveOutput extends SkillOutput<{
  readonly recommendations: ReadonlyArray<ResolutionCandidate>;
}> {}

@Injectable()
export class CaseResolveSkill extends BaseSkill<CaseResolveInput, CaseResolveOutput> {
  readonly id: SkillId = 'case-resolve';
  readonly displayName = 'Cited knowledge resolution';
  readonly shortDescription =
    'Recommend resolution candidates from the knowledge corpus with citations.';

  private readonly logger = new Logger(CaseResolveSkill.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  validateInput(input: unknown): input is CaseResolveInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['tenantId'] !== 'string' || i['tenantId'].length === 0) {
      return false;
    }
    if (typeof i['caseId'] !== 'string' || i['caseId'].length === 0) {
      return false;
    }
    if (
      typeof i['subjectText'] !== 'string' ||
      (i['subjectText'] as string).trim().length === 0
    ) {
      return false;
    }
    return true;
  }

  buildPrompt(
    input: CaseResolveInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<CaseResolveOutput>; options?: ExecutorOptions } {
    void _ctx;
    const sources: ReadonlyArray<SourceRef> = [
      { kind: 'text', text: input.subjectText },
    ];
    const systemInstruction = [
      'You recommend case resolutions from a knowledge corpus.',
      'Output JSON: { "content": { "recommendations": [{ "knowledgeEntryId": string, "title": string, "excerpt": string, "matchScore": 0..1 }] }, "limits": string[] }.',
      'Cite every recommendation with the knowledge entry id + title. If no candidates fit, return [] and emit a `limits` entry.',
    ].join('\n');
    const userInstruction = `Case ${input.caseId} (${input.caseType ?? 'untyped'}): "${input.subjectText}".`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        sources,
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content: text, limits } = parseTextReply(raw);
          const parsed = parseResolveJson(text);
          const citations: SkillCitation[] = parsed.recommendations.map((r) => ({
            locator: `knowledgeEntry:${r.knowledgeEntryId}`,
            quote: r.excerpt.slice(0, 200),
          }));
          return {
            content: { recommendations: parsed.recommendations },
            citations,
            limits,
            confidence: parsed.avgScore,
            durationMs: 0,
            skillId: this.id,
          } satisfies CaseResolveOutput;
        },
        limits: ['publisher-not-invoked:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 1200 },
    };
  }
}

function parseResolveJson(text: string): {
  recommendations: ResolutionCandidate[];
  avgScore: number;
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
      const raw = Array.isArray(inner['recommendations'])
        ? (inner['recommendations'] as unknown[])
        : [];
      const recs: ResolutionCandidate[] = raw
        .filter(isResolutionCandidate)
        .map((r) => ({
          knowledgeEntryId: r.knowledgeEntryId,
          title: r.title ?? '',
          excerpt: r.excerpt ?? '',
          matchScore:
            typeof r.matchScore === 'number'
              ? clamp(r.matchScore, 0, 1)
              : 0,
        }));
      const avg =
        recs.length === 0
          ? 0
          : recs.reduce((a, r) => a + r.matchScore, 0) / recs.length;
      return { recommendations: recs, avgScore: avg };
    }
  } catch {
    // fall through
  }
  return { recommendations: [], avgScore: 0 };
}

function isResolutionCandidate(x: unknown): x is {
  knowledgeEntryId: string;
  title?: string;
  excerpt?: string;
  matchScore?: number;
} {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o['knowledgeEntryId'] === 'string' &&
    o['knowledgeEntryId'].length > 0
  );
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
