// src/modules/enterprise-initiation/enterprise-initiation.module.ts
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { CommandRegistry } from '../../common/commands/command.registry';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { ApproveInitiationHandler } from './application/approve-initiation.handler';
import { CreateProjectFromInitiationHandler } from './application/create-project-from-initiation.handler';
import { EnterpriseInitiationController } from './enterprise-initiation.controller';
import { EnterpriseInitiationService } from './enterprise-initiation.service';

@Module({
  imports: [PersistenceModule],
  controllers: [EnterpriseInitiationController],
  providers: [
    EnterpriseInitiationService,
    ApproveInitiationHandler,
    CreateProjectFromInitiationHandler,
  ],
  exports: [EnterpriseInitiationService],
})
export class EnterpriseInitiationModule implements OnApplicationBootstrap {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly approveHandler: ApproveInitiationHandler,
    private readonly createProjectHandler: CreateProjectFromInitiationHandler,
  ) {}

  onApplicationBootstrap() {
    this.commandRegistry.register({
      commandType: 'ApproveEnterpriseInitiationCommand',
      version: '1.0',
      handler: (input, metadata) => this.approveHandler.handle(input as any, metadata),
      buildIdempotencyKey: (input: any) => `approve-initiation:${input.initiationId}`,
      buildRequestHash: (input: any) => JSON.stringify(input),
    });

    this.commandRegistry.register({
      commandType: 'CreateProjectFromInitiationCommand',
      version: '1.0',
      handler: (input, metadata) => this.createProjectHandler.handle(input as any, metadata),
      buildIdempotencyKey: (input: any) => `create-project-from-initiation:${input.initiationId}`,
      buildRequestHash: (input: any) => JSON.stringify(input),
    });
  }
}
