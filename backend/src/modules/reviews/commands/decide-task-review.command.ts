// src/modules/reviews/commands/decide-task-review.command.ts
import type { CommandDefinition } from '../../../common/commands/command.interface';
import type { CommandHandlerFn } from '../../../common/commands/command.interface';
import { ReviewDecision } from '../domain/review-states';

export const DECIDE_TASK_REVIEW_COMMAND = 'DecideTaskReviewCommand';
export const DECIDE_TASK_REVIEW_VERSION = '1.0';

export interface DecideTaskReviewInput {
  reviewId: string;
  decision: ReviewDecision;
  reviewerId: string;
  comment?: string;
  revisionInstructions?: string;
}

export interface DecideTaskReviewResult {
  reviewId: string;
  taskId: string;
  previousReviewStatus: string;
  newReviewStatus: string;
  newTaskStatus: string | null;
  revisionAttemptCreated: boolean;
  revisionAttemptId: string | null;
  correlationId: string;
  decidedAt: string;
}

export function createDecideTaskReviewDefinition(
  handler: CommandHandlerFn<DecideTaskReviewInput, DecideTaskReviewResult>,
): CommandDefinition<DecideTaskReviewInput, DecideTaskReviewResult> {
  return {
    commandType: DECIDE_TASK_REVIEW_COMMAND,
    version: DECIDE_TASK_REVIEW_VERSION,
    handler,
    // Idempotency: same reviewId + same decision replays the same authoritative result.
    // Different decision under same reviewId is treated as a fresh attempt and will
    // be rejected by the handler via optimistic concurrency.
    buildIdempotencyKey: (input) =>
      `decide-task-review:${input.reviewId}:${input.decision}`,
    buildRequestHash: (input) => JSON.stringify(input),
  };
}
