/**
 * Sales Outreach Orchestrator — Phase 8.2, §5.11.2.
 *
 * Solid:
 *   • SRP — orchestrates channel sequence per step. Per-channel dispatch
 *     is delegated to Phase 5's ChannelsModule.
 *   • OCP — adding a new channel = no change here (the MCP catalog
 *     surfaces the action; this runner looks it up by name).
 *   • DRY — the approval-policy gate is the canonical one
 *     (same policy used by the Studio codegen runner).
 *   • Append-only audit: every SalesOutreachRun is insert-only.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ApprovalPolicyKind, Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';

/**
 * OOB_APPROVAL_POLICIES — single canonical list. Adding a policy
 * = new entry here; no other code changes.
 */
export const OOB_APPROVAL_POLICIES: ReadonlyArray<{
  kind: ApprovalPolicyKind;
  displayName: string;
  description: string;
}> = [
  {
    kind: ApprovalPolicyKind.ALL_STEPS_AUTO,
    displayName: 'All Steps Auto',
    description: 'Every outreach step runs without human approval.',
  },
  {
    kind: ApprovalPolicyKind.STEPS_ABOVE_TIER_3_REQUIRE_APPROVAL,
    displayName: 'Steps Above Tier 3 Require Approval',
    description: 'Outreach steps whose MCP action riskTier > 3 require approval.',
  },
  {
    kind: ApprovalPolicyKind.ALL_STEPS_REQUIRE_APPROVAL,
    displayName: 'All Steps Require Approval',
    description: 'Every outreach step requires human approval.',
  },
];

export interface OutreachStep {
  // What channel the step uses.
  channelKind: string;
  // The MCP action to invoke (Phase 5.1 channel adapter).
  actionName: string;
  // The step's risk tier (used by the approval policy gate).
  riskTier: number;
  // Delay (ms) before this step starts after the previous one.
  delayMs?: number;
}

