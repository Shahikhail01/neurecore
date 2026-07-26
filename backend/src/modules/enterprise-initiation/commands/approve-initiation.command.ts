// src/modules/enterprise-initiation/commands/approve-initiation.command.ts
import { CommandDefinition, CommandResult } from '../../../common/commands/command.interface';
import { InitiationStatus } from '../domain/initiation-states';

export const APPROVE_INITIATION_COMMAND = 'ApproveEnterpriseInitiationCommand';
export const APPROVE_INITIATION_VERSION = '1.0';

export interface ApproveInitiationInput {
  initiationId: string;
  approvedByActorId: string;
  approvalComment?: string;
}

export interface ApproveInitiationResult {
  initiationId: string;
  previousStatus: InitiationStatus;
  newStatus: InitiationStatus;
  automationRequested: boolean;
}

export function createApproveInitiationDefinition(
  handler: (input: ApproveInitiationInput, metadata: any) => Promise<CommandResult<ApproveInitiationResult>>,
): CommandDefinition<ApproveInitiationInput, ApproveInitiationResult> {
  return {
    commandType: APPROVE_INITIATION_COMMAND,
    version: APPROVE_INITIATION_VERSION,
    handler,
    buildIdempotencyKey: (input) => `approve-initiation:${input.initiationId}`,
    buildRequestHash: (input) => JSON.stringify(input),
  };
}
