/**
 * ApprovalPortService — Phase 7 (ADR-006)
 *
 * Unified Capability Approval Port.
 *
 * Single entry point for all approval requests. Delegates to the three
 * existing engines while providing a unified interface:
 *   - IGovernanceEvaluator  (GovernanceModule) — pre-execution gating
 *   - ApprovalWorkflowEngine (HermesModule)  — multi-step workflow state machine
 *   - IApprovalChainsService (ApprovalChainsModule) — risk-tier chain resolution
 *
 * SOLID:
 *   SRP — orchestrates approval flow; each delegated engine retains its own SRP
 *   OCP — new approval types handled by extending delegation logic, not modifying it
 *   DIP — depends on IGovernanceEvaluator, IApprovalWorkflowEngine, IApprovalChainsService
 *   ISP — typed sub-interfaces keep the contract focused
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import type {
  IApprovalPort,
  ApprovalContext,
  WorkActor,
  ApprovalRequestData,
  ApprovalRequestResult,
  ApprovalDecision,
  ApprovalDecisionResult,
  ApprovalRequirement,
  ApprovalStatusResult,
  ApprovalStatusHistoryEntry,
} from './approval-port.interface';
import {
  APPROVAL_PORT,
  APPROVAL_WORKFLOW_ENGINE,
  type IApprovalWorkflowEngine,
  type CreateWorkflowInput,
  type WorkflowDecision,
} from './approval-port.interface';
import { GOVERNANCE_EVALUATOR } from '../governance/interfaces/governance-evaluator.interface';
import type { IGovernanceEvaluator } from '../governance/interfaces/governance-evaluator.interface';
import { APPROVAL_CHAINS_SERVICE } from '../approval-chains/interfaces/approval-chain.interface';
import type { IApprovalChainsService } from '../approval-chains/interfaces/approval-chain.interface';
import { EVENT_TRANSPORT } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { ApprovalStatus } from '@prisma/client';
import { ApprovalsService } from '../governance/services/approvals.service';

@Injectable()
export class ApprovalPortService implements IApprovalPort {
  private readonly logger = new Logger(ApprovalPortService.name);

  constructor(
    @Inject(GOVERNANCE_EVALUATOR)
    private readonly governanceEvaluator: IGovernanceEvaluator,
    @Inject(APPROVAL_WORKFLOW_ENGINE)
    private readonly workflowEngine: IApprovalWorkflowEngine,
    @Inject(APPROVAL_CHAINS_SERVICE)
    private readonly chainService: IApprovalChainsService,
    @Inject(EVENT_TRANSPORT)
    @Optional()
    private readonly eventTransport?: IEnterpriseEventTransport,
    @Optional()
    private readonly governanceApprovals?: ApprovalsService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async request(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData,
  ): Promise<ApprovalRequestResult> {
    this.logger.debug(
      `ApprovalPort.request() tenant=${context.tenantId} actor=${actor.id} resource=${context.resourceType}:${context.resourceId}`,
    );

    const requirement = await this.evaluateRequirement(context, actor);

    if (requirement.autoApproved) {
      return this.handleAutoApprove(context, actor, request, requirement);
    }

    if (requirement.requiresApproval) {
      return this.handleRequireApproval(context, actor, request, requirement);
    }

    if (!requirement.governanceAllowed) {
      return {
        approvalId: '',
        status: 'REJECTED',
        requiresHumanReview: false,
        expectedReviewerRole: null,
        estimatedResponseTime: null,
      };
    }

    return this.handleAutoApprove(context, actor, request, requirement);
  }

  async decide(
    decision: ApprovalDecision,
    reviewer: WorkActor,
    comment?: string,
  ): Promise<ApprovalDecisionResult> {
    this.logger.debug(
      `ApprovalPort.decide() approval=${decision.approvalId} decision=${decision.decision} reviewer=${reviewer.id}`,
    );

    // Phase 7 (SOL-02 §7) — self-approval prohibition at the port boundary.
    // An AI Employee (or SYSTEM actor) can never decide its own approval;
    // decisions must come from a HUMAN reviewer with a concrete identity.
    if (!reviewer || !reviewer.id) {
      throw new Error('SELF_APPROVAL_FORBIDDEN: reviewer identity is required');
    }
    if (reviewer.type === 'AI_AGENT' || reviewer.type === 'SYSTEM') {
      throw new Error(
        `SELF_APPROVAL_FORBIDDEN: ${reviewer.type} cannot decide an approval`,
      );
    }

    const existingWorkflow = await this.workflowEngine.getStatus(
      decision.approvalId,
      reviewer.tenantId,
    );

    if (existingWorkflow) {
      return this.handleWorkflowDecision(
        decision,
        reviewer,
        comment,
        existingWorkflow,
      );
    }

    return this.handleGovernanceDecision(decision, reviewer, comment);
  }

  async evaluateRequirement(
    context: ApprovalContext,
    actor: WorkActor,
  ): Promise<ApprovalRequirement> {
    const govResult = await this.governanceEvaluator.evaluate(context.tenantId, {
      action: context.resourceType,
      resourceId: context.resourceId,
      projectId: context.projectId,
      actorId: actor.id,
      actorType: actor.type,
      amount: context.amount,
      currency: context.currency,
    });

    const riskTier = context.riskTier ?? 'LOW';

    const autoApproved =
      govResult.allowed &&
      !govResult.requiresApproval &&
      riskTier === 'LOW';

    const governanceAllowed = govResult.allowed;

    const maxAutonomyLevel = this.deriveMaxAutonomyLevel(govResult, riskTier);

    return {
      requiresApproval: govResult.requiresApproval || riskTier !== 'LOW',
      riskTier,
      maxAutonomyLevel,
      reason: govResult.triggeredRules.length > 0
        ? `Triggered rules: ${govResult.triggeredRules.join(', ')}`
        : null,
      autoApproved,
      governanceAllowed,
      triggeredRules: govResult.triggeredRules,
    };
  }

  async getStatus(
    approvalId: string,
    tenantId: string,
  ): Promise<ApprovalStatusResult | null> {
    let workflow: any = null;
    try {
      workflow = await this.workflowEngine.getStatus(approvalId, tenantId);
    } catch {
      // workflow engine returns null/throws when not found
    }
    if (workflow) {
      return this.mapWorkflowToStatus(workflow);
    }

    if (this.governanceApprovals) {
      try {
        const req = await (this.governanceApprovals as any).findOne(approvalId, tenantId);
        if (req) {
          return this.mapGovernanceRequestToStatus(req);
        }
      } catch {
        // not found in governance either
      }
    }

    return null;
  }

  async cancel(approvalId: string, actorId: string, tenantId: string): Promise<void> {
    const workflow = await this.workflowEngine.getStatus(approvalId, tenantId);
    if (workflow) {
      await this.workflowEngine.cancel(approvalId, actorId);
      return;
    }

    if (this.governanceApprovals) {
      await (this.governanceApprovals as any).cancel(approvalId, tenantId, actorId);
    }
  }

  // ─── Private: Auto-Approve Path ────────────────────────────────────────────

  private async handleAutoApprove(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData,
    requirement: ApprovalRequirement,
  ): Promise<ApprovalRequestResult> {
    this.logger.log(
      `Auto-approving ${context.resourceType}:${context.resourceId} for actor ${actor.id}`,
    );

    const approvalId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    await this.emitEvent('enterprise.approval.granted', context.tenantId, actor.id, actor.type, {
      approvalId,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      decision: 'AUTO_APPROVED',
      reviewerId: null,
      reason: requirement.reason,
      correlationId: request.correlationId,
    });

    return {
      approvalId,
      status: 'AUTO_APPROVED',
      requiresHumanReview: false,
      expectedReviewerRole: null,
      estimatedResponseTime: '0s',
    };
  }

  // ─── Private: Require Human Approval Path ───────────────────────────────────

  private async handleRequireApproval(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData,
    requirement: ApprovalRequirement,
  ): Promise<ApprovalRequestResult> {
    this.logger.log(
      `Approval required for ${context.resourceType}:${context.resourceId} (riskTier=${requirement.riskTier}, rules=${requirement.triggeredRules.join(',')})`,
    );

    if (context.resourceType === 'deliverable' && context.projectId && requirement.riskTier !== 'LOW') {
      return this.createChainWorkflow(context, actor, request, requirement);
    }

    return this.createBasicWorkflow(context, actor, request, requirement);
  }

  private async createChainWorkflow(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData,
    requirement: ApprovalRequirement,
  ): Promise<ApprovalRequestResult> {
    let chainSteps: Array<{ stepOrder: number; approverRole: string[]; approverId?: string | null }> = [];
    let workflowId = '';
    let totalSteps = 1;

    try {
      const chainResolution = await this.chainService.resolveChain(
        context.tenantId,
        context.resourceId,
        '', // projectTypeVersionId resolved internally by chain service
      );
      chainSteps = chainResolution.steps.map((s) => ({
        stepOrder: s.stepOrder,
        approverRole: s.approverRole as string[],
        approverId: s.approverId,
      }));
      totalSteps = chainResolution.totalSteps;
    } catch (err) {
      this.logger.debug(
        `Chain resolution failed for ${context.resourceId}: ${err instanceof Error ? err.message : err}. Falling back to basic workflow.`,
      );
      chainSteps = [{ stepOrder: 0, approverRole: ['ADMIN', 'PROJECT_MANAGER'] }];
    }

    const workflow = await this.workflowEngine.create({
      name: request.title,
      description: request.description ?? undefined,
      workflowType: 'DELIVERABLE_APPROVAL',
      context: request.payload ?? {},
      steps: chainSteps,
      requesterId: actor.id,
      tenantId: context.tenantId,
      workspaceId: null,
      routineRunId: request.workRequestId ?? null,
      riskTier: requirement.riskTier,
      targetDeliverableId: context.resourceId,
      projectId: context.projectId ?? null,
    });

    workflowId = workflow.id;

    await this.emitEvent('enterprise.approval.requested', context.tenantId, actor.id, actor.type, {
      approvalId: workflowId,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      decision: 'PENDING',
      reviewerId: null,
      reason: requirement.reason,
      correlationId: request.correlationId,
      totalSteps,
    });

    const firstStep = chainSteps[0];
    return {
      approvalId: workflowId,
      status: 'PENDING',
      requiresHumanReview: true,
      expectedReviewerRole: firstStep?.approverRole?.[0] ?? null,
      estimatedResponseTime: this.estimateResponseTime(requirement.riskTier),
    };
  }

  private async createBasicWorkflow(
    context: ApprovalContext,
    actor: WorkActor,
    request: ApprovalRequestData,
    requirement: ApprovalRequirement,
  ): Promise<ApprovalRequestResult> {
    const steps: Array<{ stepOrder: number; approverRole: string[]; approverId?: string | null }> = [
      { stepOrder: 0, approverRole: this.defaultApproverRoles(requirement.riskTier) },
    ];

    const workflow = await this.workflowEngine.create({
      name: request.title,
      description: request.description ?? undefined,
      workflowType: 'AGENT_ACTION_APPROVAL',
      context: request.payload ?? {},
      steps,
      requesterId: actor.id,
      tenantId: context.tenantId,
      workspaceId: null,
      routineRunId: request.workRequestId ?? null,
      riskTier: requirement.riskTier,
      projectId: context.projectId ?? null,
    });

    await this.emitEvent('enterprise.approval.requested', context.tenantId, actor.id, actor.type, {
      approvalId: workflow.id,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      decision: 'PENDING',
      reviewerId: null,
      reason: requirement.reason,
      correlationId: request.correlationId,
      totalSteps: 1,
    });

    return {
      approvalId: workflow.id,
      status: 'PENDING',
      requiresHumanReview: true,
      expectedReviewerRole: steps[0].approverRole[0],
      estimatedResponseTime: this.estimateResponseTime(requirement.riskTier),
    };
  }

  // ─── Private: Decision Handling ─────────────────────────────────────────────

  private async handleWorkflowDecision(
    decision: ApprovalDecision,
    reviewer: WorkActor,
    comment: string | undefined,
    existingWorkflow: any,
  ): Promise<ApprovalDecisionResult> {
    const workflowDecision: WorkflowDecision =
      decision.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    const updated = await this.workflowEngine.advance(
      decision.approvalId,
      reviewer.id,
      workflowDecision,
      comment,
    );

    const eventType =
      decision.decision === 'APPROVED'
        ? 'enterprise.approval.granted'
        : 'enterprise.approval.rejected';

    await this.emitEvent(eventType, reviewer.tenantId, reviewer.id, reviewer.type, {
      approvalId: decision.approvalId,
      resourceType: updated.context?.resourceType ?? 'workflow',
      resourceId: updated.context?.resourceId ?? decision.approvalId,
      decision: decision.decision,
      reviewerId: reviewer.id,
      reason: decision.reason,
      revisionInstructions: decision.revisionInstructions,
      correlationId: decision.correlationId,
      isFinalStep: updated.currentStep >= updated.totalSteps,
    });

    return {
      approvalId: decision.approvalId,
      status: updated.status,
      eventEmitted: true,
    };
  }

  private async handleGovernanceDecision(
    decision: ApprovalDecision,
    reviewer: WorkActor,
    comment: string | undefined,
  ): Promise<ApprovalDecisionResult> {
    if (!this.governanceApprovals) {
      throw new Error(`No governance approvals service available for ${decision.approvalId}`);
    }

    const govDecision =
      decision.decision === 'RETURNED_FOR_REVISION'
        ? { status: 'REJECTED' as const, rejectionReason: decision.revisionInstructions ?? decision.reason }
        : { status: decision.decision as 'APPROVED' | 'REJECTED', rejectionReason: decision.reason ?? undefined };

    await (this.governanceApprovals as any).review(
      decision.approvalId,
      reviewer.tenantId,
      reviewer.id,
      govDecision,
    );

    const eventType =
      decision.decision === 'APPROVED'
        ? 'enterprise.approval.granted'
        : 'enterprise.approval.rejected';

    await this.emitEvent(eventType, reviewer.tenantId, reviewer.id, reviewer.type, {
      approvalId: decision.approvalId,
      resourceType: 'approval_request',
      resourceId: decision.approvalId,
      decision: decision.decision,
      reviewerId: reviewer.id,
      reason: decision.reason,
      revisionInstructions: decision.revisionInstructions,
      correlationId: decision.correlationId,
    });

    return {
      approvalId: decision.approvalId,
      status: decision.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
      eventEmitted: true,
    };
  }

  // ─── Private: Helpers ───────────────────────────────────────────────────────

  private deriveMaxAutonomyLevel(
    govResult: { allowed: boolean; requiresApproval: boolean; triggeredRules: string[] },
    riskTier: string,
  ): number {
    if (!govResult.allowed) return 0;
    if (riskTier === 'HIGH') return 2;
    if (riskTier === 'MEDIUM') return 4;
    if (govResult.requiresApproval) return 3;
    return 5;
  }

  private defaultApproverRoles(riskTier: string): string[] {
    switch (riskTier) {
      case 'HIGH':
        return ['ADMIN', 'COMPLIANCE_OFFICER'];
      case 'MEDIUM':
        return ['PROJECT_MANAGER', 'ADMIN'];
      default:
        return ['PROJECT_MANAGER'];
    }
  }

  private estimateResponseTime(riskTier: string): string {
    switch (riskTier) {
      case 'HIGH':
        return '24h';
      case 'MEDIUM':
        return '4h';
      default:
        return '1h';
    }
  }

  private mapWorkflowToStatus(workflow: Record<string, any>): ApprovalStatusResult {
    const history: ApprovalStatusHistoryEntry[] = [
      { event: 'CREATED', at: workflow.createdAt },
    ];
    if (workflow.status !== 'PENDING') {
      history.push({
        event: workflow.status,
        at: workflow.completedAt ?? workflow.updatedAt,
      });
    }

    return {
      approvalId: workflow.id,
      status: workflow.status,
      currentStep: workflow.currentStep,
      totalSteps: workflow.steps?.length ?? 0,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      decidedAt: workflow.completedAt ?? null,
      decidedBy: null,
      history,
    };
  }

  private mapGovernanceRequestToStatus(req: Record<string, any>): ApprovalStatusResult {
    const history: ApprovalStatusHistoryEntry[] = [
      { event: 'CREATED', at: req.createdAt },
    ];
    if (req.status === 'APPROVED' && req.approvedAt) {
      history.push({ event: 'APPROVED', at: req.approvedAt, actor: req.reviewedById ?? undefined });
    } else if (req.status === 'REJECTED' && req.rejectedAt) {
      history.push({ event: 'REJECTED', at: req.rejectedAt, actor: req.reviewedById ?? undefined });
    } else if (req.status === 'CANCELLED') {
      history.push({ event: 'CANCELLED', at: req.updatedAt });
    }

    return {
      approvalId: req.id,
      status: req.status,
      currentStep: 0,
      totalSteps: 1,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      decidedAt: req.approvedAt ?? req.rejectedAt ?? null,
      decidedBy: req.reviewedById
        ? { id: req.reviewedById, type: 'HUMAN', tenantId: req.tenantId }
        : null,
      history,
    };
  }

  private async emitEvent(
    eventType: string,
    tenantId: string,
    actorId: string,
    actorType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!this.eventTransport) {
      this.logger.debug(`Event transport not available, skipping ${eventType}`);
      return;
    }

    try {
      await this.eventTransport.publish({
        eventType,
        tenantId,
        actorId,
        actorType: actorType as any,
        idempotencyKey: `${eventType}.${payload['approvalId']}.${Date.now()}`,
        sourceModule: 'approval-port',
        payload,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to publish ${eventType}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
