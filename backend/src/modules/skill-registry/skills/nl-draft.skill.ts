/**
 * Phase 13 — NlDraftSkill (CR-AI-0603).
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-13-14.md §3.
 *
 * Generates a typed `SkillGraph` from natural language. Per the
 * baseline, this skill DOES NOT activate. The human reviews the
 * draft and then uses the existing `SkillComposerController` to
 * save / load / simulate it.
 *
 * The contract is non-negotiable: `refusedActivation: true` in the
 * output envelope. The executor's telemetry records `publisher-not-
 * invoked:skill-only-drafts` so the operator sees the flow.
 *
 * SRP — validates input + builds a prompt + parses JSON. Does NOT
 * write to the skill registry. Does NOT call SkillGraphService.save().
 */

import { Injectable, Logger } from '@nestjs/common';
import { BaseSkill } from './base.skill';
import { SkillId, SkillExecutionContext } from '../interfaces/skill.interface';
import {
  SourceRef,
  SkillCitation,
  SkillOutput,
} from '../interfaces/skill.types';
import { SkillPrompt, parseTextReply } from '../skill-prompt';
import { ExecutorOptions } from '../skill-executor.service';

export interface NlDraftInput {
  readonly naturalLanguage: string;
  readonly targetMode: 'chat' | 'workflow';
}

export interface NlDraftGraph {
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly kind: 'prompt' | 'read' | 'action' | 'transform' | 'approval' | 'envelope';
    readonly label: string;
    readonly config: Readonly<Record<string, unknown>>;
  }>;
  readonly edges: ReadonlyArray<{
    readonly from: string;
    readonly to: string;
  }>;
  readonly inputs: ReadonlyArray<{ name: string; type: string }>;
  readonly outputs: ReadonlyArray<{ name: string; type: string }>;
}

export interface NlDraftOutput extends SkillOutput<{
  readonly draftGraph: NlDraftGraph;
  readonly explainedIntents: ReadonlyArray<string>;
  readonly refusedActivation: true;
}> {}

@Injectable()
export class NlDraftSkill extends BaseSkill<NlDraftInput, NlDraftOutput> {
  readonly id: SkillId = 'nl-draft';
  readonly displayName = 'NL skill draft';
  readonly shortDescription =
    'Generate a typed skill graph from natural language — drafts only, never activates.';

  validateInput(input: unknown): input is NlDraftInput {
    if (!input || typeof input !== 'object') return false;
    const i = input as Record<string, unknown>;
    if (typeof i['naturalLanguage'] !== 'string') return false;
    if ((i['naturalLanguage'] as string).trim().length === 0) return false;
    const mode = i['targetMode'];
    return mode === 'chat' || mode === 'workflow';
  }

  buildPrompt(
    input: NlDraftInput,
    _ctx: SkillExecutionContext,
  ): { prompt: SkillPrompt<NlDraftOutput>; options?: ExecutorOptions } {
    const systemInstruction = [
      'You draft skill graphs from natural language. You NEVER activate them.',
      'Reply as JSON matching this shape:',
      '{"content": {"draftGraph": {"nodes": [{"id": string, "kind": string, "label": string, "config": {}}], "edges": [{"from": string, "to": string}], "inputs": [{"name": string, "type": string}], "outputs": [{"name": string, "type": string}]}, "explainedIntents": string[]}, "limits": string[]}.',
    ].join('\n');
    const userInstruction =
      `Draft a ${input.targetMode} skill that does the following: ${input.naturalLanguage}. ` +
      `Every node MUST declare a kind from {prompt, read, action, transform, approval, envelope}. ` +
      `NEVER include any activation hint — the operator reviews the draft.`;

    return {
      prompt: {
        skillId: this.id,
        capability: 'reasoning',
        systemInstruction,
        userInstruction,
        // NL-draft produces a draft from text alone — no SourceRef inputs.
        sources: [
          {
            kind: 'text',
            text: input.naturalLanguage,
          } satisfies SourceRef,
        ],
        responseJsonRequired: true,
        parse: (raw: string) => {
          const { content: text, limits } = parseTextReply(raw);
          const parsed = parseNlDraftJson(text);
          const citations: SkillCitation[] = [
            {
              locator: `nl-draft:${input.targetMode}`,
              quote: input.naturalLanguage.slice(0, 200),
            },
          ];
          return {
            content: {
              draftGraph: parsed.graph,
              explainedIntents: parsed.intents,
              refusedActivation: true as const,
            },
            citations,
            limits,
            confidence: 0.75,
            durationMs: 0,
            skillId: this.id,
          } satisfies NlDraftOutput;
        },
        limits: [
          'publisher-not-invoked:skill-only-drafts',
          'NL-draft prohibits direct activation',
        ],
      },
      options: { temperature: 0, maxTokens: 2048 },
    };
  }
}

/**
 * Parse the model's JSON envelope (the model wraps the typed
 * payload as `{ content: { draftGraph, explainedIntents }, limits: [] }`).
 *
 * Falls back to a typed default so we never return partial content.
 */
function parseNlDraftJson(text: string): {
  graph: NlDraftGraph;
  intents: ReadonlyArray<string>;
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
      const graph = (inner['draftGraph'] && typeof inner['draftGraph'] === 'object')
        ? (inner['draftGraph'] as Record<string, unknown>)
        : null;
      if (!graph) {
        throw new Error('missing draftGraph');
      }
      const nodes = Array.isArray(graph['nodes'])
        ? (graph['nodes'] as unknown[]).filter(isDraftNode)
        : [];
      const edges = Array.isArray(graph['edges'])
        ? (graph['edges'] as unknown[]).filter(isDraftEdge)
        : [];
      const inputs = Array.isArray(graph['inputs'])
        ? (graph['inputs'] as unknown[]).filter(isDraftPort)
        : [];
      const outputs = Array.isArray(graph['outputs'])
        ? (graph['outputs'] as unknown[]).filter(isDraftPort)
        : [];
      const intents = Array.isArray(inner['explainedIntents'])
        ? (inner['explainedIntents'] as unknown[])
            .filter((s): s is string => typeof s === 'string')
        : [];
      return {
        graph: { nodes, edges, inputs, outputs },
        intents,
      };
    }
  } catch {
    // fall through to the typed default
  }
  return {
    graph: { nodes: [], edges: [], inputs: [], outputs: [] },
    intents: ['model-produced-no-json'],
  };
}

function isDraftNode(x: unknown): x is NlDraftGraph['nodes'][number] {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  const kind = o['kind'];
  return (
    typeof o['id'] === 'string' &&
    typeof o['label'] === 'string' &&
    typeof o['config'] === 'object' &&
    o['config'] !== null &&
    (kind === 'prompt' ||
      kind === 'read' ||
      kind === 'action' ||
      kind === 'transform' ||
      kind === 'approval' ||
      kind === 'envelope')
  );
}

function isDraftEdge(x: unknown): x is NlDraftGraph['edges'][number] {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o['from'] === 'string' && typeof o['to'] === 'string';
}

function isDraftPort(x: unknown): x is NlDraftGraph['inputs'][number] {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o['name'] === 'string' && typeof o['type'] === 'string';
}
