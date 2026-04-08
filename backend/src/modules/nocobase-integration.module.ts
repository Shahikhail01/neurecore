/**
 * NocoDB Integration Module
 * Provides all services and repositories wired together
 * Location: src/modules/nocobase-integration.module.ts
 */

import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NocoDB } from 'nocodb/sdk';

// Domain
import {
  IAgentRepository,
  ITaskRepository,
  IApprovalRepository,
  IEventBus,
  ILogger,
} from '../domain/interfaces';

// Services
import { AgentService } from '../core/services/agent.service';
import { TaskService } from '../core/services/task.service';
import { ApprovalService } from '../core/services/approval.service';

// Repositories
import { NocoBaseAgentRepository } from '../core/repositories/agent.repository';
import { NocoBaseTaskRepository } from '../core/repositories/task.repository';
import { NocoBaseApprovalRepository } from '../core/repositories/approval.repository';

// Infrastructure
import { InMemoryEventBus } from '../infrastructure/event-bus';
import { NestJSLogger } from '../infrastructure/logger';
import { NocoBaseConfig } from '../config/nocobase.config';

/**
 * NestJS Module that provides all SOLID-compliant services and repositories
 * SOLID: Dependency Inversion - All dependencies injected by NestJS
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Configuration
    NocoBaseConfig,

    // Infrastructure
    {
      provide: IEventBus,
      useClass: InMemoryEventBus,
    },
    {
      provide: ILogger,
      useClass: NestJSLogger,
    },

    // NocoDB Client Provider
    {
      provide: NocoDB,
      useFactory: async (config: NocoBaseConfig) => {
        return config.initialize();
      },
      inject: [NocoBaseConfig],
    },

    // Repositories
    {
      provide: IAgentRepository,
      useClass: NocoBaseAgentRepository,
      inject: [NocoDB],
    },
    {
      provide: ITaskRepository,
      useClass: NocoBaseTaskRepository,
      inject: [NocoDB],
    },
    {
      provide: IApprovalRepository,
      useClass: NocoBaseApprovalRepository,
      inject: [NocoDB],
    },

    // Services
    {
      provide: AgentService,
      useFactory: (
        agentRepo: IAgentRepository,
        eventBus: IEventBus,
        logger: ILogger,
      ) => new AgentService(agentRepo, eventBus, logger),
      inject: [IAgentRepository, IEventBus, ILogger],
    },
    {
      provide: TaskService,
      useFactory: (
        taskRepo: ITaskRepository,
        agentRepo: IAgentRepository,
        eventBus: IEventBus,
        logger: ILogger,
      ) => new TaskService(taskRepo, agentRepo, eventBus, logger),
      inject: [ITaskRepository, IAgentRepository, IEventBus, ILogger],
    },
    {
      provide: ApprovalService,
      useFactory: (
        approvalRepo: IApprovalRepository,
        eventBus: IEventBus,
        logger: ILogger,
      ) => new ApprovalService(approvalRepo, eventBus, logger),
      inject: [IApprovalRepository, IEventBus, ILogger],
    },
  ],
  exports: [
    // Export services for use in other modules
    AgentService,
    TaskService,
    ApprovalService,
    IEventBus,
    ILogger,
    IAgentRepository,
    ITaskRepository,
    IApprovalRepository,
    NocoDB,
  ],
})
export class NocoBaseIntegrationModule implements OnModuleInit {
  constructor(private config: NocoBaseConfig) {}

  async onModuleInit(): Promise<void> {
    // Initialize NocoDB connection when module starts
    try {
      await this.config.initialize();
      console.log('✓ NocoDB Integration Module initialized successfully');
    } catch (error) {
      console.error('✗ Failed to initialize NocoDB Integration Module:', error);
      throw error;
    }
  }
}
