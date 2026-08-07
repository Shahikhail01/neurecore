/**
 * Phase 11 — Draft Report skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0106 / GEN-006.
 *
 * Drafts a structured report from a prompt + sources. Output is
 * markdown by default; HTML/plain available. Sections are optional;
 * when omitted the model chooses a default structure.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import { SourceRef, SkillOutput, ReportFormat } from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface DraftReportInput {
  readonly topic: string;
  readonly sources: ReadonlyArray<SourceRef>;
  readonly sections?: ReadonlyArray<string>;
  readonly format?: ReportFormat;
  readonly locale?: string;
}

export interface DraftReportOutput extends SkillOutput<string> {}

const DEFAULT_SECTIONS = [
  'Executive summary',
  'Findings',
  'Evidence',
  'Recommendations',
  'Appendices',
] as const;

@Injectable()
export class DraftReportSkill extends BaseSkill<DraftReportInput, DraftReportOutput> {
  readonly id: SkillId = 'draft-report';
  readonly displayName = 'Draft report';
  readonly shortDescription =
    'Compose a structured report grounded in tenant data.';

  validateInput(input: unknown): input is DraftReportInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    return typeof i['topic'] === 'string' && (i['topic'] as string).length > 0;
  }

  buildPrompt(
    input: DraftReportInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<DraftReportOutput>; options?: ExecutorOptions } {
    const sections = input.sections ?? DEFAULT_SECTIONS;
    const format = input.format ?? 'markdown';
    const systemInstruction = [
      'You draft structured reports from a topic + sources.',
      'Cite every claim to the source it came from.',
      `Reply as ${format.toUpperCase()} inside JSON: {"content": string, "limits": string[]}.`,
    ].join(' ');
    const userInstruction =
      `Draft a report on: "${input.topic}".\n` +
      `Sections (required):\n` +
      sections.map((s) => `  - ${s}`).join('\n');

    return {
      prompt: {
        skillId: this.id,
        capability: 'conversation',
        systemInstruction,
        userInstruction,
        sources: [...input.sources],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content, limits } = parseTextReply(raw);
          return {
            content,
            citations: input.sources.map((s) => ({ locator: this.locator(s), quote: '' })),
            limits,
            confidence: 0.85,
            durationMs: 0,
            skillId: this.id,
          } satisfies DraftReportOutput;
        },
      },
      options: { temperature: 0, maxTokens: 3000 },
    };
  }

  private locator(s: SourceRef): string {
    if (s.kind === 'record') return `${s.recordType}:${s.recordId}`;
    if (s.kind === 'thread') return `thread:${s.threadId}`;
    if (s.kind === 'file') return `file:${s.fileId}`;
    return 'inline';
  }
}
