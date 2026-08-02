/**
 * NlDraftService — Phase 6 P6
 *
 * Deterministic, LLM-driven natural-language drafting of skill graphs.
 *
 * SECURITY:
 *   - NEVER produces an executable SkillGraph directly.
 *   - Always returns a `Draft` (typed) and a structural Diff against
 *     the caller's `current` graph. The user must explicitly
 *     promote the draft via SkillComposerController.promote before
 *     it becomes an authenticated, certified AgentSkillDefinition.
 *   - Output is untrusted input to subsequent validation passes
 *     (SkillGraphService.validate is mandatory before promote).
 *
 * Open/Closed: swapping the LLM provider is done by replacing the
 * injected `IDraftSynthesizer` — the service is closed otherwise.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  SkillGraph,
  SkillNode,
  SkillEdge,
  SkillPort,
  NodeKind,
} from '../schemas/skill-graph.schema';

export const DRAFT_SYNTHESIZER = Symbol('DRAFT_SYNTHESIZER');

export interface IDraftSynthesizer {
  synthesize(input: {
    prompt: string;
    current?: SkillGraph;
    mode: SkillGraph['mode'];
  }): Promise<DraftResponse>;
}

export interface DraftResponse {
  readonly graph: SkillGraph;
  readonly notes: string[];
}

export interface NlDraftResult {
  readonly draft: DraftGraph;
  readonly diff: DiffEntry[];
  readonly warnings: string[];
  readonly notes: string[];
}

export interface DraftGraph {
  readonly mode: SkillGraph['mode'];
  readonly nodes: readonly SkillNode[];
  readonly edges: readonly SkillEdge[];
  readonly inputs: readonly SkillPort[];
  readonly outputs: readonly SkillPort[];
  readonly rationale: string;
}

export interface DiffEntry {
  readonly op: 'add' | 'remove' | 'modify';
  readonly target: 'node' | 'edge' | 'port' | 'mode';
  readonly id: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

@Injectable()
export class NlDraftService {
  private readonly logger = new Logger(NlDraftService.name);

  constructor(
    @Inject(DRAFT_SYNTHESIZER) private readonly synthesizer: IDraftSynthesizer,
  ) {}

  async draft(args: {
    prompt: string;
    current?: SkillGraph;
    mode?: SkillGraph['mode'];
  }): Promise<NlDraftResult> {
    const mode = args.mode ?? args.current?.mode ?? 'workflow';
    const llmResp = await this.synthesizer.synthesize({
      prompt: args.prompt,
      current: args.current,
      mode,
    });
    const draft = this.coerceToDraft(llmResp);
    const diff = this.diffAgainstCurrent(args.current, draft);
    const warnings = this.detectRestrictions(draft);
    return {
      draft,
      diff,
      warnings,
      notes: llmResp.notes,
    };
  }

  private coerceToDraft(resp: DraftResponse): DraftGraph {
    return {
      mode: resp.graph.mode,
      nodes: resp.graph.nodes.map((n) => ({
        ...n,
        config: Object.freeze({ ...n.config }),
        inputs: Object.freeze([...n.inputs]),
        outputs: Object.freeze([...n.outputs]),
      })),
      edges: Object.freeze([...resp.graph.edges]),
      inputs: Object.freeze([...resp.graph.inputs]),
      outputs: Object.freeze([...resp.graph.outputs]),
      rationale: resp.notes.join(' ').trim(),
    };
  }

  private diffAgainstCurrent(
    current: SkillGraph | undefined,
    draft: DraftGraph,
  ): DiffEntry[] {
    const out: DiffEntry[] = [];
    if (!current) {
      for (const n of draft.nodes) {
        out.push({ op: 'add', target: 'node', id: n.id, after: n });
      }
      for (const e of draft.edges) {
        out.push({ op: 'add', target: 'edge', id: e.id, after: e });
      }
      return out;
    }
    const curNodes = new Map(current.nodes.map((n) => [n.id, n]));
    for (const node of draft.nodes) {
      const before = curNodes.get(node.id);
      if (!before) {
        out.push({ op: 'add', target: 'node', id: node.id, after: node });
      } else if (!this.deepEqual(before, node)) {
        out.push({
          op: 'modify',
          target: 'node',
          id: node.id,
          before,
          after: node,
        });
      }
    }
    for (const prev of current.nodes) {
      if (!draft.nodes.some((n) => n.id === prev.id)) {
        out.push({ op: 'remove', target: 'node', id: prev.id, before: prev });
      }
    }
    const curEdges = new Map(current.edges.map((e) => [e.id, e]));
    for (const edge of draft.edges) {
      const before = curEdges.get(edge.id);
      if (!before)
        out.push({ op: 'add', target: 'edge', id: edge.id, after: edge });
      else if (!this.deepEqual(before, edge)) {
        out.push({
          op: 'modify',
          target: 'edge',
          id: edge.id,
          before,
          after: edge,
        });
      }
    }
    for (const prev of current.edges) {
      if (!draft.edges.some((e) => e.id === prev.id)) {
        out.push({ op: 'remove', target: 'edge', id: prev.id, before: prev });
      }
    }
    if (current.mode !== draft.mode) {
      out.push({
        op: 'modify',
        target: 'mode',
        id: 'mode',
        before: current.mode,
        after: draft.mode,
      });
    }
    return out;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return false;
    if (typeof a === 'object' && typeof b === 'object') {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Hard restrictions in the no-code trust boundary: any draft that
   * includes arbitrary code/SQL/shell/secrets/unregistered-http is
   * surfaced as a warning so the user cannot silently bypass the
   * canonical tool registry.
   */
  private detectRestrictions(draft: DraftGraph): string[] {
    const restricted: string[] = [];
    const deny = ['shell:', 'sql:', 'exec(', 'os.system', 'eval('];
    const json = JSON.stringify(draft);
    for (const d of deny) {
      if (json.includes(d)) {
        restricted.push(`draft contains forbidden token "${d}"`);
      }
    }
    if (
      /(api[_-]?key|secret|password|token)/i.test(json) &&
      /[=:]\s*['"][a-zA-Z0-9_-]{12,}['"]/.test(json)
    ) {
      restricted.push(
        'draft contains a literal credential — not allowed in the no-code trust boundary',
      );
    }
    return restricted;
  }
}

