// src/modules/reviews/application/advance-project-stage.handler.ts
import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import type { CommandResult } from '../../../common/commands/command.interface';
import {
  UNIT_OF_WORK,
  type IUnitOfWork,
} from '../../../common/ports/transaction.interface';
import {
  AUDIT_REPOSITORY,
  type IAuditRepository,
} from '../../../common/ports/audit.port';
import {
  OUTBOX_REPOSITORY,
  type IOutboxRepository,
} from '../../../common/outbox/outbox-repository.port';
import { LifecycleGuardService } from './lifecycle-guard.service';
import {
  ProjectStatus,
  canTransition,
} from '../../projects/common/project-lifecycle';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../projects/domain/ports/project-repository.port';
import type {
  AdvanceProjectStageInput,
  AdvanceProjectStageResult,
} from '../commands/advance-project-stage.command';

const ROLE_OWNER = 'OWNER';
const ROLE_MANAGER = 'MANAGER';

/**
 * Phase 6 — AdvanceProjectStageHandler (plan §8.2)
 *
 * Single authoritative owner of "advance a project lifecycle stage".
 *
 * Properties:
 *  - State-machine guard via canTransition().
 *  - Cross-aggregate guard: REVIEW/ACTIVE → COMPLETED requires all mandatory
 *    tasks approved (LifecycleGuardService).
 *  - A guard failure is recoverable only by supplying a structured waiver;
 *    the waiver is recorded in lifecycle_waivers table before the transition.
 *    Waivers require OWNER or MANAGER (plan §8.2 — "policy.assertCanWaiveTransition").
 *  - Stage transition + waiver + outbox event + audit all commit atomically.
 *  - Optimistic concurrency on Project.stageVersion prevents two operators
 *    from racing a transition.
 *  - Non-HUMAN actors cannot advance a project lifecycle (no AI self-advance).
 */
@Injectable()
export class AdvanceProjectStageHandler {
  private readonly logger = new Logger(AdvanceProjectStageHandler.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: IProjectRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    private readonly lifecycleGuard: LifecycleGuardService,
  ) {}

  async handle(
    input: AdvanceProjectStageInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<AdvanceProjectStageResult>> {
    // Input / actor validation.
    if (!input.projectId) throw new Error('PROJECT_ID_REQUIRED');
    if (!input.toStage) throw new Error('TARGET_STAGE_REQUIRED');
    if (input.waiverReason !== undefined && !input.waiverReason.trim()) {
      // An empty waiver must be rejected (controller should also reject this)
      throw new Error('WAIVER_REASON_EMPTY');
    }
    if (metadata.actorType !== 'HUMAN') {
      throw new Error('PROJECT_ADVANCE_REQUIRES_HUMAN_ACTOR');
    }

    return this.uow.execute(async (rawTx) => {
      const tx = rawTx as Prisma.TransactionClient;
      // 1. Load project with tenant guard. The tenant-bound query is
      //    the primary tenant isolation; the re-check below is
      //    defense-in-depth so a project lookup on the wrong tenant
      //    is impossible to silently succeed.
      const project = await this.projectRepo.findById(
        metadata.tenantId,
        input.projectId,
        tx,
      );
      if (!project) {
        throw new NotFoundException('PROJECT_NOT_FOUND');
      }
      if (project.tenantId !== metadata.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      const fromStage = project.status as ProjectStatus;
      const toStage = input.toStage as ProjectStatus;

      // 2. State-machine guard
      if (!canTransition(fromStage, toStage)) {
        throw new Error(`INVALID_TRANSITION:${fromStage}->${toStage}`);
      }

      // 3. Cross-aggregate guard (tenantId is required by the guard
      //    service so it can never return a result computed from a
      //    different tenant's tasks).
      const guard = await this.lifecycleGuard.canTransition(
        metadata.tenantId,
        input.projectId,
        fromStage,
        toStage,
      );

      let waiverId: string | null = null;
      if (!guard.allowed) {
        if (!input.waiverReason) {
          throw new Error(
            `TRANSITION_GUARD_FAILED:${guard.reason ?? 'unknown'}`,
          );
        }
        // 3a. Only OWNER or MANAGER may waive lifecycle guards (plan §8.2).
        //     Without this check any caller with a JWT could mark a project
        //     COMPLETED with mandatory tasks still unapproved.
        if (
          input.actorRole !== ROLE_OWNER &&
          input.actorRole !== ROLE_MANAGER
        ) {
          throw new Error('WAIVER_REQUIRES_OWNER_OR_MANAGER');
        }
        // Record waiver in the SAME transaction so either both commit or neither does.
        waiverId = await this.recordWaiver(
          tx,
          input.projectId,
          fromStage,
          toStage,
          input.waiverReason,
          guard.reason ?? 'unknown',
          metadata,
        );
      }

      // 4. Optimistic update: only advance if stageVersion hasn't moved.
      const advanced = await this.projectRepo.advanceStage(
        {
          tenantId: metadata.tenantId,
          projectId: input.projectId,
          expectedStageVersion: project.stageVersion,
          toStage,
          completedAt: toStage === 'COMPLETED' ? new Date() : undefined,
        },
        tx,
      );
      if (!advanced) {
        throw new Error('STAGE_CONCURRENT_MODIFICATION');
      }

      // 5. Outbox event
      await this.outboxRepo.publish(
        {
          tenantId: metadata.tenantId,
          eventType: 'StageAdvanced',
          sourceModule: 'reviews',
          payload: {
            projectId: input.projectId,
            fromStage,
            toStage,
            actorId: metadata.actorId,
            waiverId,
          },
          correlationId: metadata.correlationId,
          causationId: metadata.causationId,
          idempotencyKey: `stage-advanced:${input.projectId}:${toStage}`,
          actorId: metadata.actorId,
          actorType: metadata.actorType,
        },
        tx,
      );

      // 6. Audit
      await this.auditRepo.record(
        {
          tenantId: metadata.tenantId,
          actor: metadata.actorId,
          action: 'PROJECT_STAGE_ADVANCED',
          resource: 'Project',
          resourceId: input.projectId,
          correlationId: metadata.correlationId,
          causationId: metadata.causationId ?? undefined,
          result: 'success',
          details: {
            fromStage,
            toStage,
            waiverId,
            guardReason: guard.reason,
            waiverReason: input.waiverReason,
            previousStageVersion: project.stageVersion,
            newStageVersion: project.stageVersion + 1,
          },
        },
        tx,
      );

      const occurredAt = new Date();
      return {
        success: true,
        data: {
          projectId: input.projectId,
          fromStage,
          toStage,
          waiverId,
          correlationId: metadata.correlationId,
          occurredAt: occurredAt.toISOString(),
        },
        correlationId: metadata.correlationId,
        occurredAt,
      };
    });
  }

  private async recordWaiver(
    tx: Prisma.TransactionClient,
    projectId: string,
    fromStage: string,
    toStage: string,
    reason: string,
    guardFailureReason: string,
    metadata: CommandMetadata,
  ): Promise<string> {
    const row = await tx.lifecycleWaiver.create({
      data: {
        tenantId: metadata.tenantId,
        scope: 'PROJECT_STAGE',
        entityType: 'Project',
        entityId: projectId,
        fromStage,
        toStage,
        reason,
        waivedByActorId: metadata.actorId,
        waivedByActorType: metadata.actorType,
        guardFailureReason,
      },
      select: { id: true },
    });

    this.logger.log(
      `[waiver] tenant=${metadata.tenantId} project=${projectId} ` +
        `${fromStage}→${toStage} actor=${metadata.actorId} reason="${reason}"`,
    );

    return row.id;
  }
}
