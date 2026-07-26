// src/modules/enterprise-initiation/enterprise-initiation.service.ts
import { Injectable } from '@nestjs/common';
import { CommandRegistry } from '../../common/commands/command.registry';
import { CommandMetadata } from '../../common/correlation/correlation.interface';
import { TenantFlagsService, FeatureFlag } from '../tenant-flags/tenant-flags.service';
import { ApproveInitiationInput, ApproveInitiationResult, APPROVE_INITIATION_COMMAND, APPROVE_INITIATION_VERSION } from './commands/approve-initiation.command';
import { CreateProjectFromInitiationInput, CreateProjectFromInitiationResult, CREATE_PROJECT_FROM_INITIATION_COMMAND, CREATE_PROJECT_FROM_INITIATION_VERSION } from './commands/create-project-from-initiation.command';

@Injectable()
export class EnterpriseInitiationService {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly tenantFlags: TenantFlagsService,
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
}
