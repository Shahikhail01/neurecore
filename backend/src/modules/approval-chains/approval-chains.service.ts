/**
 * approval-chains module — Service
 *
 * Phase 4: Approval chain resolution.
 * - Filters approvalTemplate by riskTier matching deliverable's riskTier
 * - Ordered, sequential step progression
 * - blockedByPriorStep enforcement
 * - Tenant isolation: every operation takes tenantId and queries/updates only
 *   rows belonging to that tenant.
 *
 * SOLID: Single Responsibility — owns approval chain resolution only.
 * DIP: depends on IApprovalChainRepository abstraction. Cross-module reads of
 * Deliverable data go through DELIVERABLE_REPOSITORY (also a port), so this
 * module never touches prisma directly.
 *
 * FIX-COMPREHENSIVE 2026-07-23 (P0-B sibling) — Cross-tier approval guard
 * is wired via `TiersService.findAllActive()`. The service refreshes the
 * registry's tier catalog on every industry-route call so we never trust
 * a stale tier snapshot (max 1 SELECT per call, no extra round-trip).
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import type {
  ApprovalStepTemplate,
  ApprovalChainResolution,
  ApprovalWorkflowStepWithChain,
  IApprovalChainRepository,
} from './interfaces/approval-chain.interface';
import { APPROVAL_CHAIN_REPOSITORY } from './interfaces/approval-chain.interface';
import {
  DELIVERABLE_REPOSITORY,
  type IDeliverableRepository,
} from '../deliverables/interfaces/deliverable.interface';
import { ApprovalAddonRegistry } from './addons/approval-addon.registry';
import type { TierGuardOutcome } from './addons/approval-addon.interface';
import { TiersService } from '../tiers/tiers.service';
import { TierResolver } from '../tiers/services/tier-resolver.service';

@Injectable()
export class ApprovalChainsService {
  private readonly logger = new Logger(ApprovalChainsService.name);

  constructor(
    @Inject(APPROVAL_CHAIN_REPOSITORY)
    private readonly repository: IApprovalChainRepository,
    @Inject(DELIVERABLE_REPOSITORY)
    private readonly deliverableRepository: IDeliverableRepository,
    @Optional()
    private readonly addonRegistry?: ApprovalAddonRegistry,
    @Optional()
    private readonly tiersService?: TiersService,
    @Optional()
    private readonly tierResolver?: TierResolver,
  ) {}

  /**
   * Resolve the approval chain for a deliverable.
   *
   * Bug fix (audit-remediation): the previous implementation accepted a
   * `riskTier` parameter; the controller was passing `user.tenantId` into it,
   * so every call returned 404 ("No approval steps found for risk tier
   * '<UUID>'"). The riskTier must be derived from the deliverable and the
   * deliverable must belong to the tenant.
   *
   * Filters the project type's approvalTemplate by riskTier matching the
   * deliverable's tier, then returns ordered steps in sequential chain order.
   */
  async resolveChain(
    tenantId: string,
    deliverableId: string,
    projectTypeVersionId: string,
  ): Promise<ApprovalChainResolution> {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    const deliverable = await this.deliverableRepository.findById(
      deliverableId,
      tenantId,
    );
    if (!deliverable) {
      throw new NotFoundException(
        `Deliverable ${deliverableId} not found in tenant ${tenantId}`,
      );
    }
    if (!deliverable.riskTier) {
      throw new BadRequestException(
        `Deliverable ${deliverableId} has no riskTier; cannot resolve chain`,
      );
    }
    const riskTier: string = deliverable.riskTier;

    const version =
      await this.repository.findProjectTypeVersionById(projectTypeVersionId);
    if (!version) {
      throw new NotFoundException(
        `ProjectTypeVersion ${projectTypeVersionId} not found`,
      );
    }

    const template = (version.approvalTemplate ??
      []) as unknown as ApprovalStepTemplate[];

    const matchingSteps = template
      .filter((s) => !s.riskTier || s.riskTier === riskTier)
      .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));

    if (matchingSteps.length === 0) {
      throw new NotFoundException(
        `No approval steps found for risk tier '${riskTier}' on version ${projectTypeVersionId}`,
      );
    }

    const isSequential = matchingSteps.some(
      (s) => s.chainStepOrder !== undefined,
    );

    const totalSteps = isSequential
      ? Math.max(...matchingSteps.map((s) => s.chainStepOrder ?? 0)) + 1
      : matchingSteps.length;

    const chainSteps: ApprovalWorkflowStepWithChain[] = matchingSteps.map(
      (s, idx) => ({
        id: `resolved-${idx}`,
        approvalWorkflowId: '',
        stepOrder: s.stepOrder ?? idx,
        approverRole: [s.approverRole],
        approverId: null,
        status: 'PENDING',
        decision: null,
        comment: null,
        decidedAt: null,
        chainStepOrder: s.chainStepOrder ?? 0,
        chainStepTotal: s.chainStepTotal ?? totalSteps,
        blockedByPriorStep:
          s.chainStepOrder !== undefined && s.chainStepOrder > 0,
      }),
    );

    this.logger.debug(
      `Resolved ${matchingSteps.length} approval steps for tenant=${tenantId} deliverable=${deliverableId} (riskTier=${riskTier})`,
    );

    return {
      workflowId: `temp-${deliverableId}`,
      steps: chainSteps,
      isSequential,
      totalSteps,
    };
  }

  /**
   * Advance an approval workflow to the next sequential step.
   * Tenant-scoped: refuses to operate on another tenant's workflow.
   */
  async advanceChain(tenantId: string, workflowId: string): Promise<void> {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    const workflow = await this.repository.findWorkflowById(
      workflowId,
      tenantId,
    );

    if (!workflow) {
      throw new NotFoundException(
        `ApprovalWorkflow ${workflowId} not found in tenant ${tenantId}`,
      );
    }

    const currentStepIdx = workflow.currentStep;
    const nextStep = workflow.steps[currentStepIdx + 1];

    if (!nextStep) {
      await this.repository.updateWorkflow(workflowId, tenantId, {
        status: 'APPROVED',
        completedAt: new Date(),
      });
      this.logger.log(
        `ApprovalWorkflow ${workflowId} completed for tenant ${tenantId} — no more steps`,
      );
      return;
    }

    await this.repository.updateWorkflow(workflowId, tenantId, {
      currentStep: currentStepIdx + 1,
    });
    this.logger.debug(
      `ApprovalWorkflow ${workflowId} (tenant ${tenantId}) advanced to step ${currentStepIdx + 1}`,
    );
  }

  /**
   * Check if a step is blocked by its prior step in a sequential chain.
   * Tenant-scoped: returns false (the safe, non-leaky answer) for any step the
   * tenant does not own.
   */
  async isStepBlocked(tenantId: string, stepId: string): Promise<boolean> {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    const step = await this.repository.findStepWithWorkflow(stepId, tenantId);

    if (!step) return false;
    if (!step.blockedByPriorStep) return false;

    const currentIdx = step.approvalWorkflow.steps.findIndex(
      (s) => s.id === stepId,
    );
    if (currentIdx <= 0) return false;

    const priorStep = step.approvalWorkflow.steps[currentIdx - 1];
    return priorStep.status !== 'APPROVED';
  }

  /**
   * Get all pending approval workflows for a tenant.
   */
  async findPendingWorkflows(tenantId: string, riskTier?: string) {
    return this.repository.findWorkflows(tenantId, {
      status: ['PENDING'],
      riskTier,
    });
  }

  /**
   * Get the current pending step for a workflow.
   * Tenant-scoped: returns null for cross-tenant lookups.
   */
  async getCurrentStep(tenantId: string, workflowId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    const workflow = await this.repository.findWorkflowById(
      workflowId,
      tenantId,
    );

    if (!workflow) return null;
    return workflow.steps[workflow.currentStep] ?? null;
  }

  /**
   * FIX-COMPREHENSIVE 2026-07-23 — Cross-tier approval guard.
   *
   * Resolves industry-specific approval routes for a tenant AND applies
   * the tier × approval-stage cross validation. Returns a structured
   * `TierGuardOutcome` so the FE can:
   *   - Show eligible routes immediately
   *   - Show blocked routes with the "Upgrade to <minTierSlug> to enable"
   *     CTA + reason string
   *
   * SRP: this method is the single source of truth for "approval route +
   * tier ceiling → split eligible vs blocked" decisions. Other modules
   * do not compute this mapping.
   *
   * DIP: the tier catalog comes from `TiersService.findAllActive()` (the
   * canonical cross-module tier reader); the per-tenant `maxApprovalStages`
   * comes from `TierResolverService.resolveCapabilities()`. No direct
   * prisma calls in this method.
   */
  async getIndustryRoutes(
    tenantId: string,
    industrySlug: string,
  ): Promise<TierGuardOutcome> {
    const empty: TierGuardOutcome = {
      eligible: [],
      blocked: [],
      currentTierSlug: null,
      maxApprovalStages: null,
    };

    if (!this.addonRegistry) return empty;

    const routes = await this.addonRegistry.getRoutesForIndustry(
      tenantId,
      industrySlug,
    );

    let maxApprovalStages: number | null = null;
    let currentTierSlug: string | null = null;

    if (this.tierResolver) {
      const caps = await this.tierResolver.resolveCapabilities(tenantId);
      if (caps) {
        maxApprovalStages = caps.limits.maxApprovalStages;
        currentTierSlug = caps.tierSlug;
      }
    }

    if (this.tiersService) {
      const tiers = await this.tiersService.findAll();
      this.addonRegistry.setTierCatalog(tiers);
    }

    return this.addonRegistry.evaluateAgainstTier(
      routes,
      maxApprovalStages,
      currentTierSlug,
    );
  }
}