export class DeterministicDraftSynthesizer implements IDraftSynthesizer {
  synthesize(input: {
    prompt: string;
    current?: SkillGraph;
    mode: SkillGraph['mode'];
  }): Promise<DraftResponse> {
    void input;
    void this;
    return Promise.resolve(this.buildDraft(input));
  }

  private buildDraft(input: {
    prompt: string;
    current?: SkillGraph;
    mode: SkillGraph['mode'];
  }): DraftResponse {
    void input.current;
    const prompt = input.prompt.toLowerCase();
    const wantsEmail = /email|send|notify/.test(prompt);
    const wantsScore = /score|qualif|predict/.test(prompt);
    const nodes: SkillNode[] = [this.buildPromptNode(input)];
    const edges: SkillEdge[] = [];
    const read: SkillNode = this.buildReadNode();
    nodes.push(read);
    if (wantsScore) {
      const predict: SkillNode = this.buildPredictNode();
      nodes.push(predict);
      edges.push(this.connectEdgePlaceholder(read, predict));
    }
    if (wantsEmail) {
      const approval = this.buildApprovalNode();
      const action = this.buildEmailDraftNode();
      nodes.push(approval, action);
      edges.push(this.connectEdgePlaceholder(approval, action));
    }
    const envelope = this.buildEnvelopeNode();
    nodes.push(envelope);
    return {
      graph: {
        mode: input.mode,
        nodes,
        edges,
        inputs: [],
        outputs: envelope.outputs,
      },
      notes: [
        'deterministic draft — produced without an external LLM call',
        'user must validate and promote to activate',
      ],
    };
  }

