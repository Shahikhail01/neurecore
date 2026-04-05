import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface MaturityDimension {
  name: string;
  score: number; // 0–100
  label: string; // 'Beginner' | 'Developing' | 'Proficient' | 'Advanced' | 'Expert'
  detail: string;
}

export interface MaturityReport {
  overallScore: number;
  tier: string;
  dimensions: MaturityDimension[];
  computedAt: string;
}

type TierLabel =
  | 'Beginner'
  | 'Developing'
  | 'Proficient'
  | 'Advanced'
  | 'Expert';

/**
 * MaturityService
 * SRP: compute agent-maturity score from observable platform signals.
 * OCP: add new dimensions without modifying existing logic.
 */
@Injectable()
export class MaturityService {
  constructor(private readonly prisma: PrismaService) {}

  async getMaturityReport(tenantId: string): Promise<MaturityReport> {
    const [agentStats, taskStats, goalStats, routineStats] = await Promise.all([
      this.getAgentStats(tenantId),
      this.getTaskStats(tenantId),
      this.getGoalStats(tenantId),
      this.getRoutineStats(tenantId),
    ]);

    const dimensions: MaturityDimension[] = [
      this.scoreDimension(
        'Agent Coverage',
        this.clamp(agentStats.active * 10, 100),
        'Active agents in production',
      ),
      this.scoreDimension(
        'Task Completion',
        agentStats.totalAgents > 0
          ? this.clamp(
              (taskStats.completed / Math.max(taskStats.total, 1)) * 100,
              100,
            )
          : 0,
        'Completed vs total tasks',
      ),
      this.scoreDimension(
        'Goal Achievement',
        goalStats.total > 0
          ? this.clamp((goalStats.completed / goalStats.total) * 100, 100)
          : 0,
        'Achieved goals ratio',
      ),
      this.scoreDimension(
        'Automation Depth',
        this.clamp(routineStats.activeRoutines * 15, 100),
        'Active scheduled routines',
      ),
      this.scoreDimension(
        'Multi-Agent Orchestration',
        this.clamp(agentStats.withSupervisors * 20, 100),
        'Agents with supervisor hierarchy',
      ),
    ];

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
    );

    return {
      overallScore,
      tier: this.tierLabel(overallScore),
      dimensions,
      computedAt: new Date().toISOString(),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private scoreDimension(
    name: string,
    score: number,
    detail: string,
  ): MaturityDimension {
    return { name, score, label: this.tierLabel(score), detail };
  }

  private tierLabel(score: number): TierLabel {
    if (score >= 90) return 'Expert';
    if (score >= 70) return 'Advanced';
    if (score >= 50) return 'Proficient';
    if (score >= 25) return 'Developing';
    return 'Beginner';
  }

  private clamp(value: number, max: number): number {
    return Math.min(Math.round(value), max);
  }

  private async getAgentStats(tenantId: string) {
    const [totalAgents, active, withSupervisors] = await Promise.all([
      this.prisma.agent.count({ where: { tenantId } }),
      this.prisma.agent.count({ where: { tenantId, isActive: true } }),
      this.prisma.agent.count({
        where: { tenantId, supervisorId: { not: null } },
      }),
    ]);
    return { totalAgents, active, withSupervisors };
  }

  private async getTaskStats(tenantId: string) {
    const [total, completed] = await Promise.all([
      this.prisma.task.count({ where: { tenantId } }),
      this.prisma.task.count({ where: { tenantId, status: 'COMPLETED' } }),
    ]);
    return { total, completed };
  }

  private async getGoalStats(tenantId: string) {
    const [total, completed] = await Promise.all([
      this.prisma.goal.count({ where: { tenantId } }),
      this.prisma.goal.count({ where: { tenantId, status: 'COMPLETED' } }),
    ]);
    return { total, completed };
  }

  private async getRoutineStats(tenantId: string) {
    const activeRoutines = await this.prisma.routine.count({
      where: { tenantId, status: 'ACTIVE' },
    });
    return { activeRoutines };
  }
}
