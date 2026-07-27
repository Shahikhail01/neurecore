// src/modules/reviews/application/lifecycle-guard.service.ts
import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { LifecycleWaiverScope, type TaskStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import {
  TASK_REPOSITORY,
  type ITaskRepository,
} from '../../../common/ports/task-repository.port';
import {
  canTransition,
  ProjectStatus,
} from '../../projects/common/project-lifecycle';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../projects/domain/ports/project-repository.port';
import {
  LIFECYCLE_WAIVER_REPOSITORY,
  type ILifecycleWaiverRepository,
} from '../domain/ports/lifecycle-waiver-repository.port';

/**
 * Phase 6 — Lifecycle transition guards (plan §8.2)
 *
 * Guard contract:
 *   - REVIEW → COMPLETED requires all mandatory tasks approved (no NEEDS_REVIEW / IN_PROGRESS)
 *   - Every other transition is allowed by the state machine; guards add cross-aggregate checks.
 *   - A guard failure is *recoverable*: caller may supply a structured waiver that is
 *     recorded as a LifecycleWaiver row before advancing the stage.
 *
 * Determinism:
 *   - Guard checks are tenant-scoped via the `tenantId` argument.
 *   - No side-effects inside canTransition(); only reads.
 */
@Injectable()
export class LifecycleGuardService {
  private readonly logger = new Logger(LifecycleGuardService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(TASK_REPOSITORY)
    private readonly taskRepo: ITaskRepository,
    @Optional()
    @Inject(LIFECYCLE_WAIVER_REPOSITORY)
    private readonly waiverRepo?: ILifecycleWaiverRepository,
  ) {}

  /**
   * Plan §8.2 guard:
   *   REVIEW → COMPLETED requires no mandatory task to remain unapproved.
   *   ACTIVE → COMPLETED is allowed by the state machine, but a guard check
   *   still applies: any task in NEEDS_REVIEW / IN_PROGRESS / QUEUED / RUNNING blocks
   *   the completion unless waived.
   *
   * `tenantId` is required so the underlying task query can never escape
   * the caller's tenant even if `projectId` were to leak across.
   */
  async canTransition(
    tenantId: string,
    projectId: string,
    fromStage: ProjectStatus,
    toStage: ProjectStatus,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!tenantId) {
      return { allowed: false, reason: 'TENANT_REQUIRED' };
    }
    if (!projectId) {
      return { allowed: false, reason: 'PROJECT_ID_REQUIRED' };
    }
    if (!canTransition(fromStage, toStage)) {
      return {
        allowed: false,
        reason: `Invalid transition: ${fromStage} → ${toStage}`,
      };
    }

    if (toStage === 'COMPLETED') {
      return this.checkMandatoryTasksApproved(tenantId, projectId, fromStage);
    }

    return { allowed: true };
  }

  private async checkMandatoryTasksApproved(
    tenantId: string,
    projectId: string,
    fromStage: ProjectStatus,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Tasks in any non-terminal blocking state count as "not yet approved".
    // We treat APPROVED + COMPLETED + CANCELLED as terminal; everything else
    // (NEEDS_REVIEW, IN_PROGRESS, QUEUED, RUNNING, NEEDS_INPUT, BLOCKED, …) blocks.
    const blockingStatuses: string[] = [
      'PENDING',
      'DRAFT',
      'READY',
      'ASSIGNED',
      'QUEUED',
      'RUNNING',
      'IN_PROGRESS',
      'NEEDS_INPUT',
      'NEEDS_REVIEW',
      'BLOCKED',
      'FAILED_RETRYABLE',
    ];

    // Verify the project belongs to the tenant before issuing the task
    // query — defense in depth against accidental cross-tenant reads.
    const project = await this.projectRepo.findById(tenantId, projectId);
    if (!project) {
      return {
        allowed: false,
        reason: 'PROJECT_NOT_FOUND_IN_TENANT',
      };
    }

    const pending = await this.taskRepo.findByProjectAndStatuses(
      tenantId,
      projectId,
      blockingStatuses as TaskStatus[],
    );

    if (pending.length > 0) {
      return {
        allowed: false,
        reason: `${pending.length} mandatory task(s) require approval before completion (from stage ${fromStage})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Records a structured waiver for a transition that would have failed its guard.
   * The waiver is the audit trail that justifies why a guard was bypassed.
   */
  async recordStructuredWaiver(
    tenantId: string,
    projectId: string,
    fromStage: ProjectStatus,
    toStage: ProjectStatus,
    reason: string,
    guardFailureReason: string,
    metadata: CommandMetadata,
    rawTx?: Prisma.TransactionClient,
  ): Promise<string> {
    if (!this.waiverRepo) {
      throw new Error('LIFECYCLE_WAIVER_REPOSITORY_NOT_REGISTERED');
    }
    if (!tenantId) {
      throw new Error('TENANT_REQUIRED');
    }
    if (!reason || !reason.trim()) {
      throw new Error('WAIVER_REASON_REQUIRED');
    }

    const waiver = await this.waiverRepo.create(
      {
        tenantId: tenantId,
        scope: LifecycleWaiverScope.PROJECT_STAGE,
        entityType: 'Project',
        entityId: projectId,
        fromStage,
        toStage,
        reason: reason.trim(),
        waivedByActorId: metadata.actorId,
        waivedByActorType: metadata.actorType,
        guardFailureReason,
      },
      rawTx,
    );

    this.logger.log(
      `[waiver] tenant=${tenantId} project=${projectId} ` +
        `${fromStage}→${toStage} actor=${metadata.actorId} reason="${reason}"`,
    );

    return waiver.id;
  }
}