  private buildPromptNode(input: {
    prompt: string;
    mode: SkillGraph['mode'];
  }): SkillNode {
    void input;
    return {
      id: 'prompt-1',
      kind: 'prompt',
      label: 'User prompt',
      inputs: [],
      outputs: [
        {
          id: 'text',
          name: 'text',
          dataType: 'string',
          direction: 'OUT',
          required: false,
        },
      ],
      config: { template: input.prompt },
      description: 'Captures the natural-language request',
    };
  }
  private buildReadNode(): SkillNode {
    return {
      id: 'read-1',
      kind: 'read',
      label: 'Read context record',
      inputs: [
        {
          id: 'query',
          name: 'query',
          dataType: 'string',
          direction: 'IN',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'record',
          name: 'record',
          dataType: 'record',
          direction: 'OUT',
          required: false,
        },
      ],
      config: { readCapabilityKey: 'context.record.read' },
    };
  }
  private buildPredictNode(): SkillNode {
    return {
      id: 'predict-1',
      kind: 'action',
      label: 'Predict score',
      inputs: [
        {
          id: 'features',
          name: 'features',
          dataType: 'record',
          direction: 'IN',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'score',
          name: 'score',
          dataType: 'number',
          direction: 'OUT',
          required: false,
        },
      ],
      config: {
        toolKey: 'analytics.predict',
        effect: 'READ',
        authorityCeiling: 1,
        timeoutMs: 3000,
        retryMax: 1,
        idempotencyKey: ['subject.type', 'subject.id'],
        approvalSensitive: false,
      },
    };
  }
  private buildApprovalNode(): SkillNode {
    return {
      id: 'approval-1',
      kind: 'approval',
      label: 'Approval checkpoint',
      inputs: [
        {
          id: 'draft',
          name: 'draft',
          dataType: 'string',
          direction: 'IN',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'decision',
          name: 'decision',
          dataType: 'boolean',
          direction: 'OUT',
          required: false,
        },
      ],
      config: {
        toolKey: 'governance.approval.pause',
        effect: 'EXECUTE_EXTERNAL',
        authorityCeiling: 3,
        timeoutMs: 5000,
        retryMax: 0,
        idempotencyKey: 'approval-pause-key',
        approvalSensitive: true,
      },
    };
  }
  private buildEmailDraftNode(): SkillNode {
    return {
      id: 'action-email',
      kind: 'action',
      label: 'Draft email',
      inputs: [
        {
          id: 'recipient',
          name: 'recipient',
          dataType: 'string',
          direction: 'IN',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'draft',
          name: 'draft',
          dataType: 'string',
          direction: 'OUT',
          required: false,
        },
      ],
      config: {
        toolKey: 'integrations.email.draft',
        effect: 'EXECUTE_EXTERNAL',
        authorityCeiling: 3,
        timeoutMs: 8000,
        retryMax: 2,
        idempotencyKey: ['provider', 'recipient'],
        compensationKey: 'integrations.email.delete',
        approvalSensitive: true,
      },
    };
  }
  private buildEnvelopeNode(): SkillNode {
    return {
      id: 'envelope-1',
      kind: 'envelope',
      label: 'Response envelope',
      inputs: [
        {
          id: 'response',
          name: 'response',
          dataType: 'envelope',
          direction: 'IN',
          required: true,
        },
      ],
      outputs: [
        {
          id: 'response',
          name: 'response',
          dataType: 'envelope',
          direction: 'OUT',
          required: true,
        },
      ],
      config: { envelopeStrategy: 'table' },
    };
  }

  private connectEdgePlaceholder(
    _source: SkillNode,
    _target: SkillNode,
  ): SkillEdge {
    void _source;
    void _target;
    return {
      id: 'edge-placeholder',
      source: { nodeId: 'source', portId: 'out' },
      target: { nodeId: 'target', portId: 'in' },
    };
  }
}
