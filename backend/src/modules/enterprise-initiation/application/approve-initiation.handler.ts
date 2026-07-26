// src/modules/enterprise-initiation/application/approve-initiation.handler.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import type { CommandResult } from '../../../common/commands/command.interface';
import { UNIT_OF_WORK, type IUnitOfWork } from '../../../common/ports/transaction.interface';
import { INITIATION_REPOSITORY, type IInitiationRepository } from '../domain/ports/initiation-repository.port';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../../../common/ports/audit.port';
import { OUTBOX_REPOSITORY, type IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { TenantFlagsService, FeatureFlag } from '../../tenant-flags/tenant-flags.service';
import { InitiationStateMachine } from '../domain/initiation-state-machine';
import { InitiationStatus } from '../domain/initiation-states';
import type {
  ApproveInitiationInput,
  ApproveInitiationResult,
} from '../commands/approve-initiation.command';

/**
 * Application handler — depends on PORTS only via DI tokens.
 * No PrismaService import. No direct database access.
 */
@Injectable()
export class ApproveInitiationHandler {
  private readonly logger = new Logger(ApproveInitiationHandler.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(INITIATION_REPOSITORY) private readonly initiationRepo: IInitiationRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    private readonly tenantFlags: TenantFlagsService,
  ) {}

  async handle(
    input: ApproveInitiationInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<ApproveInitiationResult>> {
    const isCanonical = await this.tenantFlags.isEnabled(
      FeatureFlag.CANONICAL_INITIATION,
      metadata.tenantId,
    );

    if (!isCanonical) {
      throw new Error('CANONICAL_INITIATION flag must be enabled');
    }

    return this.uow.execute(async () => {
      const initiation = await this.initiationRepo.findApprovedForUpdate(
        metadata.tenantId,
        input.initiationId,
      );

      if (!initiation) {
        throw new Error('INITIATION_NOT_FOUND');
      }

      if (initiation.tenantId !== metadata.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      InitiationStateMachine.assertTransition(
        initiation.status,
        InitiationStatus.APPROVED,
      );

      const updated = await (this.initiationRepo as any).approve(
        metadata.tenantId,
        input.initiationId,
        initiation.version,
        input.approvedByActorId,
        input.approvalComment,
      );

      await this.auditRepo.record({
        tenantId: metadata.tenantId,
        actor: metadata.actorId,
        action: 'INITIATION_APPROVED',
        resource: 'EnterpriseInitiation',
        resourceId: input.initiationId,
        correlationId: metadata.correlationId,
        causationId: metadata.causationId ?? undefined,
        result: 'success',
      });

      await this.outboxRepo.publish({
        tenantId: metadata.tenantId,
        eventType: 'InitiationApproved',
        sourceModule: 'enterprise-initiation',
        payload: {
          initiationId: input.initiationId,
          approvedBy: metadata.actorId,
        },
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        idempotencyKey: `initiation-approved:${input.initiationId}`,
        actorId: metadata.actorId,
        actorType: metadata.actorType,
      });

      return {
        success: true,
        data: {
          initiationId: updated.id,
          previousStatus: initiation.status,
          newStatus: InitiationStatus.APPROVED,
          automationRequested: true,
        },
        correlationId: metadata.correlationId,
        occurredAt: new Date(),
      };
    });
  }
}
