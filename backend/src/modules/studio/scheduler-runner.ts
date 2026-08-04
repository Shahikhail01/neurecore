/**
 * Scheduled Governance Runner + Studio CD Runner.
 *
 * Source plan: §5.14.4 (Comprehensive audits (scheduled)),
 * §5.13.17 (DevOps and Continuous Delivery),
 * §5.14.5 (Real-time app health + escalation).
 *
 * Solid:
 *   • SRP — the runner does one thing: read due schedules, execute,
 *     write the append-only execution row. Business logic per control
 *     lives in the control itself.
 *   • OCP — adding a new scheduled kind = new branch in `tick()`.
 *
 * Two runnable types share the runner:
 *   1. ScheduledGovernanceRun — runs every (tenant | platform)
 *      GovernanceControl on its cron.
 *   2. DeploymentPipeline — promotes a StudioDeployment to the next
 *      environment on its schedule (auto-deploy on by default).
 *
 * Both share the same tick loop: `tick(now)` finds every schedule
 * whose nextRunAt <= now and executes it. Idempotent — re-running
 * within the same minute is a no-op.
 */

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import {
  GovernanceControlOutcome,
  Prisma,
  StudioDeploymentStatus,
} from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { CRON_PRESETS, parseCron, nextFireAt } from './cron';

export interface TickResult {
  governanceRuns: number;
  pipelineRuns: number;
  errors: string[];
}

@Injectable()
export class SchedulerRunner {
  private readonly logger = new Logger(SchedulerRunner.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Single entry point ───────────────────────────────────────

  /**
   * Execute every schedule whose `nextRunAt <= now`. Returns the
   * count of runs + any error messages. Safe to call repeatedly.
   */
  async tick(now: Date = new Date()): Promise<TickResult> {
    const errors: string[] = [];
    const gov = await this.runDueGovernanceSchedules(now, errors);
    const pipe = await this.runDuePipelines(now, errors);
    return {
      governanceRuns: gov,
      pipelineRuns: pipe,
      errors,
    };
  }

  // ─── Governance schedules ────────────────────────────────────

  private async runDueGovernanceSchedules(
    now: Date,
    errors: string[],
  ): Promise<number> {
    const due = await this.prisma.scheduledGovernanceRun.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      take: 50,
    });
    let ran = 0;
    for (const s of due) {
      try {
        await this.executeGovernanceSchedule(s.id);
        ran++;
      } catch (e) {
        const msg = `governance schedule ${s.id} failed: ${(e as Error).message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    }
    return ran;
  }

  private async executeGovernanceSchedule(id: string) {
    const schedule = await this.prisma.scheduledGovernanceRun.findUnique({
      where: { id },
    });
    if (!schedule) return;
    const start = Date.now();
    const outcome = await this.evaluateControl(schedule.controlId);
    await this.prisma.governanceScheduleExecution.create({
      data: {
        scheduleId: id,
        tenantId: schedule.tenantId,
        controlId: schedule.controlId,
        outcome: outcome.outcome,
        score: outcome.score ?? null,
        evidence: outcome.evidence as Prisma.InputJsonValue,
        durationMs: Date.now() - start,
        ranBy: 'system:scheduler',
        startedAt: new Date(start),
      },
    });
    // Compute next fire.
    const next =
      schedule.cron && schedule.kind !== 'ONE_OFF'
        ? nextFireFromCron(schedule.cron, new Date())
        : null;
    await this.prisma.scheduledGovernanceRun.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: next,
        // ONE_OFF schedules disable themselves after first run.
        enabled: schedule.kind === 'ONE_OFF' ? false : true,
      },
    });
  }

  /**
   * The control evaluator. Phase 6.2 ships the deterministic stub:
   * every control returns PASS by default. Phase 6.5 wires the real
   * evaluation per-control. The interface is intentionally narrow so
   * the wire-up is a single function change.
   */
  private async evaluateControl(controlId: string): Promise<{
    outcome: 'PASS' | 'FAIL' | 'ERROR' | 'SKIPPED';
    score?: number;
    evidence: Record<string, unknown>;
  }> {
    const control = await this.prisma.governanceControl.findUnique({
      where: { id: controlId },
    });
    if (!control) {
      return {
        outcome: GovernanceControlOutcome.SKIPPED,
        evidence: { reason: 'control not found' },
      };
    }
    // Real evaluation rule — stub for Phase 6.2: PASS if the control
    // is ACTIVE, SKIPPED otherwise.
    return {
      outcome:
        control.status === 'ACTIVE'
          ? GovernanceControlOutcome.PASS
          : GovernanceControlOutcome.SKIPPED,
      score: control.status === 'ACTIVE' ? 100 : 0,
      evidence: { controlId: control.id, status: control.status },
    };
  }

  // ─── Studio deployment pipelines ────────────────────────────

  private async runDuePipelines(
    now: Date,
    errors: string[],
  ): Promise<number> {
    // Pipelines that should auto-promote are: enabled pipelines where
    // the most recent deployment to the pipeline's environment is in
    // a SUCCEEDED state but a newer version exists in the source env.
    // Phase 6.2 ships the runner skeleton; real promotion logic is a
    // Phase 6.5 deliverable. We still emit a tick so the runner is
    // wired and observable.
    const pipelines = await this.prisma.deploymentPipeline.findMany({
      where: { autoDeploy: true },
      take: 25,
    });
    let ran = 0;
    for (const p of pipelines) {
      try {
        const due = await this.isPipelineDue(p.id, now);
        if (!due) continue;
        // We do not actually mutate deployments here — Phase 6.2 wires
        // the executor; Phase 6.5 adds the artifact transfer.
        ran++;
      } catch (e) {
        errors.push(`pipeline ${p.id}: ${(e as Error).message}`);
      }
    }
    return ran;
  }

  private async isPipelineDue(pipelineId: string, now: Date): Promise<boolean> {
    const last = await this.prisma.studioDeployment.findFirst({
      where: { status: StudioDeploymentStatus.SUCCEEDED },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) return false;
    return last.createdAt.getTime() <= now.getTime() - 60_000;
  }

  // ─── Schedule creation ────────────────────────────────────────

  async createSchedule(args: {
    tenantId?: string;
    controlId: string;
    kind: 'ONE_OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    cron?: string;
  }) {
    // Phase 6.2 P-1: refuse wildcard tenant id with a typed ForbiddenException.
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    const control = await this.prisma.governanceControl.findFirst({
      where: {
        id: args.controlId,
        OR: [{ tenantId: args.tenantId ?? null }, { tenantId: null }],
      },
    });
    if (!control) {
      throw new Error(`control ${args.controlId} not found for tenant`);
    }
    const cron =
      args.cron ??
      (args.kind === 'DAILY'
        ? CRON_PRESETS.DAILY
        : args.kind === 'WEEKLY'
          ? CRON_PRESETS.WEEKLY
          : args.kind === 'MONTHLY'
            ? CRON_PRESETS.MONTHLY
            : null);
    const nextRunAt =
      cron && args.kind !== 'ONE_OFF' ? nextFireFromCron(cron, new Date()) : null;
    return this.prisma.scheduledGovernanceRun.create({
      data: {
        tenantId: args.tenantId ?? null,
        controlId: args.controlId,
        kind: args.kind,
        cron,
        nextRunAt,
      },
    });
  }

  async listSchedules(tenantId?: string) {
    return this.prisma.scheduledGovernanceRun.findMany({
      where: { tenantId: tenantId ?? null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

export function nextFireFromCron(cron: string, from: Date): Date | null {
  const parsed = parseCron(cron);
  return nextFireAt(parsed, from);
}
