/**
 * ApprovalWorkflowEngine — Phase Hermes H4.
 *
 * Multi-step approval workflow backed by the `ApprovalWorkflow` /
 * `ApprovalWorkflowStep` Prisma models (schema lines 2626–2666).
 *
 * Responsibilities:
 *   - `create()`   — persist a workflow with an ordered list of approver steps
 *   - `advance()`  — record an APPROVED/REJECTED decision for the current
 *                    step; auto-advance to the next step or close the workflow
 *   - `cancel()`   — requester-initiated cancellation (PENDING only)
 *   - `getStatus()`— single workflow descriptor (tenant-scoped)
 *   - `canApprove()` — does this user have the role/identity required for the
 *                    current step?
 *   - `getPendingForApprover()` — inbox view for an approver
 *   - `expire()` / `expireOldWorkflows()` — TTL enforcement
 *
 * Notification side-effects are emitted via `NotificationsService.create`
 * for each step transition. The notifications call is best-effort — a
 * notification failure does NOT roll back the workflow write.
 *
 * SOLID: SRP (workflow state machine only); OCP (add new workflow types
 * by extending `ApprovalWorkflowType` enum, no engine change needed);
 * DIP (depends on PrismaService + NotificationsService abstractions).
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ApprovalStatus, ApprovalWorkflowType, UserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

export interface ApprovalStepInput {
  stepOrder: number;
  approverRole: UserRole[];
  approverId?: string | null;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  workflowType: ApprovalWorkflowType;
  context?: Record<string, unknown>;
  steps: ApprovalStepInput[];
  requesterId: string;
  tenantId: string;
  workspaceId?: string | null;
  routineRunId?: string | null;
}

export type Decision = 'APPROVED' | 'REJECTED';

@Injectable()
export class ApprovalWorkflowEngine {
  private readonly logger = new Logger(ApprovalWorkflowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /**
   * Create a workflow with one or more approval steps. The first step
   * (`stepOrder === 0`) is set to PENDING; remaining steps wait.
   */
  async create(input: CreateWorkflowInput) {
    if (!input.steps || input.steps.length === 0) {
      throw new Error('At least one approval step is required');
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        name: input.name,
        description: input.description,
        workflowType: input.workflowType,
        tenantId: input.tenantId,
        requesterId: input.requesterId,
        workspaceId: input.workspaceId ?? null,
        routineRunId: input.routineRunId ?? null,
        context: (input.context ?? {}) as never,
        currentStep: 0,
        status: ApprovalStatus.PENDING,
        steps: {
          create: input.steps.map((s) => ({
            stepOrder: s.stepOrder,
            approverRole: s.approverRole,
            approverId: s.approverId ?? null,
            status: ApprovalStatus.PENDING,
          })),
        },
      },
      include: { steps: true },
    });

    await this.notifyApprover(workflow).catch((err) =>
      this.logger.warn(
        `Notification on workflow ${workflow.id} create failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    );

    return workflow;
  }

  /**
   * Record `decision` for the current step. APPROVED advances to the next
   * step (or completes the workflow if this was the last step). REJECTED
   * immediately closes the workflow.
   */
  async advance(
    workflowId: string,
    approverId: string,
    decision: Decision,
    comment?: string,
  ) {
    const wf = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);
    if (wf.status !== ApprovalStatus.PENDING) {
      throw new Error(`Workflow ${workflowId} is not pending`);
    }

    const current = wf.steps[wf.currentStep];
    if (!current) throw new Error(`No step at index ${wf.currentStep}`);

    await this.prisma.approvalWorkflowStep.update({
      where: { id: current.id },
      data: {
        status:
          decision === 'APPROVED'
            ? ApprovalStatus.APPROVED
            : ApprovalStatus.REJECTED,
        decision,
        comment: comment ?? null,
        approverId,
        decidedAt: new Date(),
      },
    });

    const isLast = wf.currentStep >= wf.steps.length - 1;
    let nextStatus: ApprovalStatus;
    let nextStep: number;
    let completion: {
      completedAt: Date;
      result: Record<string, unknown>;
    } | null = null;

    if (decision === 'REJECTED' || isLast) {
      nextStatus =
        decision === 'APPROVED'
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.REJECTED;
      nextStep = wf.currentStep;
      completion = {
        completedAt: new Date(),
        result: { decision, comment: comment ?? null, approverId },
      };
    } else {
      nextStatus = ApprovalStatus.PENDING;
      nextStep = wf.currentStep + 1;
    }

    const updated = await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: nextStatus,
        currentStep: nextStep,
        completedAt: completion?.completedAt,
        result: completion?.result as never,
      },
    });

    if (completion) {
      await this.notifyCompletion(updated).catch((err) =>
        this.logger.warn(
          `Completion notification for ${workflowId} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
    } else {
      await this.notifyApprover({
        id: updated.id,
        tenantId: updated.tenantId,
        currentStep: updated.currentStep,
        steps: wf.steps,
      }).catch((err) =>
        this.logger.warn(
          `Step-advance notification for ${workflowId} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
    }

    return updated;
  }

  /** Requester-initiated cancellation. PENDING only. */
  async cancel(workflowId: string, requesterId: string, reason?: string) {
    const wf = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);
    if (wf.status !== ApprovalStatus.PENDING) {
      throw new Error('Only pending workflows can be cancelled');
    }
    return this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: ApprovalStatus.CANCELLED,
        completedAt: new Date(),
        result: { cancelledBy: requesterId, reason: reason ?? null },
      },
    });
  }

  /** Single workflow lookup, tenant-scoped. */
  async getStatus(workflowId: string, tenantId: string) {
    return this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  /** Can `userId` approve the current step of `workflowId`? */
  async canApprove(
    workflowId: string,
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const wf = await this.prisma.approvalWorkflow.findFirst({
      where: { id: workflowId, tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!wf || wf.status !== ApprovalStatus.PENDING) return false;

    const step = wf.steps[wf.currentStep];
    if (!step) return false;

    if (step.approverId && step.approverId === userId) return true;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });
    if (!user) return false;
    return step.approverRole.includes(user.role);
  }

  /** Inbox — pending workflows this user can approve. */
  async getPendingForApprover(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { role: true },
    });
    if (!user) return [];
    return this.prisma.approvalWorkflow.findMany({
      where: {
        tenantId,
        status: ApprovalStatus.PENDING,
        steps: {
          some: {
            stepOrder: { equals: 0 }, // crude — see note below
            OR: [{ approverId: userId }, { approverRole: { has: user.role } }],
          },
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Expire a single workflow if still pending. */
  async expire(workflowId: string) {
    const wf = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });
    if (!wf || wf.status !== ApprovalStatus.PENDING) return null;
    return this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: ApprovalStatus.EXPIRED,
        completedAt: new Date(),
      },
    });
  }

  /** Bulk-expire workflows older than `hoursOld` that are still PENDING. */
  async expireOldWorkflows(hoursOld: number): Promise<number> {
    const cutoff = new Date(Date.now() - hoursOld * 3_600_000);
    const res = await this.prisma.approvalWorkflow.updateMany({
      where: {
        status: ApprovalStatus.PENDING,
        createdAt: { lt: cutoff },
      },
      data: { status: ApprovalStatus.EXPIRED, completedAt: new Date() },
    });
    return res.count;
  }

  private async notifyApprover(workflow: {
    id: string;
    tenantId: string;
    steps: Array<{ approverId: string | null; approverRole: UserRole[] }>;
    currentStep: number;
  }): Promise<void> {
    if (!this.notifications) return;
    const step = workflow.steps[workflow.currentStep];
    if (!step) return;
    await this.notifications.create({
      tenantId: workflow.tenantId,
      userId: step.approverId ?? undefined,
      type: 'APPROVAL_REQUEST',
      title: 'Approval requested',
      message: `Workflow ${workflow.id} requires your approval`,
      payload: { workflowId: workflow.id, step: workflow.currentStep },
    });
  }

  private async notifyCompletion(workflow: {
    id: string;
    tenantId: string;
    status: ApprovalStatus;
  }): Promise<void> {
    if (!this.notifications) return;
    const ok = workflow.status === ApprovalStatus.APPROVED;
    await this.notifications.create({
      tenantId: workflow.tenantId,
      type: ok ? 'SUCCESS' : 'WARNING',
      title: `Approval ${String(workflow.status).toLowerCase()}`,
      message: `Workflow ${workflow.id} finished with status ${workflow.status}`,
      payload: { workflowId: workflow.id, status: workflow.status },
    });
  }
}
