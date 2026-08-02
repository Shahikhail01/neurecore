/**
 * SkillVersionDiffService — Phase 6 P6
 *
 * Computes a structural diff between two SkillGraphs and surfaces the
 * downstream impact on composed skills. The diff is purely
 * deterministic — node/edge labels, configs, ports. The service does
 * NOT execute either graph.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  SkillGraph,
  SkillNode,
  SkillPort,
} from '../schemas/skill-graph.schema';

export interface SkillGraphDiffEntry {
  readonly op: 'add' | 'remove' | 'modify';
  readonly target: 'node' | 'edge' | 'port' | 'mode';
  readonly id: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

export interface SkillGraphDiff {
  readonly entries: readonly SkillGraphDiffEntry[];
  readonly impactScore: number;
  readonly affectedSkillRefs: readonly string[];
}

@Injectable()
export class SkillVersionDiffService {
  private readonly logger = new Logger(SkillVersionDiffService.name);

  diff(before: SkillGraph, after: SkillGraph): SkillGraphDiff {
    const entries: SkillGraphDiffEntry[] = [];

    if (before.mode !== after.mode) {
      entries.push({
        op: 'modify',
        target: 'mode',
        id: 'mode',
        before: before.mode,
        after: after.mode,
      });
    }

    const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
    const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));
    for (const [id, node] of afterNodes) {
      const prev = beforeNodes.get(id);
      if (!prev) {
        entries.push({ op: 'add', target: 'node', id, after: node });
      } else if (!this.deepEqual(prev, node)) {
        entries.push({
          op: 'modify',
          target: 'node',
          id,
          before: prev,
          after: node,
        });
      }
    }
    for (const [id, node] of beforeNodes) {
      if (!afterNodes.has(id)) {
        entries.push({ op: 'remove', target: 'node', id, before: node });
      }
    }

    const beforeEdges = new Map(before.edges.map((e) => [e.id, e]));
    const afterEdges = new Map(after.edges.map((e) => [e.id, e]));
    for (const [id, edge] of afterEdges) {
      const prev = beforeEdges.get(id);
      if (!prev) {
        entries.push({ op: 'add', target: 'edge', id, after: edge });
      } else if (!this.deepEqual(prev, edge)) {
        entries.push({
          op: 'modify',
          target: 'edge',
          id,
          before: prev,
          after: edge,
        });
      }
    }
    for (const [id, edge] of beforeEdges) {
      if (!afterEdges.has(id)) {
        entries.push({ op: 'remove', target: 'edge', id, before: edge });
      }
    }

    const beforePorts = this.portBag(before);
    const afterPorts = this.portBag(after);
    for (const [id, port] of afterPorts) {
      const prev = beforePorts.get(id);
      if (!prev) {
        entries.push({ op: 'add', target: 'port', id, after: port });
      } else if (!this.deepEqual(prev, port)) {
        entries.push({
          op: 'modify',
          target: 'port',
          id,
          before: prev,
          after: port,
        });
      }
    }
    for (const [id, port] of beforePorts) {
      if (!afterPorts.has(id)) {
        entries.push({ op: 'remove', target: 'port', id, before: port });
      }
    }

    const affectedSkillRefs = this.deriveSkillRefs(entries);
    const impactScore = this.scoreImpact(entries);

    return {
      entries,
      impactScore,
      affectedSkillRefs,
    };
  }

  private portBag(graph: SkillGraph): Map<string, SkillPort> {
    const bag = new Map<string, SkillPort>();
    const key = (n: string, p: string): string => `${n}.${p}`;
    for (const n of graph.nodes) {
      for (const p of n.inputs) bag.set(key(n.id, p.id), p);
      for (const p of n.outputs) bag.set(key(n.id, p.id), p);
    }
    return bag;
  }

  private deriveSkillRefs(entries: readonly SkillGraphDiffEntry[]): string[] {
    const refs = new Set<string>();
    for (const e of entries) {
      if (e.target !== 'node') continue;
      const after = e.after as SkillNode | undefined;
      const before = e.before as SkillNode | undefined;
      const node = after ?? before;
      if (!node) continue;
      const raw = node.config?.['toolKey'];
      const toolKey = typeof raw === 'string' ? raw : '';
      if (toolKey) refs.add(toolKey);
    }
    return Array.from(refs);
  }

  private scoreImpact(entries: readonly SkillGraphDiffEntry[]): number {
    let score = 0;
    for (const e of entries) {
      const weight = e.target === 'mode' ? 5 : e.target === 'edge' ? 3 : 2;
      score += weight;
    }
    return score;
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
}
