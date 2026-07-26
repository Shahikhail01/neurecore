// src/modules/assignments/commands/release-assignment.command.ts
// Plan §6.2: "Define ties, no-match, assignment expiry, release,
// reassignment, and active-execution behavior."

import { CommandResult } from '../../../common/commands/command.interface';

export const RELEASE_ASSIGNMENT_COMMAND = 'ReleaseAssignmentCommand';
export const RELEASE_ASSIGNMENT_VERSION = '1.0';

export interface ReleaseAssignmentInput {
  tenantId: string;
  taskId: string;
  reason:
    | 'AGENT_OFFLINE'
    | 'AGENT_OVERLOADED'
    | 'TASK_CANCELLED'
    | 'TASK_REASSIGNED'
    | 'EXPIRED_SWEEP'
    | 'OPERATOR';
  releasedByActorId: string;
  releasedByActorType?: string;
  /**
   * Optional new agent to reassign to in the same transaction. When
   * provided, the release and the new assignment commit together.
   */
  reassignToAgentId?: string;
  reassignGeneration?: number;
  reassignRationale?: string;
  reassignManualOverride?: boolean;
  reassignOverrideActorId?: string;
  reassignOverrideActorType?: string;
  /**
   * Override the inherited `expiresAt` for the reassignment. When
   * omitted, the service defaults to the freshly assigned 8-hour TTL.
   */
  reassignExpiresInSeconds?: number;
}

export interface ReleaseAssignmentResult {
  releasedAssignmentId: string;
  taskId: string;
  reassignment?: {
    assignmentId: string;
    agentId: string;
    generation: number;
  };
}
