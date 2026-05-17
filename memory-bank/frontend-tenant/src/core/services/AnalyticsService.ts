// ─── AnalyticsService.ts ─────────────────────────────────────────────────────
// SRP: Metrics aggregation and trend calculation only.
// DIP: Consumes IRepository abstractions.

import type {
  IAnalyticsService,
  OverviewMetrics,
  TrendPoint,
  AgentPerformanceTrend,
  DepartmentMetric,
} from '@/core/services/interfaces/IAnalyticsService';
import type { IRepository } from '@/core/repositories/interfaces/IRepository';
import type { Agent, Task, Department } from '@/shared/types/domain.types';
import { agentRepository } from '@/core/repositories/AgentRepository';
import { taskRepository } from '@/core/repositories/TaskRepository';
import { departmentRepository } from '@/core/repositories/DepartmentRepository';

export class AnalyticsService implements IAnalyticsService {
  constructor(
    private readonly agents: IRepository<Agent>,
    private readonly tasks: IRepository<Task>,
    private readonly departments: IRepository<Department>,
  ) {}

  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const [agentResult, taskResult] = await Promise.all([
      this.agents.findAll(),
      this.tasks.findAll(),
    ]);

    const activeAgents = agentResult.items.filter((a) => a.status === 'ACTIVE').length;
    const tasksCompleted24h = taskResult.items.filter((t) => {
      if (t.status !== 'COMPLETED' || !t.completedAt) return false;
      const completedMs = new Date(t.completedAt).getTime();
      return Date.now() - completedMs < 24 * 60 * 60 * 1000;
    }).length;

    const tasksPending = taskResult.items.filter(
      (t) => t.status === 'PENDING' || t.status === 'ASSIGNED',
    ).length;

    const successRates = agentResult.items
      .filter((a) => a.performance?.successRate != null)
      .map((a) => a.performance.successRate);
    const avgSuccessRate = successRates.length
      ? successRates.reduce((s, r) => s + r, 0) / successRates.length
      : 0;

    const durations = taskResult.items
      .filter((t) => t.actualDuration != null)
      .map((t) => (t.actualDuration ?? 0) * 60_000); // minutes → ms
    const avgResponseTimeMs = durations.length
      ? durations.reduce((s, d) => s + d, 0) / durations.length
      : 0;

    return {
      totalAgents: agentResult.total,
      activeAgents,
      tasksCompleted24h,
      tasksPending,
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      successRate: Math.round(avgSuccessRate),
      teamHarmonyScore: this._calcHarmony(agentResult.items),
    };
  }

  async getAgentPerformanceTrends(
    agentIds: string[],
    from: Date,
    to: Date,
    _granularity: 'hour' | 'day' | 'week' = 'day',
  ): Promise<AgentPerformanceTrend[]> {
    const { items } = await this.agents.findAll();
    const selected = items.filter((a) => agentIds.includes(a.id));

    // Without a timeseries endpoint, build a synthetic two-point trend from
    // current performance data so the UI is unblocked.
    return selected.map((a) => ({
      agentId: a.id,
      agentName: a.name,
      points: [
        { timestamp: from.toISOString(), value: Math.max(0, (a.performance?.successRate ?? 0) - 5) },
        { timestamp: to.toISOString(), value: a.performance?.successRate ?? 0 },
      ] as TrendPoint[],
    }));
  }

  async getTaskCompletionTrends(
    from: Date,
    to: Date,
    granularity: 'hour' | 'day' | 'week' = 'day',
  ): Promise<TrendPoint[]> {
    const { items } = await this.tasks.findAll();
    const completed = items.filter(
      (t) =>
        t.status === 'COMPLETED' &&
        t.completedAt &&
        new Date(t.completedAt) >= from &&
        new Date(t.completedAt) <= to,
    );

    // Bucket by granularity
    const buckets = new Map<string, number>();
    const msPerBucket =
      granularity === 'hour' ? 3_600_000 : granularity === 'day' ? 86_400_000 : 604_800_000;

    for (const task of completed) {
      const ts = new Date(task.completedAt!);
      const bucketMs = Math.floor(ts.getTime() / msPerBucket) * msPerBucket;
      const key = new Date(bucketMs).toISOString();
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([timestamp, value]) => ({ timestamp, value }));
  }

  async getDepartmentMetrics(): Promise<DepartmentMetric[]> {
    const [deptResult, agentResult, taskResult] = await Promise.all([
      this.departments.findAll(),
      this.agents.findAll(),
      this.tasks.findAll(),
    ]);

    return deptResult.items.map((dept) => {
      const deptAgents = agentResult.items.filter((a) => a.departmentId === dept.id);
      const agentIds = new Set(deptAgents.map((a) => a.id));
      const deptTasks = taskResult.items.filter(
        (t) => t.agentId && agentIds.has(t.agentId),
      );

      const successRates = deptAgents.map((a) => a.performance?.successRate ?? 0);
      const avgSuccessRate = successRates.length
        ? successRates.reduce((s, r) => s + r, 0) / successRates.length
        : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        agentCount: deptAgents.length,
        tasksCompleted: deptTasks.filter((t) => t.status === 'COMPLETED').length,
        avgSuccessRate: Math.round(avgSuccessRate),
        harmonyScore: this._calcHarmony(deptAgents),
      };
    });
  }

  async calculateTeamHarmony(agentIds: string[]): Promise<number> {
    const { items } = await this.agents.findAll();
    const selected = items.filter((a) => agentIds.includes(a.id));
    return this._calcHarmony(selected);
  }

  async calculateAvgCompletionTime(agentId?: string): Promise<number> {
    const { items } = await this.tasks.findAll();
    const relevant = agentId ? items.filter((t) => t.agentId === agentId) : items;
    const withDuration = relevant.filter((t) => t.actualDuration != null);
    if (!withDuration.length) return 0;
    const total = withDuration.reduce((s, t) => s + (t.actualDuration ?? 0), 0);
    return Math.round(total / withDuration.length);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _calcHarmony(agents: Agent[]): number {
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
export const analyticsService = new AnalyticsService(
  agentRepository,
  taskRepository as unknown as IRepository<Task>,
  departmentRepository as unknown as IRepository<Department>,
);
