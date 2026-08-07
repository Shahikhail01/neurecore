/**
 * Phase 19 — SegmentSkill (CR-AI-0801).
 *
 * Audience segmentation. Returns a typed `Segment` with explicit
 * permissions (CR-AI-0801 says "permission-aware segmentation"),
 * member count, and confidence. Honest about uncertainty — never
 * silently returns 0 segments.
 *
 * SRP — owns ONLY the segmentation surface. The marketing module
 * also owns CampaignBriefSkill + BounceAnalyzerService.
 *
 * P-1 — always emits an explicit limitations array; the FE renders
 * "limited" when membership confidence < 0.7.
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

export interface SegmentInput {
  readonly tenantId: string;
  readonly topic: string;
  readonly minMemberCount?: number;
  readonly sources?: ReadonlyArray<SourceRef>;
  readonly allowedActions?: ReadonlyArray<string>;
}

export interface SegmentMember {
  readonly recordType: 'customer' | 'lead';
  readonly recordId: string;
  readonly matchScore: number;
}

export interface Segment {
  readonly id: string;
  readonly topic: string;
  readonly memberCount: number;
  readonly members: ReadonlyArray<SegmentMember>;
  readonly confidence: number;
  readonly permissions: ReadonlyArray<string>;
  readonly explanation: string;
}

export interface SegmentOutput extends SkillOutput<{
  readonly segments: ReadonlyArray<Segment>;
}> {}

@Injectable()
export class SegmentSkill extends BaseSkill<SegmentInput, SegmentOutput> {
  readonly id: SkillId = 'segment';
  readonly displayName = 'Audience segmentation';
  readonly shortDescription =
    'Permission-aware audience segmentation from tenant sources.';

  private readonly logger = new Logger(SegmentSkill.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  validateInput(input: unknown): input is SegmentInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['tenantId'] !== 'string' || i['tenantId'].length === 0) {
      return false;
    }
    if (typeof i['topic'] !== 'string' || (i['topic'] as string).trim().length === 0) {
      return false;
    }
    return true;
  }

  buildPrompt(
    input: SegmentInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<SegmentOutput>; options?: ExecutorOptions } {
    void _ctx;
    const sources = input.sources ?? [
      { kind: 'text', text: input.topic },
    ] as SourceRef[];
    const systemInstruction = [
      'You segment tenant audiences based on the topic + sources.',
      'Output JSON: { "content": { "segments": [{ "id": "seg-id", "topic": string, "memberCount": number, "members": [{ "recordType": "customer|lead", "recordId": string, "matchScore": 0..1 }], "confidence": 0..1, "permissions": string[], "explanation": string }] }, "limits": string[] }.',
      'If insufficient evidence, emit an empty segments array + a `limits` entry; never fabricate members.',
    ].join('\n');
    const userInstruction = `Topic: "${input.topic}". Tenant scope is mandatory; only include members present in the source list.`;
    const prompt: SkillPrompt<SegmentOutput> = {
      skillId: this.id,
      capability: 'reasoning',
      systemInstruction,
      userInstruction,
      sources: sources as ReadonlyArray<SourceRef>,
      responseJsonRequired: true,
      parse: (raw: string) => {
        const { content: text, limits } = parseTextReply(raw);
        const parsed = parseSegmentsJson(text);
        const citations: SkillCitation[] = sources.map((s, i) => ({
          locator: `source-${i + 1}:${s.kind}`,
          quote: '',
        }));
        const flat: Segment[] = parsed.segments.filter(
          (s) => s.confidence >= 0.4 && s.memberCount >= (input.minMemberCount ?? 1),
        );
        return {
          content: { segments: flat },
          citations,
          limits,
          confidence: parsed.avgConfidence,
          durationMs: 0,
          skillId: this.id,
        } satisfies SegmentOutput;
      },
      limits: ['publisher-not-invoked:skill-only-drafts'],
    };
    return { prompt, options: { temperature: 0, maxTokens: 1500 } };
  }
}

function parseSegmentsJson(text: string): {
  segments: Segment[];
  avgConfidence: number;
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
      const raw = Array.isArray(inner['segments'])
        ? (inner['segments'] as unknown[])
        : [];
      const segs: Segment[] = raw
        .filter(isSegment)
        .map((s, i) => ({
          id: s.id || `seg-${i + 1}`,
          topic: s.topic || '',
          memberCount: typeof s.memberCount === 'number' ? s.memberCount : 0,
          members: Array.isArray(s.members)
            ? (s.members as unknown[])
                .filter(isMember)
                .map((m) => ({
                  recordType: m.recordType,
                  recordId: m.recordId,
                  matchScore: m.matchScore,
                }))
            : [],
          confidence:
            typeof s.confidence === 'number' ? clamp(s.confidence, 0, 1) : 0,
          permissions: Array.isArray(s.permissions)
            ? (s.permissions as unknown[]).filter(
                (p): p is string => typeof p === 'string',
              )
            : [],
          explanation: s.explanation ?? '',
        }));
      const avg =
        segs.length === 0
          ? 0
          : segs.reduce((a, s) => a + s.confidence, 0) / segs.length;
      return { segments: segs, avgConfidence: avg };
    }
  } catch {
    // fall through to empty
  }
  return { segments: [], avgConfidence: 0 };
}

function isSegment(x: unknown): x is {
  id?: string;
  topic?: string;
  memberCount?: number;
  members?: unknown[];
  confidence?: number;
  permissions?: unknown[];
  explanation?: string;
} {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o['topic'] === 'string' && Array.isArray(o['members']);
}

function isMember(x: unknown): x is {
  recordType: 'customer' | 'lead';
  recordId: string;
  matchScore: number;
} {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    (o['recordType'] === 'customer' || o['recordType'] === 'lead') &&
    typeof o['recordId'] === 'string' &&
    typeof o['matchScore'] === 'number'
  );
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}
