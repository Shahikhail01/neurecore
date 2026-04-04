import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaFeatureStore } from './featureStore.prisma';
import { HttpModelRunner } from './modelRunner.http';

/**
 * AnalyticsService
 *
 * SRP:  Orchestrates analytics flows — delegates storage to PrismaFeatureStore
 *       and model execution to HttpModelRunner.
 * DIP:  Depends on injectable abstractions; resolved by NestJS DI container.
 * OCP:  New operations (cohort analysis, custom reports) can be added without
 *       modifying existing score/forecast/anomaly methods.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureStore: PrismaFeatureStore,
    private readonly modelRunner: HttpModelRunner,
  ) {}

  // ─── Models ──────────────────────────────────────────────────────────────

  async getModels(tenantId?: string) {
    return this.prisma.analyticsModel.findMany({
      where: { ...(tenantId ? { tenantId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Score ───────────────────────────────────────────────────────────────

  async score(
    tenantId: string,
    features: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    await this.featureStore.save(tenantId, features);
    const models = await this.getModels(tenantId);
    const model = models[0];
    if (!model)
      this.logger.warn(`No model for tenant ${tenantId}; using runner default`);
    return this.modelRunner.runModel(model?.id ?? 'default', features);
  }

  // ─── Forecast ────────────────────────────────────────────────────────────

  async forecast(
    tenantId: string,
    periods: number,
  ): Promise<Record<string, unknown>> {
    const result = await this.modelRunner.forecast(periods);
    return { tenantId, periods, ...result };
  }

  // ─── Anomaly ─────────────────────────────────────────────────────────────

  async detectAnomalies(
    tenantId: string,
    vectors: number[][],
  ): Promise<Record<string, unknown>> {
    const result = await this.modelRunner.detectAnomalies(vectors);
    return { tenantId, ...result };
  }

  // ─── Embeddings ──────────────────────────────────────────────────────────

  async embed(
    tenantId: string,
    texts: string[],
  ): Promise<Record<string, unknown>> {
    const result = await this.modelRunner.embed(texts);
    return { tenantId, count: texts.length, ...result };
  }

  // ─── Feature history ─────────────────────────────────────────────────────

  async getFeatureHistory(tenantId: string, limit = 50) {
    return this.featureStore.list(tenantId, limit);
  }

  async getLatestFeatures(tenantId: string) {
    return this.featureStore.getLatest(tenantId);
  }

  // ─── Report ──────────────────────────────────────────────────────────────

  async getReport(tenantId: string) {
    const [models, latest] = await Promise.all([
      this.getModels(tenantId),
      this.featureStore.getLatest(tenantId),
    ]);
    return {
      tenantId,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
      })),
      latestFeatures: latest,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── Summary (dashboard KPI aggregate) ───────────────────────────────────

  async getSummary(tenantId: string | null) {
    const where = tenantId ? { tenantId } : {};
    const taskWhere = tenantId ? { tenantId } : {};

    const [
      totalAgents,
      runningAgents,
      totalTasks,
      completedTasks,
      failedTasks,
      totalWorkflows,
      activeWorkflows,
    ] = await Promise.all([
      this.prisma.agent.count({ where }),
      this.prisma.agent.count({ where: { ...where, status: 'RUNNING' } }),
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'COMPLETED' } }),
      this.prisma.task.count({ where: { ...taskWhere, status: 'FAILED' } }),
      this.prisma.workflow.count({ where }),
      this.prisma.workflow.count({ where: { ...where, status: 'ACTIVE' } }),
    ]);

    const successRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      agents: {
        total: totalAgents,
        running: runningAgents,
        idle: totalAgents - runningAgents,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        successRate,
      },
      workflows: { total: totalWorkflows, active: activeWorkflows },
      generatedAt: new Date().toISOString(),
    };
  }
}
