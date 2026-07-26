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

    const agents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isActive: true,
        archived: false,
        availability: 'AVAILABLE',
        ...(filter.role ? { role: filter.role } : {}),
        ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
        ...(filter.dataClassification ? { dataClassification: filter.dataClassification } : {}),
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
        inProgressCount: 0,
        queuedCount: 0,
        blockedCount: 0,
      };
      const count = row._count._all;
      switch (row.status as unknown as string) {
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
      w.activeCount = w.inProgressCount + w.queuedCount + w.blockedCount;
      map.set(row.agentId, w);
    }
    return Array.from(map.values());
  }

  async loadPerformance(
    tenantId: string,
    agentIds: string[],
    windowSize: number,
  ): Promise<AgentPerformance[]> {
    if (agentIds.length === 0 || windowSize <= 0) {
      return agentIds.map((id) => ({
        agentId: id,
        totalAttempts: 0,
        succeededAttempts: 0,
        successRate: 0,
      }));
    }
    const recent = await this.prisma.executionAttempt.findMany({
      where: {
        tenantId,
        agentId: { in: agentIds },
      },
      orderBy: { createdAt: 'desc' },
      take: agentIds.length * windowSize,
      select: {
        agentId: true,
        status: true,
      },
    });
    const map = new Map<string, { total: number; success: number }>();
    for (const id of agentIds) {
      map.set(id, { total: 0, success: 0 });
    }
    for (const row of recent) {
      if (!row.agentId) continue;
      const bucket = map.get(row.agentId);
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
    return Array.from(map.entries()).map(([agentId, b]) => ({
      agentId,
      totalAttempts: b.total,
      succeededAttempts: b.success,
      successRate: b.total === 0 ? 0 : (b.success / b.total) * 100,
    }));
  }
}
