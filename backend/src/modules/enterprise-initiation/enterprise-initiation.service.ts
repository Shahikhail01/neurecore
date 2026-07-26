// src/modules/enterprise-initiation/enterprise-initiation.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CommandRegistry } from '../../common/commands/command.registry';
import { CommandMetadata } from '../../common/correlation/correlation.interface';
import { TenantFlagsService, FeatureFlag } from '../tenant-flags/tenant-flags.service';
import { INITIATION_REPOSITORY, type IInitiationRepository } from './domain/ports/initiation-repository.port';
import { PROJECT_REPOSITORY, type IProjectRepository } from '../projects/domain/ports/project-repository.port';
import { ApproveInitiationInput, ApproveInitiationResult, APPROVE_INITIATION_COMMAND, APPROVE_INITIATION_VERSION } from './commands/approve-initiation.command';
import { CreateProjectFromInitiationInput, CreateProjectFromInitiationResult, CREATE_PROJECT_FROM_INITIATION_COMMAND, CREATE_PROJECT_FROM_INITIATION_VERSION } from './commands/create-project-from-initiation.command';

@Injectable()
export class EnterpriseInitiationService {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly tenantFlags: TenantFlagsService,
    @Inject(INITIATION_REPOSITORY) private readonly initiationRepo: IInitiationRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: IProjectRepository,
  ) {}

  async approveInitiation(
    input: ApproveInitiationInput,
    metadata: CommandMetadata,
  ): Promise<{ data?: ApproveInitiationResult; deduplicated: boolean }> {
    const isCanonical = await this.tenantFlags.isEnabled(
      FeatureFlag.CANONICAL_INITIATION,
      metadata.tenantId,
    );

    if (!isCanonical) {
      throw new Error('CANONICAL_INITIATION flag must be enabled for golden path');
    }

    const result = await this.commandRegistry.execute<ApproveInitiationInput, ApproveInitiationResult, undefined>(
      APPROVE_INITIATION_COMMAND,
      APPROVE_INITIATION_VERSION,
      input,
      metadata,
    );

    return { data: result.data, deduplicated: result.deduplicated ?? false };
  }

  async createProjectFromInitiation(
    input: CreateProjectFromInitiationInput,
    metadata: CommandMetadata,
  ): Promise<{ data?: CreateProjectFromInitiationResult; deduplicated: boolean }> {
    const isCanonical = await this.tenantFlags.isEnabled(
      FeatureFlag.CANONICAL_INITIATION,
      metadata.tenantId,
    );

    if (!isCanonical) {
      throw new Error('CANONICAL_INITIATION flag must be enabled for golden path');
    }

    const result = await this.commandRegistry.execute<CreateProjectFromInitiationInput, CreateProjectFromInitiationResult, undefined>(
      CREATE_PROJECT_FROM_INITIATION_COMMAND,
      CREATE_PROJECT_FROM_INITIATION_VERSION,
      input,
      metadata,
    );

    return { data: result.data, deduplicated: result.deduplicated ?? false };
  }

  async getInitiationStatus(initiationId: string, metadata: CommandMetadata) {
    const initiation = await this.initiationRepo.findById(metadata.tenantId, initiationId);
    if (!initiation) {
      throw new Error('INITIATION_NOT_FOUND');
    }

    const project = await this.projectRepo.findByInitiationId(metadata.tenantId, initiationId);

    return {
      initiationId: initiation.id,
      status: initiation.status,
      projectId: project?.id ?? initiation.projectId,
      projectStatus: project?.status ?? null,
      automationStatus: project ? 'REQUESTED_OR_COMPLETED' : 'NOT_REQUESTED',
      approvedAt: initiation.approvedAt,
      updatedAt: initiation.updatedAt,
      correlationId: metadata.correlationId,
    };
  }
}
