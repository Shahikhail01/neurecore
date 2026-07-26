// src/modules/enterprise-initiation/commands/create-project-from-initiation.command.ts
import { CommandDefinition, CommandResult } from '../../../common/commands/command.interface';

export const CREATE_PROJECT_FROM_INITIATION_COMMAND = 'CreateProjectFromInitiationCommand';
export const CREATE_PROJECT_FROM_INITIATION_VERSION = '1.0';

export interface CreateProjectFromInitiationInput {
  initiationId: string;
  projectName: string;
  projectDescription?: string;
  customerId?: string;
  targetDate?: Date;
  automationConfig?: {
    generateGoals: boolean;
    generateTasks: boolean;
    autoAssign: boolean;
  };
}

export interface CreateProjectFromInitiationResult {
  projectId: string;
  initiationId: string;
  automationStatus: string;
  correlationId: string;
}

export function createCreateProjectFromInitiationDefinition(
  handler: (input: CreateProjectFromInitiationInput, metadata: any) => Promise<CommandResult<CreateProjectFromInitiationResult>>,
): CommandDefinition<CreateProjectFromInitiationInput, CreateProjectFromInitiationResult> {
  return {
    commandType: CREATE_PROJECT_FROM_INITIATION_COMMAND,
    version: CREATE_PROJECT_FROM_INITIATION_VERSION,
    handler,
    buildIdempotencyKey: (input) => `create-project-from-initiation:${input.initiationId}`,
    buildRequestHash: (input) => JSON.stringify(input),
  };
}
