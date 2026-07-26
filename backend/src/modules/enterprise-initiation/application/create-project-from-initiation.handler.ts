// src/modules/enterprise-initiation/application/create-project-from-initiation.handler.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import type { CommandResult } from '../../../common/commands/command.interface';
import { UNIT_OF_WORK, type IUnitOfWork } from '../../../common/ports/transaction.interface';
import { INITIATION_REPOSITORY, type IInitiationRepository } from '../domain/ports/initiation-repository.port';
import { PROJECT_REPOSITORY, type IProjectRepository } from '../../projects/domain/ports/project-repository.port';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../../../common/ports/audit.port';
import { OUTBOX_REPOSITORY, type IOutboxRepository } from '../../../common/outbox/outbox-repository.port';
import { TenantFlagsService, FeatureFlag } from '../../tenant-flags/tenant-flags.service';
import { InitiationStateMachine } from '../domain/initiation-state-machine';
import { InitiationStatus } from '../domain/initiation-states';
import type {
  CreateProjectFromInitiationInput,
  CreateProjectFromInitiationResult,
} from '../commands/create-project-from-initiation.command';
import { ExecutionEngine } from '@prisma/client';

/**
 * Application handler — depends on PORTS only via DI tokens.
 */
@Injectable()
export class CreateProjectFromInitiationHandler {
  private readonly logger = new Logger(CreateProjectFromInitiationHandler.name);

  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: IUnitOfWork,
    @Inject(INITIATION_REPOSITORY) private readonly initiationRepo: IInitiationRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepo: IAuditRepository,
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepo: IOutboxRepository,
    private readonly tenantFlags: TenantFlagsService,
  ) {}

  async handle(
    input: CreateProjectFromInitiationInput,
    metadata: CommandMetadata,
  ): Promise<CommandResult<CreateProjectFromInitiationResult>> {
    const isCanonical = await this.tenantFlags.isEnabled(
      FeatureFlag.CANONICAL_INITIATION,
      metadata.tenantId,
    );

    if (!isCanonical) {
      throw new Error('CANONICAL_INITIATION flag must be enabled for golden path');
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

      if (initiation.status !== InitiationStatus.APPROVED) {
        throw new Error('INITIATION_NOT_APPROVED');
      }

      const existingProject = await this.projectRepo.findByInitiationId(
        metadata.tenantId,
        input.initiationId,
      );

      if (existingProject) {
        return {
          success: true,
          data: {
            projectId: existingProject.id,
            initiationId: input.initiationId,
            automationStatus: 'COMPLETED',
            correlationId: metadata.correlationId,
          },
          correlationId: metadata.correlationId,
          occurredAt: new Date(),
          deduplicated: true,
        };
      }

      const project = await this.projectRepo.create({
        tenantId: metadata.tenantId,
        name: input.projectName,
        description: input.projectDescription ?? initiation.projectDescription ?? undefined,
        customerId: input.customerId ?? initiation.customerId ?? undefined,
        targetDate: input.targetDate,
        initiationId: initiation.id,
        executionEngineVersion: ExecutionEngine.canonical,
        status: 'ACTIVE',
      });

      await this.initiationRepo.markMaterializing(
        metadata.tenantId,
        initiation.id,
        project.id,
        initiation.version,
      );

      await this.auditRepo.record({
        tenantId: metadata.tenantId,
        actor: metadata.actorId,
        action: 'PROJECT_CREATED_FROM_INITIATION',
        resource: 'Project',
        resourceId: project.id,
        correlationId: metadata.correlationId,
        causationId: metadata.causationId ?? undefined,
        result: 'success',
      });

      await this.outboxRepo.publish({
        tenantId: metadata.tenantId,
        eventType: 'ProjectAutomationRequested',
        sourceModule: 'project-automation',
        payload: {
          projectId: project.id,
          initiationId: initiation.id,
          automationConfig: input.automationConfig,
          requestedBy: metadata.actorId,
        },
        correlationId: metadata.correlationId,
        causationId: metadata.causationId,
        idempotencyKey: `automation-requested:${project.id}`,
        actorId: metadata.actorId,
        actorType: metadata.actorType,
      });

      return {
        success: true,
        data: {
          projectId: project.id,
          initiationId: initiation.id,
          automationStatus: 'REQUESTED',
          correlationId: metadata.correlationId,
        },
        correlationId: metadata.correlationId,
        occurredAt: new Date(),
      };
    });
  }
}
