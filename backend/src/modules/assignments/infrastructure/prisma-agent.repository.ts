// src/modules/assignments/infrastructure/prisma-agent.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  AgentEntity,
  AgentPerformance,
  AgentWorkload,
  AssignmentStatusForCapacity,
  IAgentRepository,
} from '../domain/ports/agent-repository.port';
import type { AgentDataClassification } from '../domain/agent-capability';

// Plan §6.1 — agent qualifies when its dataClassification is
// "at least as permissive" as the requested floor.
const CLASSIFICATION_FLOOR: Record<AgentDataClassification, AgentDataClassification[]> = {
  INTERNAL: ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
  CONFIDENTIAL: ['CONFIDENTIAL', 'RESTRICTED'],
  RESTRICTED: ['RESTRICTED'],
};

@Injectable()
export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: any): AgentEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role ?? null,
      capabilities: (row.capabilities as string[]) ?? [],
      permissions: Array.isArray(row.permissions)
        ? (row.permissions as string[])
        : [],
      maxConcurrency: row.maxConcurrency ?? null,
      availability: row.availability ?? null,
      archived: row.archived ?? false,
      dataClassification: row.dataClassification ?? 'INTERNAL',
      departmentId: row.departmentId ?? null,
    };
  }

  async findEligible(
    tenantId: string,
    filter: {
      departmentId?: string | null;
      role?: string | null;
      requiredCapabilities?: string[];
      dataClassification?: AgentDataClassification;
    },
  ): Promise<AgentEntity[]> {
    const capAnd: Prisma.StringNullableListFilter | undefined =
      filter.requiredCapabilities && filter.requiredCapabilities.length > 0
        ? { hasEvery: filter.requiredCapabilities }
        : undefined;

    const classificationFloor = filter.dataClassification
      ? CLASSIFICATION_FLOOR[filter.dataClassification]
      : undefined;

    const agents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isActive: true,
        archived: false,
        availability: 'AVAILABLE',
        ...(filter.role ? { role: filter.role } : {}),
        ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
        ...(classificationFloor
          ? { dataClassification: { in: classificationFloor } }
          : {}),
        ...(capAnd ? { capabilities: capAnd } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    return agents.map((row: any) => this.toEntity(row));
  }

  async findById(tenantId: string, id: string): Promise<AgentEntity | null> {
    const row = await this.prisma.agent.findFirst({
      where: { id, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }

  async loadWorkloads(
    tenantId: string,
    agentIds: string[],
    statuses: AssignmentStatusForCapacity[],
  ): Promise<AgentWorkload[]> {
    if (agentIds.length === 0 || statuses.length === 0) {
      return [];
    }
    const groups = await this.prisma.task.groupBy({
      by: ['agentId', 'status'],
      where: {
        tenantId,
        agentId: { in: agentIds },
        status: { in: statuses as unknown as any[] },
      },
      _count: { _all: true },
    });
    const map = new Map<string, AgentWorkload>();
    for (const id of agentIds) {
      map.set(id, {
        agentId: id,
        activeCount: 0,
        assignedCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
      });
    }
    for (const row of groups) {
      if (!row.agentId) continue;
      const w = map.get(row.agentId) ?? {
        agentId: row.agentId,
        activeCount: 0,
        assignedCount: 0,
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
      };
      const count = row._count._all;
      switch (row.status as unknown as string) {
        case 'ASSIGNED':
          w.assignedCount = count;
          break;
        case 'IN_PROGRESS':
          w.inProgressCount = count;
          break;
        case 'QUEUED':
          w.queuedCount = count;
          break;
        case 'BLOCKED':
          w.blockedCount = count;
          break;
        default:
          break;
      }
      w.activeCount =
        w.assignedCount + w.inProgressCount + w.queuedCount + w.blockedCount;
      map.set(row.agentId, w);
    }
    return Array.from(map.values());
  }

  async loadPerformance(
    tenantId: string,
    agentIds: string[],
    windowSize: number,
  ): Promise<AgentPerformance[]> {
    if (agentIds.length === 0) {
      return [];
    }
    if (windowSize <= 0) {
      return agentIds.map((id) => ({
        agentId: id,
        totalAttempts: 0,
        succeededAttempts: 0,
        successRate: 0,
      }));
    }

    // Compute the per-agent window correctly. `findMany({ take: N })`
    // would be biased toward whichever agent had the most recent
    // attempts. Instead, fetch each agent's windowSize most-recent
    // attempts via a UNION ALL of per-agent parameterized queries.
    //
    // SQL pattern:
    //   (SELECT ... WHERE agent_id = $1 ORDER BY created_at DESC LIMIT w)
    //   UNION ALL
    //   (SELECT ... WHERE agent_id = $2 ORDER BY created_at DESC LIMIT w)
    const perAgentSelects = agentIds
      .map(
        (_, i) =>
          `(SELECT "${i + 1}"::int AS agent_idx, status FROM "execution_attempts" WHERE "tenantId" = $1 AND "agentId" = $${i + 2} ORDER BY "createdAt" DESC LIMIT $${i + 2 + agentIds.length}::int)`,
      )
      .join(' UNION ALL ');
    const params: unknown[] = [tenantId, ...agentIds, ...agentIds.map(() => windowSize)];
    const result = await this.prisma.$queryRawUnsafe<
      Array<{ agent_idx: number; status: string }>
    >(perAgentSelects, ...params).catch(() => []);

    const map = new Map<string, { total: number; success: number }>();
    agentIds.forEach((id, idx) => {
      map.set(id, { total: 0, success: 0 });
    });

    for (const row of result) {
      const agentId = agentIds[row.agent_idx - 1];
      if (!agentId) continue;
      const bucket = map.get(agentId);
      if (!bucket) continue;
      bucket.total++;
      if (
        row.status === 'SUBMITTED_FOR_REVIEW' ||
        row.status === 'PAUSED' ||
        row.status === 'NEEDS_INPUT'
      ) {
        // "Successful" here means the attempt reached a non-failed
        // terminal-ish state. PAUSED/NEEDS_INPUT indicate the agent
        // did its job and handed back to the human; SUBMITTED_FOR_REVIEW
        // is the deliverable handoff.
        bucket.success++;
      }
    }

    return agentIds.map((id) => {
      const b = map.get(id) ?? { total: 0, success: 0 };
      return {
        agentId: id,
        totalAttempts: b.total,
        succeededAttempts: b.success,
        successRate: b.total === 0 ? 0 : (b.success / b.total) * 100,
      };
    });
  }
}
