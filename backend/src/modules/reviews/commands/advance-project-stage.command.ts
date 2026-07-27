// src/modules/reviews/commands/advance-project-stage.command.ts
import type {
  CommandDefinition,
  CommandHandlerFn,
} from '../../../common/commands/command.interface';

export const ADVANCE_PROJECT_STAGE_COMMAND = 'AdvanceProjectStageCommand';
export const ADVANCE_PROJECT_STAGE_VERSION = '1.0';

export type TenantRole = 'OWNER' | 'MANAGER' | 'LEAD' | 'MEMBER' | 'VIEWER';

export interface AdvanceProjectStageInput {
  projectId: string;
  toStage:
    | 'LEAD'
    | 'PROPOSAL_SENT'
    | 'WON'
    | 'LOST'
    | 'ACTIVE'
    | 'ON_HOLD'
    | 'REVIEW'
    | 'COMPLETED'
    | 'ARCHIVED';
  actorId: string;
  /**
   * Tenant-scoped role of the actor. Required so the handler can
   * enforce "only OWNER / MANAGER may waive lifecycle guards" at the
   * command boundary (plan §8.2). The controller pulls this from the
   * validated JWT so it cannot be spoofed via request body.
   */
  actorRole?: TenantRole;
  waiverReason?: string;
}

export interface AdvanceProjectStageResult {
  projectId: string;
  fromStage: string;
  toStage: string;
  waiverId: string | null;
  correlationId: string;
  occurredAt: string;
}

export function createAdvanceProjectStageDefinition(
  handler: CommandHandlerFn<
    AdvanceProjectStageInput,
    AdvanceProjectStageResult
  >,
): CommandDefinition<AdvanceProjectStageInput, AdvanceProjectStageResult> {
  return {
    commandType: ADVANCE_PROJECT_STAGE_COMMAND,
    version: ADVANCE_PROJECT_STAGE_VERSION,
    handler,
    // Idempotency: (projectId, toStage). Repeated calls with the same target are
    // safe replays. A different target stage under the same project is a distinct
    // transition; we rely on optimistic concurrency in the handler.
    buildIdempotencyKey: (input) =>
      `advance-project-stage:${input.projectId}:${input.toStage}`,
    buildRequestHash: (input) => JSON.stringify(input),
  };
}
