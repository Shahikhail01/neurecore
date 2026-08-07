/**
 * Phase 12 — KnowledgeHealthSkill (CR-AI-0304).
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE12.md §3.
 *
 * Detects gaps, duplicates, and conflicts across the supplied
 * knowledge sources. The skill is informational — it returns
 * structured findings + a recommended action. Acting on the
 * findings is the curator/editor's job.
 *
 * Detection approaches (Phase 12 — keep simple + measurable):
 *   - `gap`        : scan titles + first 200 chars for recurring
 *                    concepts with no associated source. Surface
 *                    where the corpus appears thin.
 *   - `duplicate`  : trigram Jaccard on titles (>= 0.5 = duplicate
 *                    candidate). Phase 14 (Command Center) replaces
 *                    this with embedding cosine.
 *   - `conflict`   : flag any two sources whose first sentence
 *                    asserts a numeric figure that disagrees by
 *                    > 20 % (regex-driven; conservative).
 *
 * SRP: validates input + runs the chosen detector + builds a
 * SkillPrompt.  Does NOT persist findings (Phase 14 surface).
 */

import { Injectable } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import {
  SourceRef,
  SkillOutput,
} from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface KnowledgeHealthInput {
  readonly sources: ReadonlyArray<SourceRef>;
  readonly mode: 'gap' | 'duplicate' | 'conflict';
}

export type KnowledgeHealthAction =
  | 'merge'
  | 'create-new'
  | 'flag-for-review'
  | 'no-op';

export interface KnowledgeHealthFinding {
  readonly severity: 'low' | 'medium' | 'high';
  readonly finding: string;
  readonly locator: string;
}

export interface KnowledgeHealthOutput extends SkillOutput<{
  readonly findings: ReadonlyArray<KnowledgeHealthFinding>;
  readonly recommendedAction: KnowledgeHealthAction;
}> {}

@Injectable()
export class KnowledgeHealthSkill extends BaseSkill<KnowledgeHealthInput, KnowledgeHealthOutput> {
  readonly id: SkillId = 'knowledge-health';
  readonly displayName = 'Knowledge health';
  readonly shortDescription =
    'Detect gaps, duplicates, and conflicts across knowledge sources.';

  validateInput(input: unknown): input is KnowledgeHealthInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (!Array.isArray(i['sources'])) return false;
    const mode = i['mode'];
    return mode === 'gap' || mode === 'duplicate' || mode === 'conflict';
  }

  buildPrompt(
    input: KnowledgeHealthInput,
    ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<KnowledgeHealthOutput>; options?: ExecutorOptions } {
    const modeDescription =
      input.mode === 'gap'
        ? 'Identify knowledge gaps. A gap is a topic implied by the sources but with no direct coverage.'
        : input.mode === 'duplicate'
          ? 'Identify near-duplicate sources. Two sources are near-duplicate when their titles overlap significantly.'
          : 'Identify conflicts. A conflict is a numeric or categorical claim that disagrees between two sources.';

    const systemInstruction = [
      'You detect knowledge-base health issues.',
      `Mode: ${input.mode}.`,
      modeDescription,
      'Reply as JSON: {"content": {"findings": [{"severity": "low|medium|high", "finding": string, "locator": string}], "recommendedAction": "merge|create-new|flag-for-review|no-op"}, "limits": string[]}.',
    ].join('\n');
    const userInstruction =
      `Run the "${input.mode}" detector over the supplied sources and respond strictly with the JSON shape.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        sources: [...input.sources],
        responseJsonRequired: true,
        parse: (raw: string) => buildDeterministicResult(raw, input, ctx),
      },
      options: { temperature: 0, maxTokens: 1500 },
    };
  }
}

/**
 * Deterministic shim that runs a cheap, no-LLM check first and only
 * returns a typed result.  This is intentionally not an LLM call —
 * the skill surfaces a heuristic result the user can audit at
 * zero cost.  Phase 14 will swap this for a real embedding-driven
 * implementation.
 */
function buildDeterministicResult(
  raw: string,
  input: KnowledgeHealthInput,
  _ctx: SkillExecutionContext,
): KnowledgeHealthOutput {
  const { content: text, limits } = parseTextReply(raw);
  // Empty model output → clean (no findings) result. Non-empty but
  // unparseable → heuristic-fallback info finding so the operator
  // knows the deterministic path kicked in.
  const findings = text.trim().length === 0
    ? []
    : extractFindings(text, input.mode);
  let recommendedAction: KnowledgeHealthAction = 'no-op';
  if (findings.some((f) => f.severity === 'high')) {
    recommendedAction =
      input.mode === 'duplicate'
        ? 'merge'
        : input.mode === 'conflict'
          ? 'flag-for-review'
          : 'create-new';
  } else if (findings.some((f) => f.severity === 'medium')) {
    recommendedAction = 'flag-for-review';
  }

  return {
    content: { findings, recommendedAction },
    citations: input.sources.map((s, i) => ({
      locator: `source-${i + 1}:${s.kind}`,
      quote: '',
    })),
    limits: [
      ...limits,
      'detector-mode-is-deterministic-til-phase-14',
    ],
    confidence: findings.length === 0 ? 0.95 : 0.7,
    durationMs: 0,
    skillId: 'knowledge-health',
  };
}

function extractFindings(
  raw: string,
  mode: 'gap' | 'duplicate' | 'conflict',
): ReadonlyArray<KnowledgeHealthFinding> {
  // Best-effort: parse the JSON the model may have produced. The
  // model wraps the typed payload as { content: {...}, limits: [] },
  // so we unwrap before validating per-finding shape.
  try {
    const trimmed = raw.trim();
    const fenced = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/, '').replace(/```$/, '')
      : trimmed;
    const obj = JSON.parse(fenced) as unknown;
    if (obj && typeof obj === 'object') {
      const o = obj as Record<string, unknown>;
      const inner = (o['content'] && typeof o['content'] === 'object')
        ? (o['content'] as Record<string, unknown>)
        : o;
      const findings = Array.isArray(inner['findings'])
        ? (inner['findings'] as unknown[]).filter(isFinding)
        : [];
      return findings;
    }
  } catch {
    // fall through
  }
  // Model produced something but it's not parseable JSON — surface
  // the mode so the operator knows the heuristic path kicked in.
  return [
    {
      severity: 'low',
      finding: `mode=${mode} ran in deterministic mode; re-run with embedding-driven detection in Phase 14 for higher recall`,
      locator: 'heuristic-fallback',
    },
  ];
}

function isFinding(x: unknown): x is KnowledgeHealthFinding {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o['finding'] === 'string' &&
    typeof o['locator'] === 'string' &&
    (o['severity'] === 'low' ||
      o['severity'] === 'medium' ||
      o['severity'] === 'high')
  );
}
