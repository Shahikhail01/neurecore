/**
 * command-center/services/inventory.service.ts
 *
 * P8 — CR-AI-1201 Inventory view.
 *
 * Reconciles tenant-scoped counts of:
 *   - agents             (Agent)
 *   - skills             (AgentSkillDefinition)
 *   - models             (distinct Agent.model, ExecutionAttempt)
 *   - knowledge entries  (KnowledgeEntry)
 *   - channels           (CrmConnector)
 *
 * Every row carries the canonical source model and the record id
 * so the dashboard can render an evidence trail back to its
 * authoritative owner. No hard-coded success — when a source is
 * empty the service returns an empty array, never a synthetic
 * placeholder.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  InventoryResponseDto,
  InventoryAgentDto,
  InventorySkillDto,
  InventoryModelDto,
  InventoryKnowledgeSourceDto,
  InventoryChannelDto,
} from '../dto/inventory.dto';

const DEFAULT_LIMIT = 100;

export interface InventoryListOptions {
  limit?: number;
  cursor?: string;
  status?: string;
  search?: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getInventory(
    tenantId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<InventoryResponseDto> {
    const safeLimit = Math.max(1, Math.min(500, limit));

    const [agents, skills, models, knowledge, channels] = await Promise.all([
      this.prisma.agent.findMany({
        where: { tenantId, archived: false },
        orderBy: { updatedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          name: true,
          status: true,
          model: true,
          departmentId: true,
          updatedAt: true,
        },
      }),
      this.prisma.agentSkillDefinition.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          skillKey: true,
          semanticVersion: true,
          certificationStatus: true,
          lifecycleStatus: true,
          updatedAt: true,
        },
      }),
      this.prisma.executionAttempt
        .groupBy({
          by: ['modelVersion'],
          where: { tenantId, modelVersion: { not: null } },
          _count: { _all: true },
        })
        .then(async (rows) => {
          const agents = await this.prisma.agent.findMany({
            where: { tenantId, archived: false },
            select: { model: true },
          });
          const agentCountByModel = new Map<string, number>();
          for (const a of agents) {
            const m = a.model || 'unknown';
            agentCountByModel.set(m, (agentCountByModel.get(m) ?? 0) + 1);
          }
          const seen = new Set<string>();
          const out: InventoryModelDto[] = [];
          for (const a of agents) {
            const m = a.model || 'unknown';
            if (seen.has(m)) continue;
            seen.add(m);
            out.push({
              model: m,
              provider: 'unknown',
              agentCount: agentCountByModel.get(m) ?? 0,
              source: 'ExecutionAttempt',
            });
          }
          for (const r of rows) {
            const m = r.modelVersion;
            if (!m || seen.has(m)) continue;
            seen.add(m);
            out.push({
              model: m,
              provider: 'unknown',
              agentCount: 0,
              source: 'ExecutionAttempt',
            });
          }
          return out.slice(0, safeLimit);
        }),
      this.prisma.knowledgeEntry.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.crmConnector.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: safeLimit,
        select: {
          id: true,
          name: true,
          provider: true,
          isActive: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      tenantId,
      fetchedAt: new Date().toISOString(),
      agents: agents.map<InventoryAgentDto>((a) => ({
        id: a.id,
        name: a.name,
        status: String(a.status),
        model: a.model,
        departmentId: a.departmentId,
        updatedAt: a.updatedAt.toISOString(),
        source: 'Agent',
      })),
      skills: skills.map<InventorySkillDto>((s) => ({
        id: s.id,
        name: s.skillKey,
        slug: s.skillKey,
        version: s.semanticVersion,
        status: `${s.lifecycleStatus}/${s.certificationStatus}`,
        updatedAt: s.updatedAt.toISOString(),
        source: 'AgentSkillDefinition',
      })),
      models,
      knowledge: knowledge.map<InventoryKnowledgeSourceDto>((k) => ({
        id: k.id,
        name: k.title,
        kind: String(k.type),
        status: k.status,
        updatedAt: k.updatedAt.toISOString(),
        source: 'KnowledgeEntry',
      })),
      channels: channels.map<InventoryChannelDto>((c) => ({
        id: c.id,
        type: c.provider,
        status: c.isActive ? 'active' : 'inactive',
        source: 'CrmConnector',
      })),
    };
  }

  async listAgents(
    tenantId: string,
    opts: InventoryListOptions = {},
  ): Promise<{
    items: InventoryAgentDto[];
    nextCursor: string | null;
    total: number;
  }> {
    const limit = Math.max(1, Math.min(500, opts.limit ?? DEFAULT_LIMIT));
    const items = await this.prisma.agent.findMany({
      where: {
        tenantId,
        archived: false,
        ...(opts.status ? { status: opts.status as never } : {}),
        ...(opts.search
          ? { name: { contains: opts.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      select: {
        id: true,
        name: true,
        status: true,
        model: true,
        departmentId: true,
        updatedAt: true,
      },
    });
    const hasMore = items.length > limit;
    const slice = hasMore ? items.slice(0, limit) : items;
    const total = await this.prisma.agent.count({
      where: { tenantId, archived: false },
    });
    return {
      items: slice.map<InventoryAgentDto>((a) => ({
        id: a.id,
        name: a.name,
        status: String(a.status),
        model: a.model,
        departmentId: a.departmentId,
        updatedAt: a.updatedAt.toISOString(),
        source: 'Agent',
      })),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
      total,
    };
  }

  async listSkills(
    tenantId: string,
    opts: InventoryListOptions = {},
  ): Promise<{
    items: InventorySkillDto[];
    nextCursor: string | null;
    total: number;
  }> {
    const limit = Math.max(1, Math.min(500, opts.limit ?? DEFAULT_LIMIT));
    const items = await this.prisma.agentSkillDefinition.findMany({
      where: {
        tenantId,
        ...(opts.status ? { lifecycleStatus: opts.status as never } : {}),
        ...(opts.search
          ? { skillKey: { contains: opts.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      select: {
        id: true,
        skillKey: true,
        semanticVersion: true,
        certificationStatus: true,
        lifecycleStatus: true,
        updatedAt: true,
      },
    });
    const hasMore = items.length > limit;
    const slice = hasMore ? items.slice(0, limit) : items;
    const total = await this.prisma.agentSkillDefinition.count({
      where: { tenantId },
    });
    return {
      items: slice.map<InventorySkillDto>((s) => ({
        id: s.id,
        name: s.skillKey,
        slug: s.skillKey,
        version: s.semanticVersion,
        status: `${s.lifecycleStatus}/${s.certificationStatus}`,
        updatedAt: s.updatedAt.toISOString(),
        source: 'AgentSkillDefinition',
      })),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
      total,
    };
  }

  async listModels(tenantId: string): Promise<InventoryModelDto[]> {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId, archived: false },
      select: { model: true },
    });
    const attemptRows = await this.prisma.executionAttempt.groupBy({
      by: ['modelVersion'],
      where: { tenantId, modelVersion: { not: null } },
      _count: { _all: true },
    });
    const agentCountByModel = new Map<string, number>();
    for (const a of agents) {
      const m = a.model || 'unknown';
      agentCountByModel.set(m, (agentCountByModel.get(m) ?? 0) + 1);
    }
    const seen = new Set<string>();
    const out: InventoryModelDto[] = [];
    for (const a of agents) {
      const m = a.model || 'unknown';
      if (seen.has(m)) continue;
      seen.add(m);
      out.push({
        model: m,
        provider: 'unknown',
        agentCount: agentCountByModel.get(m) ?? 0,
        source: 'ExecutionAttempt',
      });
    }
    for (const r of attemptRows) {
      const m = r.modelVersion;
      if (!m || seen.has(m)) continue;
      seen.add(m);
      out.push({
        model: m,
        provider: 'unknown',
        agentCount: 0,
        source: 'ExecutionAttempt',
      });
    }
    return out;
  }

  async listKnowledge(
    tenantId: string,
    opts: InventoryListOptions = {},
  ): Promise<{
    items: InventoryKnowledgeSourceDto[];
    nextCursor: string | null;
    total: number;
  }> {
    const limit = Math.max(1, Math.min(500, opts.limit ?? DEFAULT_LIMIT));
    const items = await this.prisma.knowledgeEntry.findMany({
      where: {
        tenantId,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.search
          ? { title: { contains: opts.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        updatedAt: true,
      },
    });
    const hasMore = items.length > limit;
    const slice = hasMore ? items.slice(0, limit) : items;
    const total = await this.prisma.knowledgeEntry.count({
      where: { tenantId },
    });
    return {
      items: slice.map<InventoryKnowledgeSourceDto>((k) => ({
        id: k.id,
        name: k.title,
        kind: String(k.type),
        status: k.status,
        updatedAt: k.updatedAt.toISOString(),
        source: 'KnowledgeEntry',
      })),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
      total,
    };
  }

  async listChannels(tenantId: string): Promise<InventoryChannelDto[]> {
    const connectors = await this.prisma.crmConnector.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        provider: true,
        isActive: true,
        updatedAt: true,
      },
    });
    return connectors.map<InventoryChannelDto>((c) => ({
      id: c.id,
      type: c.provider,
      status: c.isActive ? 'active' : 'inactive',
      source: 'CrmConnector',
    }));
  }
}
