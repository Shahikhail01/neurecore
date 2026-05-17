// ─── DashboardService.ts ─────────────────────────────────────────────────────
// SRP: Aggregates cross-entity data for the HeadQuarter dashboard view.
// DIP: Depends on IRepository abstractions, not concrete repos.
// OCP: Extended via constructor injection — no internal concrete coupling.

import type { IDashboardService, DailyBriefing } from '@/core/services/interfaces/IDashboardService';
import type { IRepository } from '@/core/repositories/interfaces/IRepository';
import type { Agent, Task, Workflow, ActivityEvent, CompanyMetrics } from '@/shared/types/domain.types';
import { agentRepository } from '@/core/repositories/AgentRepository';
import { taskRepository } from '@/core/repositories/TaskRepository';
import { workflowRepository } from '@/core/repositories/WorkflowRepository';

export class DashboardService implements IDashboardService {
  constructor(
    private readonly agents: IRepository<Agent>,
    private readonly tasks: IRepository<Task>,
    private readonly workflows: IRepository<Workflow>,
  ) {}

  async getCompanyMetrics(_timeRange?: import('@/shared/types/domain.types').TimeRange): Promise<CompanyMetrics> {
    const [agentResult, taskResult] = await Promise.all([
      this.agents.findAll(),
      this.tasks.findAll(),
    ]);

    const activeAgents = agentResult.items.filter((a) => a.status === 'ACTIVE').length;
    const pendingTasks = taskResult.items.filter((t) => t.status === 'PENDING').length;
    const inProgressTasks = taskResult.items.filter((t) => t.status === 'IN_PROGRESS').length;
    const completedTasks = taskResult.items.filter((t) => t.status === 'COMPLETED').length;

    const successRates = agentResult.items
      .filter((a) => a.performance?.successRate != null)
      .map((a) => a.performance.successRate);
    const avgSuccessRate = successRates.length
      ? successRates.reduce((s, r) => s + r, 0) / successRates.length
      : 0;

    const harmonyScore = this._calculateTeamHarmony(agentResult.items);

    // CompanyMetrics shape from domain.types.ts
    return {
      totalAgents: agentResult.total,
      activeAgents,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      avgSuccessRate: Math.round(avgSuccessRate),
      teamHarmonyScore: harmonyScore,
    } as unknown as CompanyMetrics;
  }

  async getActivityTimeline(): Promise<ActivityEvent[]> {
    // Delegate to task list — adaptors produce ActivityEvent-compatible shapes.
    // Real-time updates are handled by EventBus; this fetch seeds initial state.
    const { items } = await this.tasks.findAll({ limit: 20 });
    return items.map((t) => ({
      id: t.id,
      type: 'task',
      title: t.title,
      description: t.description ?? '',
      entityId: t.id,
      entityType: 'Task',
      timestamp: t.updatedAt,
      metadata: { status: t.status, priority: t.priority },
    })) as unknown as ActivityEvent[];
  }

  async getDailyBriefing(): Promise<DailyBriefing> {
    const [agentResult, taskResult, workflowResult] = await Promise.all([
      this.agents.findAll(),
      this.tasks.findAll(),
      this.workflows.findAll(),
    ]);

    const issues: string[] = [];
    const errorAgents = agentResult.items.filter((a) => a.status === 'ERROR');
    if (errorAgents.length)
      issues.push(`${errorAgents.length} agent(s) in ERROR state: ${errorAgents.map((a) => a.name).join(', ')}`);

    const criticalTasks = taskResult.items.filter((t) => t.priority === 'CRITICAL' && t.status !== 'COMPLETED');
    if (criticalTasks.length)
      issues.push(`${criticalTasks.length} critical task(s) still pending`);

    return {
      headline: `${agentResult.items.filter((a) => a.status === 'ACTIVE').length} of ${agentResult.total} agents active`,
      topWins: taskResult.items
        .filter((t) => t.status === 'COMPLETED')
        .slice(0, 3)
        .map((t) => t.title),
      topAlerts: issues,
      teamMood: this._calculateTeamHarmony(agentResult.items) >= 70 ? 'positive' : 'cautious',
      autonomyRate: Math.round(
        agentResult.items.length
          ? (agentResult.items.filter((a) => a.status === 'ACTIVE').length / agentResult.items.length) * 100
          : 0,
      ),
      generatedAt: new Date().toISOString(),
    };
  }

  async getTopAgents(limit = 5): Promise<Agent[]> {
    const { items } = await this.agents.findAll({ limit: 100 });
    return items
      .filter((a) => a.status === 'ACTIVE')
      .sort((a, b) => (b.performance?.successRate ?? 0) - (a.performance?.successRate ?? 0))
      .slice(0, limit);
  }

  async getPendingWorkItems(): Promise<{ tasks: Task[]; workflows: Workflow[]; pendingApprovals: number }> {
    type QP = import('@/core/repositories/interfaces/IRepository').QueryParams;
    const [taskResult, workflowResult] = await Promise.all([
      this.tasks.findAll({ status: 'PENDING' } as QP),
      this.workflows.findAll({ status: 'PENDING' } as QP),
    ]);

    return {
      tasks: taskResult.items,
      workflows: workflowResult.items,
      pendingApprovals: 0,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _calculateTeamHarmony(agents: Agent[]): number {
    if (!agents.length) return 0;
    const active = agents.filter((a) => a.status === 'ACTIVE');
    if (!active.length) return 0;

    const avgSuccess = active.reduce((s, a) => s + (a.performance?.successRate ?? 0), 0) / active.length;
    const stressed = active.filter((a) => a.mood === 'stressed').length;
    const stressPenalty = (stressed / active.length) * 20;
    const errorPenalty = agents.filter((a) => a.status === 'ERROR').length * 5;

    return Math.max(0, Math.min(100, Math.round(avgSuccess - stressPenalty - errorPenalty)));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const dashboardService = new DashboardService(
  agentRepository,
  taskRepository as unknown as IRepository<Task>,
  workflowRepository as unknown as IRepository<Workflow>,
);
