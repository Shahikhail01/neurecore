/**
 * Phase 24 — Shared SkillGraph FE type (CR-AI-0602).
 *
 * Mirrors the canonical backend schema at
 * `backend/src/modules/agent-templates/schemas/skill-graph.schema.ts`.
 */

export type SkillGraphNodeKind =
  | 'prompt'
  | 'read'
  | 'action'
  | 'condition'
  | 'transform'
  | 'approval'
  | 'envelope';

export interface SkillGraphPort {
  readonly id: string;
  readonly name: string;
  readonly dataType: 'string' | 'number' | 'boolean' | 'record' | 'list' | 'envelope';
  readonly direction: 'IN' | 'OUT';
  readonly required: boolean;
  readonly description?: string;
}

export interface SkillGraphNode {
  readonly id: string;
  readonly kind: SkillGraphNodeKind;
  readonly label: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly inputs: ReadonlyArray<SkillGraphPort>;
  readonly outputs: ReadonlyArray<SkillGraphPort>;
  readonly description?: string;
  readonly derivesFromToolKey?: string;
}

export interface SkillGraphEdge {
  readonly id: string;
  readonly source: { nodeId: string; portId: string };
  readonly target: { nodeId: string; portId: string };
  readonly description?: string;
}

export type SkillGraphMode = 'chat' | 'workflow';

export interface SkillGraph {
  readonly mode: SkillGraphMode;
  readonly nodes: ReadonlyArray<SkillGraphNode>;
  readonly edges: ReadonlyArray<SkillGraphEdge>;
  readonly inputs: ReadonlyArray<SkillGraphPort>;
  readonly outputs: ReadonlyArray<SkillGraphPort>;
}
