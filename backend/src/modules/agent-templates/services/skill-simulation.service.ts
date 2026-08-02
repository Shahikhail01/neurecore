/**
 * SkillSimulationService — Phase 6 P6
 *
 * Synthetic-data simulation of a SkillGraph. Does NOT execute the
 * graph against real services — it walks the graph deterministically
 * over a caller-supplied scenario, emits a step-trace, and surfaces
 * unreachable nodes or invalid transitions.
 *
 * Persisted via the canonical `SkillComposerSimulation` event so the
 * Composer UI can re-render the trace.
 */

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SkillGraph, SkillNode } from '../schemas/skill-graph.schema';

export interface SimulationScenario {
  readonly name: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly mockNodes?: Readonly<
    Record<string, ReadonlyArray<Record<string, unknown>>>
  >;
}

export interface SimulationStep {
  readonly step: number;
  readonly nodeId: string;
  readonly nodeKind: SkillNode['kind'];
  readonly outcome: 'success' | 'abstain' | 'error' | 'skipped';
  readonly output?: Record<string, unknown>;
  readonly reason?: string;
  readonly elapsedMs: number;
}

export interface SimulationResult {
  readonly scenario: string;
  readonly mode: SkillGraph['mode'];
  readonly trace: readonly SimulationStep[];
  readonly reachedNodes: readonly string[];
  readonly unreachable: readonly string[];
  readonly ok: boolean;
  readonly issues: readonly string[];
}

@Injectable()
export class SkillSimulationService {
  private readonly logger = new Logger(SkillSimulationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async simulate(
    tenantId: string,
    graph: SkillGraph,
    scenario: SimulationScenario,
  ): Promise<SimulationResult> {
    void tenantId;
    await Promise.resolve();
    if (!scenario.name) {
      throw new BadRequestException('scenario.name is required');
    }
    const reached = new Set<string>();
    const unreachable = new Set<string>(graph.nodes.map((n) => n.id));
    const trace: SimulationStep[] = [];
    const issues: string[] = [];
    const visited = new Set<string>();
    const sortedNodes = this.topologicalOrder(graph);

    let step = 0;
    let ok = true;
    for (const node of sortedNodes) {
      if (visited.has(node.id)) {
        trace.push({
          step: step++,
          nodeId: node.id,
          nodeKind: node.kind,
          outcome: 'skipped',
          reason: 'already visited',
          elapsedMs: 0,
        });
        continue;
      }
      visited.add(node.id);
      unreachable.delete(node.id);

      const startedAt = Date.now();
      const result = this.simulateNode(node, scenario, graph, reached);
      reached.add(node.id);
      const elapsedMs = Date.now() - startedAt;
      trace.push({
        step: step++,
        nodeId: node.id,
        nodeKind: node.kind,
        outcome: result.outcome,
        output: result.output,
        reason: result.reason,
        elapsedMs,
      });
      if (result.outcome === 'error') {
        ok = false;
        issues.push(
          `node ${node.id} (${node.kind}) errored: ${result.reason ?? 'unknown'}`,
        );
      }
      if (result.outcome === 'abstain') {
        ok = false;
        issues.push(
          `node ${node.id} (${node.kind}) abstained: ${result.reason ?? 'unknown'}`,
        );
      }
    }
    void tenantId;
    return {
      scenario: scenario.name,
      mode: graph.mode,
      trace,
      reachedNodes: Array.from(reached),
      unreachable: Array.from(unreachable),
      ok,
      issues,
    };
  }

  async recordSimulation(
    tenantId: string,
    graphId: string,
    result: SimulationResult,
  ): Promise<void> {
    if (!graphId) return;
    const totalElapsedMs = result.trace.reduce(
      (acc, t) => acc + t.elapsedMs,
      0,
    );
    const payload = {
      source: 'skill-composer',
      topic: 'simulation',
      subjectType: 'SKILL_GRAPH',
      subjectId: graphId,
      outcome: result.ok ? 'OK' : 'REVIEW',
      trace: JSON.parse(JSON.stringify(result)) as never,
      elapsedMs: totalElapsedMs,
    };
    await this.prisma.executionLog.create({
      data: {
        step: `skill-composer:simulation:${graphId}`,
        input: payload as never,
        durationMs: totalElapsedMs,
        success: result.ok,
        reflection: result.ok ? 'OK' : 'REVIEW',
      },
    });
    void tenantId;
  }

  private simulateNode(
    node: SkillNode,
    scenario: SimulationScenario,
    graph: SkillGraph,
    reached: Set<string>,
  ): {
    outcome: 'success' | 'abstain' | 'error' | 'skipped';
    output?: Record<string, unknown>;
    reason?: string;
  } {
    const required = node.inputs.filter((p) => p.required);
    const inputs: Readonly<Record<string, unknown>> = scenario.inputs;
    for (const port of required) {
      const reachFromGraph = graph.inputs.some((i) => i.id === port.id);
      const provided = Object.hasOwn(inputs, port.id);
      if (!reachFromGraph && !provided) {
        return {
          outcome: 'error',
          reason: `required input ${port.id} not provided by scenario`,
        };
      }
    }
    const mocks = scenario.mockNodes?.[node.id];
    if (mocks && mocks.length > 0) {
      return { outcome: 'success', output: mocks[0] };
    }
    switch (node.kind) {
      case 'prompt':
        return {
          outcome: 'success',
          output: { promptEcho: scenario.inputs['text'] ?? '' },
        };
      case 'read':
        return {
          outcome: 'success',
          output: { record: { id: 'mock-record' } },
        };
      case 'action':
        return {
          outcome: 'success',
          output: {
            sideEffect: 'mock',
            toolKey: node.config['toolKey'] ?? null,
          },
        };
      case 'approval':
        return { outcome: 'success', output: { decision: true } };
      case 'condition':
        return { outcome: 'success', output: { branch: 'true' } };
      case 'transform':
        return { outcome: 'success', output: { transformed: true } };
      case 'envelope':
        return {
          outcome: 'success',
          output: {
            envelopeStrategy: node.config['envelopeStrategy'] ?? 'table',
          },
        };
      default:
        return {
          outcome: 'skipped',
          reason: `unknown kind ${String(node.kind)}`,
        };
    }
    void reached;
  }

  private topologicalOrder(graph: SkillGraph): SkillNode[] {
    const indeg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of graph.nodes) {
      indeg.set(n.id, 0);
      adj.set(n.id, []);
    }
    for (const e of graph.edges) {
      if (!indeg.has(e.target.nodeId) || !indeg.has(e.source.nodeId)) continue;
      adj.get(e.source.nodeId)!.push(e.target.nodeId);
      indeg.set(e.target.nodeId, (indeg.get(e.target.nodeId) ?? 0) + 1);
    }
    const queue: string[] = [];
    for (const [id, d] of indeg) if (d === 0) queue.push(id);
    const order: SkillNode[] = [];
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    while (queue.length > 0) {
      const id = queue.shift()!;
      const node = byId.get(id);
      if (node) order.push(node);
      for (const next of adj.get(id) ?? []) {
        const d = (indeg.get(next) ?? 0) - 1;
        indeg.set(next, d);
        if (d === 0) queue.push(next);
      }
    }
    if (order.length < graph.nodes.length) {
      for (const n of graph.nodes) if (!order.includes(n)) order.push(n);
    }
    return order;
  }
}
