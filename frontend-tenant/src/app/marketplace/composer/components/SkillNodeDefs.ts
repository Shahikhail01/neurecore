'use client';

/**
 * Phase 24 — SkillNodeDefs typed node registry (CR-AI-0602).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 *
 * SOLID — OCP: adding a new node type = one `ISkillNodeDef` entry;
 * the editor and palette read this registry uniformly.
 *
 * LSP: every node def implements `ISkillNodeDef`; the editor
 * renders any def via the same render/validate interface.
 *
 * ISP: `IDragSource`, `IValidation` are the narrow surfaces the
 * editor and composer page depend on.
 *
 * The MVP scope (per plan risk-mitigation #2) ships 4 entry-points:
 * the original 7 node kinds are preserved in the registry but the
 * edit-side palette surfaces the four most-used ones (prompt, read,
 * transform, envelope) by default.
 */

import type { SkillComposerNodeData, SkillComposerNodeKind, SkillComposerPort } from './SkillNode';

export interface ISkillNodeDef {
  readonly kind: SkillComposerNodeKind;
  readonly label: string;
  readonly description: string;
  readonly defaultInputs: ReadonlyArray<SkillComposerPort>;
  readonly defaultOutputs: ReadonlyArray<SkillComposerPort>;
  readonly validate: (node: SkillComposerNodeData) => ReadonlyArray<string>;
}

const NO_ISSUES: ReadonlyArray<string> = Object.freeze([]);

function requireInputs(...ids: string[]) {
  return (node: SkillComposerNodeData): ReadonlyArray<string> => {
    const issues: string[] = [];
    for (const id of ids) {
      if (!node.inputs.find((p) => p.id === id)) {
        issues.push(`${node.kind} node missing required input "${id}"`);
      }
    }
    return issues;
  };
}

export const SKILL_NODE_DEFS: ReadonlyArray<ISkillNodeDef> = [
  {
    kind: 'prompt',
    label: 'Prompt',
    description: 'Captures natural-language input.',
    defaultInputs: [],
    defaultOutputs: [
      { id: 'text', name: 'text', dataType: 'string', direction: 'OUT', required: false },
    ],
    validate: () => NO_ISSUES,
  },
  {
    kind: 'read',
    label: 'Read',
    description: 'Reads a registered record.',
    defaultInputs: [
      { id: 'query', name: 'query', dataType: 'string', direction: 'IN', required: true },
    ],
    defaultOutputs: [
      { id: 'record', name: 'record', dataType: 'record', direction: 'OUT', required: false },
    ],
    validate: requireInputs('query'),
  },
  {
    kind: 'action',
    label: 'Action',
    description: 'Invokes a registered tool.',
    defaultInputs: [
      { id: 'input', name: 'input', dataType: 'record', direction: 'IN', required: true },
    ],
    defaultOutputs: [
      { id: 'result', name: 'result', dataType: 'record', direction: 'OUT', required: false },
    ],
    validate: requireInputs('input'),
  },
  {
    kind: 'condition',
    label: 'Condition',
    description: 'Branches on a typed predicate.',
    defaultInputs: [
      { id: 'predicate', name: 'predicate', dataType: 'boolean', direction: 'IN', required: true },
    ],
    defaultOutputs: [
      { id: 'true', name: 'true', dataType: 'envelope', direction: 'OUT', required: false },
      { id: 'false', name: 'false', dataType: 'envelope', direction: 'OUT', required: false },
    ],
    validate: requireInputs('predicate'),
  },
  {
    kind: 'transform',
    label: 'Transform',
    description: 'Maps typed ports to typed ports.',
    defaultInputs: [
      { id: 'input', name: 'input', dataType: 'record', direction: 'IN', required: true },
    ],
    defaultOutputs: [
      { id: 'output', name: 'output', dataType: 'record', direction: 'OUT', required: false },
    ],
    validate: requireInputs('input'),
  },
  {
    kind: 'approval',
    label: 'Approval',
    description: 'Pauses for human approval.',
    defaultInputs: [
      { id: 'draft', name: 'draft', dataType: 'string', direction: 'IN', required: true },
    ],
    defaultOutputs: [
      { id: 'decision', name: 'decision', dataType: 'boolean', direction: 'OUT', required: false },
    ],
    validate: requireInputs('draft'),
  },
  {
    kind: 'envelope',
    label: 'Envelope',
    description: 'Renders a channel-neutral envelope.',
    defaultInputs: [
      { id: 'response', name: 'response', dataType: 'envelope', direction: 'IN', required: true },
    ],
    defaultOutputs: [
      { id: 'response', name: 'response', dataType: 'envelope', direction: 'OUT', required: true },
    ],
    validate: requireInputs('response'),
  },
];

export const SKILL_NODE_DEF_BY_KIND: ReadonlyMap<SkillComposerNodeKind, ISkillNodeDef> = new Map(
  SKILL_NODE_DEFS.map((d) => [d.kind, d]),
);

export function getNodeDef(kind: SkillComposerNodeKind): ISkillNodeDef | undefined {
  return SKILL_NODE_DEF_BY_KIND.get(kind);
}
