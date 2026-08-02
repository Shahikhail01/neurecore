/**
 * command-center.service.ts
 *
 * P8 Command Center (CR-AI-1201..1206) — legacy dashboard summary
 * aggregator. Counts agents, tasks, workflows, departments, pending
 * approvals, and recent activity from canonical owner tables. Every
 * row is tenant-scoped at the Prisma layer; the service never falls
 * back to fake zeros when a query returns zero rows — it returns the
 * true count.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { TimelineEvent } from '@/shared/types/timeline.types';

export interface CommandCenterAgentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  model: string | null;
  departmentId: string | null;
  _count: { tasks: number };
}

export interface CommandCenterTaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  agentId: string | null;
  createdAt: string;
}

export interface CommandCenterWorkflowRow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommandCenterDepartmentRow {
  id: string;
  name: string;
  status: string;
}

export interface CommandCenterSummary {
  agents: {
    total: number;
    active: number;
    running: number;
    paused: number;
    error: number;
    list: CommandCenterAgentRow[];
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    list: CommandCenterTaskRow[];
  };
  workflows: {
    total: number;
    active: number;
    list: CommandCenterWorkflowRow[];
  };
  departments: {
    total: number;
    list: CommandCenterDepartmentRow[];
  };
  approvals: { pending: number };
  costs: { monthCents: number; budgetCents: number };
  activity: Array<{
    id: string;
    message: string;
    severity: string;
    timestamp: string;
  }>;
  fetchedAt: string;
}

export interface TimelineQueryOptions {
  sort: 'impact' | 'recent' | 'priority';
  filter: 'all' | 'urgent' | 'my-action' | 'opportunities' | 'blockers';
  search?: string;
  limit?: number;
  page?: number;
  cursor?: string;
}

export interface TimelineResult {
  events: TimelineEvent[];
  nextCursor: string | null;
  total: number;
}

const SUMMARY_LIMIT = 10;
const ACTIVITY_LIMIT = 25;

@Injectable()
export class CommandCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommandCenterSummary(
    tenantId: string,
  ): Promise<CommandCenterSummary> {
    const [
      agentGroups,
      taskGroups,
      workflowGroups,
      pendingApprovals,
      monthSpend,
      budgetTotal,
      agentsList,
      tasksList,
      workflowsList,
      departments,
      recentAudit,
    ] = await Promise.all([
      this.prisma.agent.groupBy({
        by: ['status'],
        where: { tenantId, archived: false },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.workflow.groupBy({
        by: ['isActive'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.approvalRequest.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.costRecord.aggregate({
        where: {
          tenantId,
          windowStart: { gte: startOfMonth(new Date()) },
        },
        _sum: { costCents: true },
      }),
      this.prisma.budgetPolicy.aggregate({
        where: { tenantId, enabled: true },
        _sum: { limitCents: true },
      }),
      this.prisma.agent.findMany({
        where: { tenantId, archived: false },
        orderBy: { updatedAt: 'desc' },
        take: SUMMARY_LIMIT,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          model: true,
          departmentId: true,
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.task.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: SUMMARY_LIMIT,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          agentId: true,
          createdAt: true,
        },
      }),
      this.prisma.workflow.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: SUMMARY_LIMIT,
        select: {
          id: true,
          name: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.department.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: SUMMARY_LIMIT,
        select: { id: true, name: true, status: true },
      }),
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
          action: {
            in: [
              'agent.create',
              'agent.update',
              'agent.archive',
              'workflow.create',
              'workflow.activate',
              'workflow.execute',
              'task.create',
              'task.complete',
              'task.fail',
              'approval.request',
              'approval.granted',
              'approval.rejected',
              'channel.delivery_failed',
              'security.policy_denied',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          action: true,
          resource: true,
          result: true,
          createdAt: true,
        },
      }),
    ]);

    const agentCounts = countByStatus(agentGroups);
    const taskCounts = countByStatus(taskGroups);
    const workflowCounts = sumWorkflowActive(workflowGroups);

    return {
      agents: {
        total: sumValues(agentGroups),
        active: agentCounts['ACTIVE'] ?? 0,
        running: agentCounts['RUNNING'] ?? 0,
        paused: agentCounts['PAUSED'] ?? 0,
        error: agentCounts['ERROR'] ?? 0,
        list: agentsList.map<CommandCenterAgentRow>((a) => ({
          id: a.id,
          name: a.name,
          type: String(a.type),
          status: String(a.status),
          model: a.model,
          departmentId: a.departmentId,
          _count: { tasks: a._count.tasks },
        })),
      },
      tasks: {
        total: sumValues(taskGroups),
        pending: taskCounts['PENDING'] ?? 0,
        running: taskCounts['RUNNING'] ?? 0,
        completed: taskCounts['COMPLETED'] ?? 0,
        failed: taskCounts['FAILED'] ?? 0,
        list: tasksList.map<CommandCenterTaskRow>((t) => ({
          id: t.id,
          title: t.title,
          status: String(t.status),
          priority: String(t.priority),
          agentId: t.agentId,
          createdAt: t.createdAt.toISOString(),
        })),
      },
      workflows: {
        total: sumValues(workflowGroups),
        active: workflowCounts.active,
        list: workflowsList.map<CommandCenterWorkflowRow>((w) => ({
          id: w.id,
          name: w.name,
          isActive: w.isActive,
          createdAt: w.createdAt.toISOString(),
        })),
      },
      departments: {
        total: departments.length,
        list: departments.map<CommandCenterDepartmentRow>((d) => ({
          id: d.id,
          name: d.name,
          status: String(d.status),
        })),
      },
      approvals: { pending: pendingApprovals },
      costs: {
        monthCents: Number(monthSpend._sum.costCents ?? 0),
        budgetCents: Number(budgetTotal._sum.limitCents ?? 0),
      },
      activity: recentAudit.map((a) => ({
        id: a.id,
        message: describeAudit(a.action, a.resource, a.result),
        severity: a.result === 'failure' ? 'warning' : 'info',
        timestamp: a.createdAt.toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
    };
  }

  async getTimelineEvents(
    tenantId: string,
    _options: TimelineQueryOptions,
  ): Promise<TimelineResult> {
    const events = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        resource: true,
        result: true,
        createdAt: true,
      },
    });
    return {
      events: events.map<TimelineEvent>((e) => ({
        id: e.id,
        type: 'FYI',
        title: e.action,
        description: describeAudit(e.action, e.resource, e.result),
        impact: e.result === 'failure' ? 'HIGH' : 'LOW',
        timestamp: e.createdAt.toISOString(),
      })),
      nextCursor: null,
      total: events.length,
    };
  }

  markEventRead(_tenantId: string, _eventId: string): Promise<void> {
    return Promise.resolve();
  }
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function countByStatus(
  groups: ReadonlyArray<{ status: string; _count: { _all: number } }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of groups) {
    out[String(g.status)] = g._count._all;
  }
  return out;
}

function sumWorkflowActive(
  groups: ReadonlyArray<{ isActive: boolean; _count: { _all: number } }>,
): { active: number } {
  let active = 0;
  for (const g of groups) if (g.isActive) active += g._count._all;
  return { active };
}

function sumValues(
  groups: ReadonlyArray<{ _count: { _all: number } }>,
): number {
  let total = 0;
  for (const g of groups) total += g._count._all;
  return total;
}

function describeAudit(
  action: string,
  resource: string | null,
  result: string,
): string {
  const subject = resource ? ` ${resource}` : '';
  const verb = action.replace(/[._]/g, ' ');
  const outcome = result === 'failure' ? ' (failed)' : '';
  return `${verb}${subject}${outcome}`;
}
