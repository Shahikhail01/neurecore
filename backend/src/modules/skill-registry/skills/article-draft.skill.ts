/**
 * Phase 12 — ArticleDraftSkill (CR-AI-0303).
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE12.md §3.
 *
 * Drafts a knowledge article from a topic + sources. Output follows
 * the Creator-style governed publication schema (title, body
 * markdown, suggested tags, source list). Sending/publishing is NOT
 * the skill's job — the skill only DRAFTS, per P−1.
 *
 * SRP: validates input + builds prompt + parses JSON. Does NOT
 * publish; does NOT mutate state.
 *
 * SOLID/ISP: reuses the ISkill<I,O> + SkillPrompt contracts from
 * Phase 11 unchanged.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import {
  SourceRef,
  SkillOutput,
  SkillCitation,
} from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface ArticleDraftInput {
  readonly topic: string;
  readonly sources: ReadonlyArray<SourceRef>;
  readonly intent?: 'how-to' | 'concept' | 'faq' | 'reference';
  readonly governedBy?: string;
}

export interface ArticleDraftOutput extends SkillOutput<{
  readonly title: string;
  readonly bodyMarkdown: string;
  readonly proposedTags: ReadonlyArray<string>;
  readonly sources: ReadonlyArray<string>;
}> {}

const DEFAULT_TAGS = ['knowledge-base'];

@Injectable()
export class ArticleDraftSkill extends BaseSkill<ArticleDraftInput, ArticleDraftOutput> {
  readonly id: SkillId = 'article-draft';
  readonly displayName = 'Draft knowledge article';
  readonly shortDescription =
    'Compose a knowledge article from a topic + sources with governed publication metadata.';

  validateInput(input: unknown): input is ArticleDraftInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['topic'] !== 'string' || (i['topic'] as string).trim().length === 0) {
      return false;
    }
    if (!Array.isArray(i['sources'])) return false;
    return i['sources'].length > 0;
  }

  buildPrompt(
    input: ArticleDraftInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<ArticleDraftOutput>; options?: ExecutorOptions } {
    const intent = input.intent ?? 'concept';
    const systemInstruction = [
      'You draft knowledge articles.',
      'You NEVER publish; you produce a typed draft only.',
      'Cite each non-trivial claim to the source it came from.',
      'Reply as JSON matching:',
      '{"content": {"title": string, "bodyMarkdown": string, "proposedTags": string[], "sources": string[]}, "limits": string[]}.',
    ].join(' ');
    const userInstruction =
      `Draft a ${intent} knowledge article on: "${input.topic}".\n` +
      `Tag suggestions: ${DEFAULT_TAGS.join(', ')}. Provide source references.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        sources: [...input.sources],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content: text, limits } = parseTextReply(raw);
          const parsed = parseDraftJson(text, input.topic);
          const citations: SkillCitation[] = [...input.sources].map((s, i) =>
            this.locatorCitation(s, i),
          );
          return {
            content: parsed,
            citations,
            limits,
            confidence: 0.85,
            durationMs: 0,
            skillId: this.id,
          } satisfies ArticleDraftOutput;
        },
        limits: ['publisher-not-invoked:skill-only-drafts'],
      },
      options: { temperature: 0, maxTokens: 3000 },
    };
  }

  private locatorCitation(s: SourceRef, i: number): SkillCitation {
    if (s.kind === 'record') {
      return {
        recordType: s.recordType,
        recordId: s.recordId,
        locator: `source-${i + 1}:${s.recordType}:${s.recordId}`,
        quote: '',
      };
    }
    if (s.kind === 'thread') {
      return {
        threadId: s.threadId,
        locator: `source-${i + 1}:thread:${s.threadId}`,
        quote: '',
      };
    }
    if (s.kind === 'file') {
      return {
        fileId: s.fileId,
        locator: `source-${i + 1}:file:${s.fileId}`,
        quote: '',
      };
    }
    return { locator: `source-${i + 1}:inline`, quote: '' };
  }
}

function parseDraftJson(
  text: string,
  fallbackTopic: string,
): { title: string; bodyMarkdown: string; proposedTags: string[]; sources: string[] } {
  const trimmed = text.trim();
  const fenced = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```$/, '')
    : trimmed;
  try {
    const obj = JSON.parse(fenced) as unknown;
    if (obj && typeof obj === 'object') {
      const o = obj as Record<string, unknown>;
      // The model wraps the typed draft as { content: {...}, limits: string[] }.
      // We unwrap that envelope first.
      const inner = (o['content'] && typeof o['content'] === 'object')
        ? (o['content'] as Record<string, unknown>)
        : o;
      const candidateTitle = typeof inner['title'] === 'string' ? (inner['title'] as string) : fallbackTopic;
      const candidateBody =
        typeof inner['bodyMarkdown'] === 'string'
          ? (inner['bodyMarkdown'] as string)
          : text;
      const candidateTags = Array.isArray(inner['proposedTags'])
        ? (inner['proposedTags'] as unknown[]).filter(
            (t): t is string => typeof t === 'string',
          )
        : [...DEFAULT_TAGS];
      const candidateSources = Array.isArray(inner['sources'])
        ? (inner['sources'] as unknown[]).filter(
            (s): s is string => typeof s === 'string',
          )
        : [];
      return {
        title: candidateTitle,
        bodyMarkdown: candidateBody,
        proposedTags: candidateTags,
        sources: candidateSources,
      };
    }
  } catch {
    // Fall through to typed default.
  }
  // Fallback — wrap the whole reply as the body and synthesise title from topic.
  return {
    title: fallbackTopic,
    bodyMarkdown: text,
    proposedTags: [...DEFAULT_TAGS],
    sources: [],
  };
}
