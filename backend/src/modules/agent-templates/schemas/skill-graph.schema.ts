/**
 * Skill graph schemas — Phase 6 P6
 *
 * Typed Zod-style schemas for the no-code skill composer. We use
 * class-validator-friendly TypeScript interfaces rather than
 * importing a runtime validator to keep this module dependency-free.
 *
 * The composer builds graphs of typed nodes + edges, with ports and
 * deterministic validation. Tools and effects here are *references*
 * — the actual execution is owned by the canonical `IWorkRuntime`
 * and `ToolRegistry`.
 */

export type NodeKind =
  | 'prompt'
  | 'read'
  | 'action'
  | 'condition'
  | 'transform'
  | 'approval'
  | 'envelope';

export interface SkillPort {
  readonly id: string;
  readonly name: string;
  readonly dataType: 'string' | 'number' | 'boolean' | 'record' | 'list' | 'envelope';
  readonly direction: 'IN' | 'OUT';
  readonly required: boolean;
  readonly description?: string;
}

export interface SkillNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly inputs: ReadonlyArray<SkillPort>;
  readonly outputs: ReadonlyArray<SkillPort>;
  readonly description?: string;
  /**
   * Optional authority/effect metadata. The composer derives
   * (rather than trusts) the maximum effect from `config.toolKey`
   * using the canonical `ToolRegistry` lookup — the UI never
   * accepts client-supplied effect downgrades.
   */
  readonly derivesFromToolKey?: string;
}

export interface SkillEdge {
  readonly id: string;
  readonly source: { nodeId: string; portId: string };
  readonly target: { nodeId: string; portId: string };
  readonly description?: string;
}

export type SkillMode = 'chat' | 'workflow';

export interface SkillGraph {
  readonly mode: SkillMode;
  readonly nodes: ReadonlyArray<SkillNode>;
  readonly edges: ReadonlyArray<SkillEdge>;
  readonly inputs: ReadonlyArray<SkillPort>;
  readonly outputs: ReadonlyArray<SkillPort>;
}

export const NODE_KINDS: ReadonlyArray<NodeKind> = [
  'prompt',
  'read',
  'action',
  'condition',
  'transform',
  'approval',
  'envelope',
];

export const PORT_DATA_TYPES: ReadonlyArray<SkillPort['dataType']> = [
  'string',
  'number',
  'boolean',
  'record',
  'list',
  'envelope',
];

export type ValidationIssue = {
  readonly code: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
  readonly message: string;
};

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: ReadonlyArray<ValidationIssue>;
}
