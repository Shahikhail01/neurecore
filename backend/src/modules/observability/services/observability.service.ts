import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { MetricType } from '@prisma/client';

export interface MetricInput {
  name: string;
  value: number;
  type?: MetricType;
  labels?: Record<string, unknown>;
  tenantId?: string;
}

/**
 * ObservabilityService — SRP: Only handles metric collection & aggregation.
 * OCP: New metric types can be added without changing existing logic.
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Record a single metric point */
  async record(input: MetricInput): Promise<void> {
    await this.prisma.tenantMetric.create({
      data: {
        name: input.name,
        value: input.value,
        type: input.type ?? 'GAUGE',
        labels: (input.labels ?? {}) as never,
        tenantId: input.tenantId,
      },
    });
  }

  /** Batch record metrics */
  async recordMany(inputs: MetricInput[]): Promise<void> {
    await this.prisma.tenantMetric.createMany({
      data: inputs.map((i) => ({
        name: i.name,
        value: i.value,
        type: i.type ?? 'GAUGE',
        labels: (i.labels ?? {}) as never,
        tenantId: i.tenantId,
      })),
    });
  }

  /** Get aggregated metrics for a tenant (or all tenants when tenantId is null) */
  async getMetrics(
    tenantId: string | null,
    opts: {
      name?: string;
      from?: Date;
      to?: Date;
      limit?: number;
    } = {},
  ) {
    const { name, from, to, limit = 100 } = opts;
    return this.prisma.tenantMetric.findMany({
      where: {
        ...(tenantId !== null && { tenantId }),
        ...(name && { name }),
        ...((from || to) && {
          recordedAt: {
            ...(from && { gte: from }),
            ...(to && { lte: to }),
          },
        }),
      },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  /** Get platform-wide KPI summary */
  async getPlatformSummary() {
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      totalUsers,
      totalAgents,
      runningAgents,
      totalTasks,
      completedTasks,
      failedTasks,
    ] = await this.prisma.$transaction([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { tier: { slug: 'starter' } } }),
      this.prisma.user.count(),
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { status: 'RUNNING' } }),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: 'COMPLETED' } }),
      this.prisma.task.count({ where: { status: 'FAILED' } }),
    ]);

    // Cost aggregation
    const costAgg = await this.prisma.executionLog.aggregate({
      _sum: { costUsd: true, tokensUsed: true },
    });

    // Top tenants by cost
    const tenantCosts = await this.prisma.executionLog.groupBy({
      by: ['agentId'],
      _sum: { costUsd: true },
      orderBy: { _sum: { costUsd: 'desc' } },
      take: 10,
    });

    const topTenants: {
      id: string;
      name: string;
      agentCount: number;
      taskCount: number;
      cost: number;
    }[] = [];
    const tenantMap = new Map<
      string,
      {
        id: string;
        name: string;
        agentCount: number;
        taskCount: number;
        cost: number;
      }
    >();

    for (const tc of tenantCosts) {
      const agent = await this.prisma.agent.findUnique({
        where: { id: tc.agentId ?? undefined },
        select: {
          tenantId: true,
          tenant: { select: { id: true, name: true } },
        },
      });
      if (!agent?.tenant) continue;
      const tid = agent.tenant.id;
      if (!tenantMap.has(tid)) {
        const [agentCount, taskCount] = await Promise.all([
          this.prisma.agent.count({ where: { tenantId: tid } }),
          this.prisma.task.count({ where: { tenantId: tid } }),
        ]);
        tenantMap.set(tid, {
          id: tid,
          name: agent.tenant.name,
          agentCount,
          taskCount,
          cost: 0,
        });
      }
      const entry = tenantMap.get(tid)!;
      entry.cost += Number(tc._sum.costUsd ?? 0);
    }
    topTenants.push(
      ...Array.from(tenantMap.values()).sort((a, b) => b.cost - a.cost),
    );

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialTenants,
      },
      users: { total: totalUsers },
      agents: { total: totalAgents, running: runningAgents },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
      },
      cost: {
        totalUsd: Number(costAgg._sum.costUsd ?? 0),
        totalTokens: costAgg._sum.tokensUsed ?? 0,
      },
      topTenants,
    };
  }

  /** Get per-tenant KPIs (platform summary when tenantId is null for SUPER_ADMIN) */
  async getTenantKpis(tenantId: string | null) {
    if (tenantId === null) return this.getPlatformSummary();
    const [agents, runningAgents, tasks, completedTasks, pendingApprovals] =
      await this.prisma.$transaction([
        this.prisma.agent.count({ where: { tenantId } }),
        this.prisma.agent.count({ where: { tenantId, status: 'RUNNING' } }),
        this.prisma.task.count({ where: { tenantId } }),
        this.prisma.task.count({ where: { tenantId, status: 'COMPLETED' } }),
        this.prisma.approvalRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
      ]);

    const costAgg = await this.prisma.executionLog.aggregate({
      where: { task: { tenantId } },
      _sum: { costUsd: true, tokensUsed: true },
    });

    const recentLogs = await this.prisma.executionLog.findMany({
      where: { task: { tenantId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        agent: { select: { name: true } },
        task: { select: { title: true } },
      },
    });

    return {
      agents: { total: agents, running: runningAgents },
      tasks: {
        total: tasks,
        completed: completedTasks,
        successRate: tasks > 0 ? Math.round((completedTasks / tasks) * 100) : 0,
      },
      cost: {
        totalUsd: Number(costAgg._sum.costUsd ?? 0),
        totalTokens: costAgg._sum.tokensUsed ?? 0,
      },
      pendingApprovals,
      recentActivity: recentLogs,
    };
  }

  /** Execution logs for a tenant with pagination (all tenants when tenantId is null) */
  async getExecutionLogs(
    tenantId: string | null,
    opts: { page?: number; limit?: number; agentId?: string } = {},
  ) {
    const { page = 1, limit = 20, agentId } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(agentId
        ? { agentId }
        : tenantId !== null
          ? { agent: { tenantId } }
          : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      this.prisma.executionLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get execution traces for a tenant — full step-by-step execution details per task.
   * SRP: shapes data for the traces UI; does not mutate state.
   */
  async getTraces(
    tenantId: string | null,
    opts: { page?: number; limit?: number; agentId?: string } = {},
  ) {
    const { page = 1, limit = 20, agentId } = opts;
    const skip = (page - 1) * limit;

    const where = {
      ...(agentId
        ? { agentId }
        : tenantId !== null
          ? { agent: { tenantId } }
          : {}),
      taskId: { not: null },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { id: true, name: true } },
          task: { select: { id: true, title: true, status: true } },
        },
      }),
      this.prisma.executionLog.count({ where }),
    ]);

    // Group by taskId to form trace trees
    const traceMap = new Map<
      string,
      { taskId: string; task: unknown; steps: typeof data }
    >();
    for (const log of data) {
      if (!log.taskId) continue;
      if (!traceMap.has(log.taskId)) {
        traceMap.set(log.taskId, {
          taskId: log.taskId,
          task: log.task,
          steps: [],
        });
      }
      traceMap.get(log.taskId)!.steps.push(log);
    }

    return {
      data: Array.from(traceMap.values()),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Token/cost breakdown by agent and model for a tenant.
   * SRP: aggregation only; no side-effects.
   */
  async getCosts(
    tenantId: string | null,
    opts: { from?: Date; to?: Date } = {},
  ) {
    const { from, to } = opts;

    const agentCosts = await this.prisma.executionLog.groupBy({
      by: ['agentId'],
      where: {
        ...(tenantId !== null && { agent: { tenantId } }),
        ...(from || to
          ? {
              createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) },
            }
          : {}),
      },
      _sum: { costUsd: true, tokensUsed: true },
      _count: { id: true },
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    // Enrich with agent names
    const enriched = await Promise.all(
      agentCosts.map(async (row) => {
        const agent = await this.prisma.agent.findUnique({
          where: { id: row.agentId ?? '' },
          select: { name: true, model: true },
        });
        return {
          agentId: row.agentId,
          agentName: agent?.name ?? 'Unknown',
          model: agent?.model ?? 'Unknown',
          totalCostUsd: Number(row._sum.costUsd ?? 0),
          totalTokens: row._sum.tokensUsed ?? 0,
          executions: row._count.id,
        };
      }),
    );

    const totals = enriched.reduce(
      (acc, r) => ({
        costUsd: acc.costUsd + r.totalCostUsd,
        tokens: acc.tokens + r.totalTokens,
      }),
      { costUsd: 0, tokens: 0 },
    );

    return { data: enriched, totals, from, to };
  }

  /**
   * Prometheus text-format metrics endpoint.
   * Returns COUNTER/GAUGE metrics scraped from the DB.
   * OCP: new metric sources can be added without changing the existing output.
   */
  async getPrometheusMetrics(tenantId?: string): Promise<string> {
    const where = tenantId ? { tenantId } : {};
    const agentCount = await this.prisma.agent.count({ where });
    const taskTotal = await this.prisma.task.count({ where });
    const taskCompleted = await this.prisma.task.count({
      where: { ...where, status: 'COMPLETED' },
    });
    const taskFailed = await this.prisma.task.count({
      where: { ...where, status: 'FAILED' },
    });

    const costAgg = await this.prisma.executionLog.aggregate({
      where: tenantId ? { agent: { tenantId } } : {},
      _sum: { costUsd: true, tokensUsed: true },
    });

    const lines: string[] = [
      '# HELP neurecore_agents_total Total number of agents',
      '# TYPE neurecore_agents_total gauge',
      `neurecore_agents_total${tenantId ? `{tenant="${tenantId}"}` : ''} ${agentCount}`,
      '',
      '# HELP neurecore_tasks_total Total task executions',
      '# TYPE neurecore_tasks_total counter',
      `neurecore_tasks_total${tenantId ? `{tenant="${tenantId}",status="all"}` : ''} ${taskTotal}`,
      `neurecore_tasks_total${tenantId ? `{tenant="${tenantId}",status="completed"}` : '{status="completed"}'} ${taskCompleted}`,
      `neurecore_tasks_total${tenantId ? `{tenant="${tenantId}",status="failed"}` : '{status="failed"}'} ${taskFailed}`,
      '',
      '# HELP neurecore_cost_usd_total Total LLM cost in USD',
      '# TYPE neurecore_cost_usd_total counter',
      `neurecore_cost_usd_total${tenantId ? `{tenant="${tenantId}"}` : ''} ${Number(costAgg._sum.costUsd ?? 0).toFixed(6)}`,
      '',
      '# HELP neurecore_tokens_total Total tokens consumed',
      '# TYPE neurecore_tokens_total counter',
      `neurecore_tokens_total${tenantId ? `{tenant="${tenantId}"}` : ''} ${costAgg._sum.tokensUsed ?? 0}`,
    ];

    return lines.join('\n') + '\n';
  }
}
