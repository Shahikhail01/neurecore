/**
 * P6 — Skill composer unit tests.
 */

import { SkillGraphService } from '../../../src/modules/agent-templates/services/skill-graph.service';
import {
  NlDraftService,
  DeterministicDraftSynthesizer,
} from '../../../src/modules/agent-templates/services/nl-draft.service';
import { SkillSimulationService } from '../../../src/modules/agent-templates/services/skill-simulation.service';
import { SkillVersionDiffService } from '../../../src/modules/agent-templates/services/skill-version-diff.service';
import type { SkillGraph } from '../../../src/modules/agent-templates/schemas/skill-graph.schema';

const baseGraph: SkillGraph = {
  mode: 'workflow',
  nodes: [],
  edges: [],
  inputs: [],
  outputs: [],
};

function node(
  id: string,
  kind:
    | 'prompt'
    | 'read'
    | 'action'
    | 'condition'
    | 'transform'
    | 'approval'
    | 'envelope',
  inputs: Array<{
    id: string;
    name: string;
    dataType: 'string' | 'number' | 'boolean' | 'record' | 'list' | 'envelope';
    direction: 'IN' | 'OUT';
    required: boolean;
  }>,
  outputs: typeof inputs,
  config: Record<string, unknown> = {},
) {
  return { id, kind, label: id, config, inputs, outputs };
}

describe('P6 — skill graph validator', () => {
  const svc = new SkillGraphService();

  it('rejects duplicate node ids (R1)', () => {
    const graph: SkillGraph = {
      ...baseGraph,
      nodes: [node('a', 'prompt', [], []), node('a', 'prompt', [], [])],
    };
    const result = svc.validate(graph);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'R1_DUPLICATE_NODE_ID')).toBe(
      true,
    );
  });

  it('rejects cycles (R5)', () => {
    const a = node(
      'a',
      'transform',
      [
        {
          id: 'in',
          name: 'in',
          dataType: 'string',
          direction: 'IN',
          required: true,
        },
      ],
      [
        {
          id: 'out',
          name: 'out',
          dataType: 'string',
          direction: 'OUT',
          required: false,
        },
      ],
    );
    const b = node(
      'b',
      'transform',
      [
        {
          id: 'in',
          name: 'in',
          dataType: 'string',
          direction: 'IN',
          required: true,
        },
      ],
      [
        {
          id: 'out',
          name: 'out',
          dataType: 'string',
          direction: 'OUT',
          required: false,
        },
      ],
    );
    const graph: SkillGraph = {
      ...baseGraph,
      nodes: [a, b],
      edges: [
        {
          id: 'e1',
          source: { nodeId: 'a', portId: 'out' },
          target: { nodeId: 'b', portId: 'in' },
        },
        {
          id: 'e2',
          source: { nodeId: 'b', portId: 'out' },
          target: { nodeId: 'a', portId: 'in' },
        },
      ],
    };
    const result = svc.validate(graph);
    expect(result.issues.some((i) => i.code === 'R5_CYCLE_DETECTED')).toBe(
      true,
    );
  });

  it('rejects action nodes without timeoutMs (R7)', () => {
    const a = node(
      'a',
      'action',
      [
        {
          id: 'in',
          name: 'in',
          dataType: 'record',
          direction: 'IN',
          required: true,
        },
      ],
      [
        {
          id: 'out',
          name: 'out',
          dataType: 'record',
          direction: 'OUT',
          required: false,
        },
      ],
      { toolKey: 'foo.bar', retryMax: 0, idempotencyKey: 'k' },
    );
    const result = svc.validate({ ...baseGraph, nodes: [a] });
    expect(result.issues.some((i) => i.code === 'R7_TIMEOUT_MISSING')).toBe(
      true,
    );
  });

  it('accepts a valid minimal graph', () => {
    const prompt = node(
      'p',
      'prompt',
      [],
      [
        {
          id: 'text',
          name: 'text',
          dataType: 'string',
          direction: 'OUT',
          required: false,
        },
      ],
    );
    const envelope = node(
      'e',
      'envelope',
      [
        {
          id: 'response',
          name: 'response',
          dataType: 'envelope',
          direction: 'IN',
          required: true,
        },
      ],
      [
        {
          id: 'response',
          name: 'response',
          dataType: 'envelope',
          direction: 'OUT',
          required: true,
        },
      ],
      { effect: 'READ', envelopeStrategy: 'table' },
    );
    const graph: SkillGraph = {
      ...baseGraph,
      nodes: [prompt, envelope],
      edges: [
        {
          id: 'pe',
          source: { nodeId: 'p', portId: 'text' },
          target: { nodeId: 'e', portId: 'response' },
        },
      ],
    };
    const result = svc.validate(graph);
    expect(result.ok).toBe(true);
  });
});

describe('P6 — NL draft', () => {
  it('produces a deterministic draft and surfaces restrictions', async () => {
    const svc = new NlDraftService(new DeterministicDraftSynthesizer());
    const r = await svc.draft({ prompt: 'score the lead' });
    expect(r.draft.nodes.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(r.diff)).toBe(true);
  });
});

describe('P6 — simulation', () => {
  it('walks a small graph and records trace', async () => {
    const prompt = node(
      'p',
      'prompt',
      [],
      [
        {
          id: 'text',
          name: 'text',
          dataType: 'string',
          direction: 'OUT',
          required: false,
        },
      ],
    );
    const envelope = node(
      'e',
      'envelope',
      [
        {
          id: 'response',
          name: 'response',
          dataType: 'envelope',
          direction: 'IN',
          required: true,
        },
      ],
      [
        {
          id: 'response',
          name: 'response',
          dataType: 'envelope',
          direction: 'OUT',
          required: true,
        },
      ],
      { effect: 'READ', envelopeStrategy: 'table' },
    );
    const svc = new SkillSimulationService({} as never);
    const result = await svc.simulate(
      'tenant-1',
      {
        mode: 'workflow',
        inputs: [],
        outputs: [],
        nodes: [prompt, envelope],
        edges: [
          {
            id: 'pe',
            source: { nodeId: 'p', portId: 'text' },
            target: { nodeId: 'e', portId: 'response' },
          },
        ],
      },
      { name: 'smoke', inputs: { text: 'hi' } },
    );
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.scenario).toBe('smoke');
  });
});

describe('P6 — version diff', () => {
  it('reports node additions and modifications', () => {
    const svc = new SkillVersionDiffService();
    const before: SkillGraph = {
      ...baseGraph,
      nodes: [node('a', 'prompt', [], [])],
    };
    const after: SkillGraph = {
      ...baseGraph,
      nodes: [node('a', 'transform', [], []), node('b', 'prompt', [], [])],
    };
    const diff = svc.diff(before, after);
    expect(diff.entries.some((e) => e.op === 'add' && e.id === 'b')).toBe(true);
    expect(diff.entries.some((e) => e.op === 'modify' && e.id === 'a')).toBe(
      true,
    );
  });
});