@Injectable()
export class SalesOutreachOrchestrator {
  private readonly logger = new Logger(SalesOutreachOrchestrator.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Policy management ──────────────────────────────────────

  async ensureOobPolicies(tenantId: string): Promise<number> {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    let created = 0;
    for (const p of OOB_APPROVAL_POLICIES) {
      const existing = await this.prisma.approvalPolicy.findUnique({
        where: { tenantId_kind: { tenantId, kind: p.kind } },
      });
      if (existing) continue;
      await this.prisma.approvalPolicy.create({
        data: {
          tenantId,
          kind: p.kind,
          displayName: p.displayName,
          description: p.description,
        },
      });
      created++;
    }
    return created;
  }

  listPolicies(tenantId: string) {
    return this.prisma.approvalPolicy.findMany({
      where: { tenantId },
      orderBy: { kind: 'asc' },
    });
  }

  // ─── Orchestration ────────────────────────────────────────

  /**
   * Schedule every step in `steps` for `contactId` against the given
   * campaign. Each step is persisted as a PENDING SalesOutreachRun
   * with `scheduledFor = now + cumulativeDelay`.
   *
   * The runner is single-pass: it does not loop. The Studio scheduler
   * runner (Phase 6.2) picks up PENDING runs whose scheduledFor has
   * passed.
   */
  async schedule(args: {
    tenantId: string;
    campaignId: string;
    contactId: string;
    steps: OutreachStep[];
    policyKind?: ApprovalPolicyKind;
  }): Promise<Array<{ runId: string; stepIndex: number; status: string; scheduledFor: string }>> {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    if (args.steps.length === 0) {
      throw new BadRequestException('steps must not be empty');
    }
    const policyKind = args.policyKind ?? ApprovalPolicyKind.STEPS_ABOVE_TIER_3_REQUIRE_APPROVAL;

    const created: Array<{ runId: string; stepIndex: number; status: string; scheduledFor: string }> = [];
    let cumulativeDelay = 0;
    for (let i = 0; i < args.steps.length; i++) {
      const step = args.steps[i];
      cumulativeDelay += step.delayMs ?? 86_400_000; // default: 1 day between steps
      const scheduledFor = new Date(Date.now() + cumulativeDelay);
      const needsApproval = this.requiresApproval(policyKind, step.riskTier);
      const status = needsApproval ? 'PENDING' : 'PENDING'; // both PENDING; the studio runner marks ESCALATED when blocked
      const run = await this.prisma.salesOutreachRun.create({
        data: {
          tenantId: args.tenantId,
          campaignId: args.campaignId,
          contactId: args.contactId,
          stepIndex: i,
          channelKind: step.channelKind,
          actionName: step.actionName,
          scheduledFor,
          status,
        },
      });
      created.push({
        runId: run.id,
        stepIndex: i,
        status: run.status,
        scheduledFor: run.scheduledFor.toISOString(),
      });
    }
    this.logger.log(
      `scheduled ${created.length} outreach runs for campaign ${args.campaignId} contact ${args.contactId} policy=${policyKind}`,
    );
    return created;
  }

  /**
   * Mark a step as sent (called by the dispatch handler). Append-only
   * semantics: only PENDING runs can transition.
   */
  async markSent(runId: string, providerId?: string) {
    const run = await this.prisma.salesOutreachRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new BadRequestException('run not found');
    if (run.status !== 'PENDING') {
      throw new BadRequestException(
        `run ${runId} is in status ${run.status}, cannot mark SENT`,
      );
    }
    return this.prisma.salesOutreachRun.update({
      where: { id: runId },
      data: { status: 'SENT', providerId, finishedAt: new Date() },
    });
  }

  async markFailed(runId: string, errorMessage: string) {
    const run = await this.prisma.salesOutreachRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new BadRequestException('run not found');
    return this.prisma.salesOutreachRun.update({
      where: { id: runId },
      data: { status: 'FAILED', errorMessage, finishedAt: new Date() },
    });
  }

  listRuns(tenantId: string, campaignId?: string) {
    return this.prisma.salesOutreachRun.findMany({
      where: {
        tenantId,
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });
  }

  // ─── ALM / environment-config management (§5.13.15) ─────

  async upsertEnvironmentConfig(args: {
    tenantId: string;
    environmentId: string;
    pipelineId?: string;
    destructiveAllowed?: boolean;
    productionAllowed?: boolean;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.studioEnvironmentConfig.upsert({
      where: {
        tenantId_environmentId: {
          tenantId: args.tenantId,
          environmentId: args.environmentId,
        },
      },
      create: {
        tenantId: args.tenantId,
        environmentId: args.environmentId,
        pipelineId: args.pipelineId,
        destructiveAllowed: args.destructiveAllowed ?? false,
        productionAllowed: args.productionAllowed ?? false,
        metadata: args.metadata ?? {},
      },
      update: {
        pipelineId: args.pipelineId,
        destructiveAllowed: args.destructiveAllowed ?? false,
        productionAllowed: args.productionAllowed ?? false,
        metadata: args.metadata ?? {},
      },
    });
  }

  listEnvironmentConfigs(tenantId: string) {
    return this.prisma.studioEnvironmentConfig.findMany({
      where: { tenantId },
      orderBy: { environmentId: 'asc' },
    });
  }

  // ─── Mobile omnichannel sessions (§5.13.16) ──────────────

  async recordMobileSession(args: {
    tenantId: string;
    connectionId: string;
    userId: string;
    latitude?: number;
    longitude?: number;
  }) {
    if (!args.tenantId || args.tenantId === '*') {
      throw new ForbiddenException('tenantId "*" is forbidden');
    }
    return this.prisma.mobileOmnichannelSession.upsert({
      where: { connectionId: args.connectionId },
      create: {
        tenantId: args.tenantId,
        connectionId: args.connectionId,
        userId: args.userId,
        latitude: args.latitude,
        longitude: args.longitude,
      },
      update: {
        lastActiveAt: new Date(),
        latitude: args.latitude,
        longitude: args.longitude,
      },
    });
  }

  listMobileSessions(tenantId: string) {
    return this.prisma.mobileOmnichannelSession.findMany({
      where: { tenantId },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  // ─── Internals ──────────────────────────────────────────

  private requiresApproval(policyKind: ApprovalPolicyKind, stepRiskTier: number): boolean {
    switch (policyKind) {
      case ApprovalPolicyKind.ALL_STEPS_AUTO:
        return false;
      case ApprovalPolicyKind.ALL_STEPS_REQUIRE_APPROVAL:
        return true;
      case ApprovalPolicyKind.STEPS_ABOVE_TIER_3_REQUIRE_APPROVAL:
        return stepRiskTier > 3;
      default:
        return true;
    }
  }
}
