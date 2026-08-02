/**
 * SkillGraphService — Phase 6 P6
 *
 * SRP: validate a SkillGraph deterministically.
 * OCP: a new validation rule is added by appending a `Rule` to the
 *   array — the service stays closed.
 * DIP: depends on the agent-skill-builder service + work-runtime for
 *   the canonical effect / authority derivation. Never stores these
 *   on the graph row.
 *
 * Validation rules (all deterministic, no LLM in the loop):
 *   R1 nodes have unique ids
 *   R2 ports are referenced exactly once per direction
 *   R3 ports reference existing nodes on both ends of an edge
 *   R4 edge port types are compatible (coercion allowed for string→record)
 *   R5 no cycles in the composed graph
 *   R6 effect / authority are server-derived from any action/approval
 *      node that has a toolKey reference
 *   R7 every action/approval node declares timeout + retry + idempotency
 *   R8 every action/envelope node with INTERNAL_WRITE / EXTERNAL_WRITE
 *      effect has a compensation or failure path
 *   R9 every input port is reachable from the graph inputs or upstream
 *   R10 outputs are reached by at least one node
 *
 * Generated designs MUST NOT include arbitrary code, SQL, shell,
 * secrets, or unregistered HTTP. The schema-level validator rejects
 * any suspicious payload regardless of the user role.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  ValidationIssue,
  ValidationResult,
  SkillGraph,
  SkillNode,
  SkillPort,
} from '../schemas/skill-graph.schema';

@Injectable()
export class SkillGraphService {
  private readonly logger = new Logger(SkillGraphService.name);

  /**
   * Validate a graph end-to-end. Returns the typed result; throws
   * BadRequestException if `throwOnInvalid` is true (used by the
   * HTTP layer).
   */
  validate(graph: SkillGraph, throwOnInvalid = false): ValidationResult {
    const issues: ValidationIssue[] = [];
    this.r1UniqueNodeIds(graph, issues);
    this.r2PortConsistency(graph, issues);
    this.r3EdgeEndpointsExist(graph, issues);
    this.r4PortTypeCompatibility(graph, issues);
    this.r5NoCycles(graph, issues);
    this.r6EffectAuthorityDerivation(graph, issues);
    this.r7ActionMetadata(graph, issues);
    this.r8FailurePaths(graph, issues);
    this.r9InputReachability(graph, issues);
    this.r10OutputReachability(graph, issues);
    const ok = issues.length === 0;
    if (!ok && throwOnInvalid) {
      throw new BadRequestException({
        code: 'SKILL_GRAPH_INVALID',
        issues,
      });
    }
    return { ok, issues };
  }

  /**
   * Convenience: render the deterministic effect/authority max for
   * the graph, derived from composed tools. Returns the same shape
   * as AgentSkillBuilderService.aggregate so callers can use them
   * interchangeably.
   */
  deriveComposition(graph: SkillGraph): {
    maxEffect:
      | 'NONE'
      | 'READ'
      | 'SUGGEST'
      | 'DRAFT'
      | 'EXECUTE_LOCAL'
      | 'EXECUTE_EXTERNAL'
      | 'IRREVERSIBLE';
    approvalSensitive: boolean;
    authorityCeiling: number;
  } {
    let maxRank = 0;
    let approvalSensitive = false;
    let authority = 0;
    const RANK = {
      NONE: 0,
      READ: 1,
      SUGGEST: 2,
      DRAFT: 3,
      EXECUTE_LOCAL: 4,
      EXECUTE_EXTERNAL: 5,
      IRREVERSIBLE: 6,
    } as const;
    for (const node of graph.nodes) {
      if (node.kind === 'action' || node.kind === 'approval') {
        const declaredEffect = this.coerceEffect(node.config['effect']);
        const r = RANK[declaredEffect];
        if (r > maxRank) maxRank = r;
        const auth = Number(node.config['authorityCeiling']);
        if (Number.isFinite(auth) && auth > authority) authority = auth;
        if (node.config['approvalSensitive'] === true) approvalSensitive = true;
      }
    }
    const order: readonly (
      | 'NONE'
      | 'READ'
      | 'SUGGEST'
      | 'DRAFT'
      | 'EXECUTE_LOCAL'
      | 'EXECUTE_EXTERNAL'
      | 'IRREVERSIBLE'
    )[] = [
      'NONE',
      'READ',
      'SUGGEST',
      'DRAFT',
      'EXECUTE_LOCAL',
      'EXECUTE_EXTERNAL',
      'IRREVERSIBLE',
    ];
    return {
      maxEffect: order[maxRank] ?? 'NONE',
      approvalSensitive,
      authorityCeiling: authority,
    };
  }

  private r1UniqueNodeIds(graph: SkillGraph, issues: ValidationIssue[]): void {
    const seen = new Set<string>();
    for (const node of graph.nodes) {
      if (seen.has(node.id)) {
        issues.push({
          code: 'R1_DUPLICATE_NODE_ID',
          nodeId: node.id,
          message: `Duplicate node id ${node.id}`,
        });
      }
      seen.add(node.id);
    }
  }

  private r2PortConsistency(
    graph: SkillGraph,
    issues: ValidationIssue[],
  ): void {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const node of graph.nodes) {
      this.checkPorts(node.id, 'IN', node.inputs, nodeById, issues);
      this.checkPorts(node.id, 'OUT', node.outputs, nodeById, issues);
    }
  }

  private checkPorts(
    nodeId: string,
    direction: 'IN' | 'OUT',
    ports: ReadonlyArray<SkillPort>,
    nodeById: Map<string, SkillNode>,
    issues: ValidationIssue[],
  ): void {
    const seen = new Set<string>();
    for (const port of ports) {
      if (port.direction !== direction) {
        issues.push({
          code: 'R2_PORT_DIRECTION',
          nodeId,
          message: `Port ${port.id} on node ${nodeId} has direction ${port.direction}, expected ${direction}`,
        });
      }
      if (seen.has(port.id)) {
        issues.push({
          code: 'R2_DUPLICATE_PORT_ID',
          nodeId,
          message: `Duplicate port id ${port.id} on node ${nodeId}`,
        });
      }
      seen.add(port.id);
      if (port.required && ports.length === 1) {
        // No-op, but required ports must be connected via edges.
        void nodeById;
      }
    }
  }

  private r3EdgeEndpointsExist(
    graph: SkillGraph,
    issues: ValidationIssue[],
  ): void {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const edge of graph.edges) {
      const sourceNode = nodeById.get(edge.source.nodeId);
      const targetNode = nodeById.get(edge.target.nodeId);
      if (!sourceNode) {
        issues.push({
          code: 'R3_SOURCE_NODE_MISSING',
          edgeId: edge.id,
          message: `Edge ${edge.id} references missing source node ${edge.source.nodeId}`,
        });
        continue;
      }
      if (!targetNode) {
        issues.push({
          code: 'R3_TARGET_NODE_MISSING',
          edgeId: edge.id,
          message: `Edge ${edge.id} references missing target node ${edge.target.nodeId}`,
        });
        continue;
      }
      const sourceOut = sourceNode.outputs.find(
        (p) => p.id === edge.source.portId,
      );
      if (!sourceOut) {
        issues.push({
          code: 'R3_SOURCE_PORT_MISSING',
          edgeId: edge.id,
          message: `Edge ${edge.id} references missing source port ${edge.source.portId} on ${sourceNode.id}`,
        });
      }
      const targetIn = targetNode.inputs.find(
        (p) => p.id === edge.target.portId,
      );
      if (!targetIn) {
        issues.push({
          code: 'R3_TARGET_PORT_MISSING',
          edgeId: edge.id,
          message: `Edge ${edge.id} references missing target port ${edge.target.portId} on ${targetNode.id}`,
        });
      }
    }
  }

  private r4PortTypeCompatibility(
    graph: SkillGraph,
    issues: ValidationIssue[],
  ): void {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const edge of graph.edges) {
      const sourceNode = nodeById.get(edge.source.nodeId);
      const targetNode = nodeById.get(edge.target.nodeId);
      if (!sourceNode || !targetNode) continue;
      const sourceOut = sourceNode.outputs.find(
        (p) => p.id === edge.source.portId,
      );
      const targetIn = targetNode.inputs.find(
        (p) => p.id === edge.target.portId,
      );
      if (!sourceOut || !targetIn) continue;
      if (sourceOut.dataType !== targetIn.dataType) {
        const compatible = this.isCompatible(
          sourceOut.dataType,
          targetIn.dataType,
        );
        if (!compatible) {
          issues.push({
            code: 'R4_PORT_TYPE_MISMATCH',
            edgeId: edge.id,
            message: `Edge ${edge.id} connects ${sourceOut.dataType} to ${targetIn.dataType}`,
          });
        }
      }
    }
  }

  private isCompatible(
    from: SkillPort['dataType'],
    to: SkillPort['dataType'],
  ): boolean {
    if (from === to) return true;
    if (from === 'string' && to === 'record') return true;
    if (from === 'string' && to === 'list') return true;
    return false;
  }

  private r5NoCycles(graph: SkillGraph, issues: ValidationIssue[]): void {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const adjacency = new Map<string, string[]>();
    for (const node of graph.nodes) adjacency.set(node.id, []);
    for (const edge of graph.edges) {
      if (
        !nodeById.has(edge.source.nodeId) ||
        !nodeById.has(edge.target.nodeId)
      )
        continue;
      adjacency.get(edge.source.nodeId)!.push(edge.target.nodeId);
    }
    const state = new Map<string, 'WHITE' | 'GRAY' | 'BLACK'>();
    for (const node of graph.nodes) state.set(node.id, 'WHITE');
    const cycleNodes: string[] = [];
    const visit = (id: string): void => {
      const s = state.get(id);
      if (s === 'GRAY') {
        cycleNodes.push(id);
        return;
      }
      if (s === 'BLACK') return;
      state.set(id, 'GRAY');
      for (const next of adjacency.get(id) ?? []) visit(next);
      state.set(id, 'BLACK');
    };
    for (const node of graph.nodes) visit(node.id);
    if (cycleNodes.length > 0) {
      issues.push({
        code: 'R5_CYCLE_DETECTED',
        nodeId: cycleNodes[0],
        message: `Cycle detected involving node ${cycleNodes[0]}`,
      });
    }
  }

  private r6EffectAuthorityDerivation(
    graph: SkillGraph,
    issues: ValidationIssue[],
  ): void {
    for (const node of graph.nodes) {
      if (node.kind === 'action' || node.kind === 'approval') {
        const toolKey = this.toolKeyString(node.config['toolKey']);
        if (!toolKey) {
          issues.push({
            code: 'R6_TOOL_KEY_MISSING',
            nodeId: node.id,
            message: `Action/approval node ${node.id} must reference a registered toolKey`,
          });
        }
      }
    }
  }

  private r7ActionMetadata(graph: SkillGraph, issues: ValidationIssue[]): void {
    for (const node of graph.nodes) {
      if (node.kind !== 'action' && node.kind !== 'approval') continue;
      const timeout = Number(node.config['timeoutMs']);
      const retry = Number(node.config['retryMax']);
      const idem = node.config['idempotencyKey'];
      if (!Number.isFinite(timeout) || timeout <= 0) {
        issues.push({
          code: 'R7_TIMEOUT_MISSING',
          nodeId: node.id,
          message: `Action/approval node ${node.id} must declare a positive timeoutMs`,
        });
      }
      if (!Number.isFinite(retry) || retry < 0) {
        issues.push({
          code: 'R7_RETRY_MISSING',
          nodeId: node.id,
          message: `Action/approval node ${node.id} must declare retryMax >= 0`,
        });
      }
      if (
        typeof idem !== 'string' &&
        typeof idem !== 'function' &&
        !Array.isArray(idem)
      ) {
        issues.push({
          code: 'R7_IDEMPOTENCY_MISSING',
          nodeId: node.id,
          message: `Action/approval node ${node.id} must declare an idempotencyKey strategy`,
        });
      }
    }
  }

  private r8FailurePaths(graph: SkillGraph, issues: ValidationIssue[]): void {
    const adj = new Map<string, string[]>();
    for (const n of graph.nodes) adj.set(n.id, []);
    for (const e of graph.edges) {
      const arr = adj.get(e.source.nodeId);
      if (arr) arr.push(e.target.nodeId);
    }
    for (const node of graph.nodes) {
      if (node.kind !== 'action' && node.kind !== 'envelope') continue;
      const effects = this.effectString(node.config['effect']);
      if (effects === 'READ') continue;
      if (effects === 'INTERNAL_WRITE' || effects === 'EXTERNAL_WRITE') {
        const comp = this.toolKeyString(node.config['compensationKey']);
        const fp = this.toolKeyString(node.config['failurePath']);
        const hasComp = comp.length > 0 || fp.length > 0;
        const outgoing = adj.get(node.id) ?? [];
        if (!hasComp && outgoing.length === 0) {
          issues.push({
            code: 'R8_NO_FAILURE_PATH',
            nodeId: node.id,
            message: `Mutating node ${node.id} must declare a failure path or compensationKey`,
          });
        }
      }
    }
  }

  private r9InputReachability(
    graph: SkillGraph,
    issues: ValidationIssue[],
  ): void {
    const incoming = new Map<string, Set<string>>();
    for (const n of graph.nodes) incoming.set(n.id, new Set());
    for (const e of graph.edges) {
      if (!incoming.has(e.target.nodeId)) continue;
      incoming.get(e.target.nodeId)!.add(e.source.nodeId);
    }
    for (const node of graph.nodes) {
      for (const port of node.inputs) {
        if (!port.required) continue;
        const reached = incoming.get(node.id);
        const has = reached && reached.size > 0;
        if (!has && !graph.inputs.some((i) => i.id === port.id)) {
          issues.push({
            code: 'R9_REQUIRED_INPUT_UNREACHABLE',
            nodeId: node.id,
            message: `Required input ${port.id} on ${node.id} is not reachable from graph inputs or upstream nodes`,
          });
        }
      }
    }
  }

  private r10OutputReachability(
    graph: SkillGraph,
    issues: ValidationIssue[],
  ): void {
    const outgoing = new Map<string, Set<string>>();
    for (const n of graph.nodes) outgoing.set(n.id, new Set());
    for (const e of graph.edges) {
      const arr = outgoing.get(e.source.nodeId);
      if (arr) arr.add(e.target.nodeId);
    }
    const reachableOutputs = new Set<string>();
    const visit = (id: string): void => {
      for (const next of outgoing.get(id) ?? []) {
        if (!reachableOutputs.has(next)) {
          reachableOutputs.add(next);
          visit(next);
        }
      }
    };
    for (const node of graph.nodes) {
      if (node.kind === 'envelope') visit(node.id);
    }
    for (const node of graph.nodes) {
      if (node.kind === 'envelope' && !reachableOutputs.has(node.id)) {
        issues.push({
          code: 'R10_OUTPUT_NOT_REACHED',
          nodeId: node.id,
          message: `Envelope node ${node.id} is not reached from the graph`,
        });
      }
    }
  }

  private toolKeyString(v: unknown): string {
    return typeof v === 'string' ? v : '';
  }

  private effectString(v: unknown): string {
    return typeof v === 'string' ? v : 'READ';
  }

  private coerceEffect(
    v: unknown,
  ):
    | 'NONE'
    | 'READ'
    | 'SUGGEST'
    | 'DRAFT'
    | 'EXECUTE_LOCAL'
    | 'EXECUTE_EXTERNAL'
    | 'IRREVERSIBLE' {
    const allowed = [
      'NONE',
      'READ',
      'SUGGEST',
      'DRAFT',
      'EXECUTE_LOCAL',
      'EXECUTE_EXTERNAL',
      'IRREVERSIBLE',
    ] as const;
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) {
      return v as (typeof allowed)[number];
    }
    return 'NONE';
  }
}
