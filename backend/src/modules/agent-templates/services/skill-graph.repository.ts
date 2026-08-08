/**
 * Phase 24 — SkillGraphRepository (CR-AI-0602 persistence).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 *
 * SOLID — SRP: this repository owns ONLY the typed read/write of
 * SkillGraph rows. Validation lives in SkillGraphService. Save/load
 * controller endpoints live in SkillComposerController.
 *
 * DIP: depends on `PrismaService` (injected). No direct DB calls
 * outside this file.
 *
 * ISP: narrow surface (save, load, list, delete). Each method is
 * tenant-scoped.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { SkillGraph } from '../schemas/skill-graph.schema';

export const SKILL_GRAPH_REPOSITORY = Symbol('SKILL_GRAPH_REPOSITORY');

export interface SavedSkillGraph {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly mode: string;
  readonly graph: SkillGraph;
  readonly createdById: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ISkillGraphRepository {
  save(input: {
    tenantId: string;
    name: string;
    graph: SkillGraph;
    createdById: string;
  }): Promise<SavedSkillGraph>;
  load(tenantId: string, id: string): Promise<SavedSkillGraph | null>;
  list(tenantId: string): Promise<ReadonlyArray<SavedSkillGraph>>;
  remove(tenantId: string, id: string): Promise<boolean>;
}

@Injectable()
export class SkillGraphRepository implements ISkillGraphRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(input: {
    tenantId: string;
    name: string;
    graph: SkillGraph;
    createdById: string;
  }): Promise<SavedSkillGraph> {
    if (!input.tenantId || input.tenantId === '*') {
      throw new Error('tenant context required');
    }
    const row = await this.prisma.skillGraph.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        mode: input.graph.mode,
        graphJson: input.graph as unknown as object,
        createdById: input.createdById,
      },
    });
    return this.toSaved(row.id, input.tenantId, input.name, input.graph.mode, input.graph, input.createdById, row.createdAt, row.updatedAt);
  }

  async load(tenantId: string, id: string): Promise<SavedSkillGraph | null> {
    if (!tenantId || tenantId === '*') return null;
    const row = await this.prisma.skillGraph.findFirst({
      where: { id, tenantId },
    });
    if (!row) return null;
    return this.toSaved(
      row.id,
      row.tenantId,
      row.name,
      row.mode,
      row.graphJson as unknown as SkillGraph,
      row.createdById,
      row.createdAt,
      row.updatedAt,
    );
  }

  async list(tenantId: string): Promise<ReadonlyArray<SavedSkillGraph>> {
    if (!tenantId || tenantId === '*') return [];
    const rows = await this.prisma.skillGraph.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) =>
      this.toSaved(
        row.id,
        row.tenantId,
        row.name,
        row.mode,
        row.graphJson as unknown as SkillGraph,
        row.createdById,
        row.createdAt,
        row.updatedAt,
      ),
    );
  }

  async remove(tenantId: string, id: string): Promise<boolean> {
    if (!tenantId || tenantId === '*') return false;
    const res = await this.prisma.skillGraph.deleteMany({
      where: { id, tenantId },
    });
    return res.count > 0;
  }

  private toSaved(
    id: string,
    tenantId: string,
    name: string,
    mode: string,
    graph: SkillGraph,
    createdById: string,
    createdAt: Date,
    updatedAt: Date,
  ): SavedSkillGraph {
    return {
      id,
      tenantId,
      name,
      mode,
      graph,
      createdById,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    };
  }
}
