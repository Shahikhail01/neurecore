/**
 * Phase 11 — Compare skill.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE11.md. CR-AI-0105 / GEN-005.
 *
 * Side-by-side comparison of two records or files with provenance
 * per claim. Output is markdown with a per-dimension breakdown.
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import { SourceRef, SkillOutput } from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface CompareInput {
  readonly left: SourceRef;
  readonly right: SourceRef;
  readonly dimensions?: ReadonlyArray<string>;
  readonly locale?: string;
}

export interface CompareOutput extends SkillOutput<string> {}

const DEFAULT_DIMENSIONS = [
  'metadata (dates, owners, status)',
  'content (values, definitions)',
  'relationships (linked records)',
  'actions (next steps, approvals)',
] as const;

@Injectable()
export class CompareSkill extends BaseSkill<CompareInput, CompareOutput> {
  readonly id: SkillId = 'compare';
  readonly displayName = 'Compare';
  readonly shortDescription =
    'Compare two records or files and surface the differences with provenance.';

  validateInput(input: unknown): input is CompareInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    const left = i['left'] as Record<string, unknown> | undefined;
    const right = i['right'] as Record<string, unknown> | undefined;
    if (!left || !right) return false;
    return 'kind' in left && 'kind' in right;
  }

  buildPrompt(
    input: CompareInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<CompareOutput>; options?: ExecutorOptions } {
    const dims = input.dimensions ?? DEFAULT_DIMENSIONS;
    const systemInstruction = [
      'You compare two sources and surface differences with provenance.',
      'Reply as JSON: {"content": markdown_string, "limits": string[]}.',
      'Cite each difference to the source it came from. If both sides disagree, mark the row "DIFFERS".',
    ].join(' ');
    const userInstruction =
      `Compare the two sources across these dimensions:\n` +
      dims.map((d) => `  - ${d}`).join('\n') +
      `\nUse a markdown table; cite sources inline.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        sources: [input.left, input.right],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content, limits } = parseTextReply(raw);
          return {
            content,
            citations: [
              { locator: 'left',  quote: '' },
              { locator: 'right', quote: '' },
            ],
            limits,
            confidence: 0.85,
            durationMs: 0,
            skillId: this.id,
          } satisfies CompareOutput;
        },
      },
      options: { temperature: 0, maxTokens: 1500 },
    };
  }
}
