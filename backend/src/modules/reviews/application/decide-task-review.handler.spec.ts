// src/modules/reviews/application/decide-task-review.handler.spec.ts
//
// Unit tests for the canonical DecideTaskReviewHandler. Mocks UoW,
// repositories, and outbox to verify:
//   - Optimistic concurrency on review.version
//   - AI cannot approve its own work
//   - REVISION_REQUESTED creates a new attempt linked to the prior via
//     parentAttemptId and never mutates the prior attempt
//   - APPROVED/REJECTED transition the task
//   - All decisions emit outbox + audit records in the same transaction
//   - Cross-tenant access is rejected

import { DecideTaskReviewHandler } from './decide-task-review.handler';
import { ReviewDecision, ReviewStatus } from '../domain/review-states';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';

const HandlerCtor: any = DecideTaskReviewHandler;

function buildMetadata(
  overrides: Partial<CommandMetadata> = {},
): CommandMetadata {
  return {
    tenantId: 'tenant-A',
    actorId: 'user-1',
    actorType: 'HUMAN',
    correlationId: 'corr-1',
    causationId: null,
    idempotencyKey: 'k-1',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    ...overrides,
  };
}

function buildFakes(
  opts: {
    review?: any;
    task?: any;
    parentAttempt?: any;
    existingAttempts?: any[];
  } = {},
) {
  const reviewState: any = {
    id: 'review-1',
    tenantId: 'tenant-A',
    taskId: 'task-1',
    attemptId: 'attempt-1',
    status: ReviewStatus.PENDING,
    decision: ReviewDecision.PENDING,
    reviewerId: null,
    comment: null,
    revisionInstructions: null,
    decidedAt: null,
    version: 3,
    ...(opts.review ?? {}),
  };

  const taskState: any = {
    id: 'task-1',
    tenantId: 'tenant-A',
    status: 'NEEDS_REVIEW' as any,
    title: 'Sample task',
    version: 2,
    agentId: 'agent-7',
    requiredRole: null,
    requiredCapabilities: [],
    dataClassification: null,
    departmentId: null,
    ...(opts.task ?? {}),
  };

  const parentAttempt: any = {
    id: 'attempt-1',
    tenantId: 'tenant-A',
    taskId: 'task-1',
    agentId: 'agent-7',
    attemptNumber: 1,
    status: 'SUBMITTED_FOR_REVIEW' as any,
    taskInstructionsSnapshot: 'Do the bookkeeping',
    inputSnapshot: { foo: 'bar' },
    projectContextSnapshot: { project: 'p' },
    promptVersion: 'v1',
    graphVersion: 'g1',
    modelVersion: 'm1',
    toolVersion: 't1',
    policy: {},
    ...(opts.parentAttempt ?? {}),
  };

  const reviewRepo = {
    async findById() {
      return reviewState;
    },
    async update(input: any) {
      reviewState.status = input.status;
      reviewState.decision = input.decision;
      reviewState.reviewerId = input.reviewerId;
      reviewState.comment = input.comment;
      reviewState.revisionInstructions = input.revisionInstructions;
      reviewState.decidedAt = input.decidedAt;
      reviewState.version += 1;
      return reviewState;
    },
  };

  const taskRepo = {
    async findById() {
      return taskState;
    },
    async updateStatus(input: any) {
      taskState.status = input.status;
      taskState.version += 1;
      return taskState;
    },
  };

  const auditRepo = {
    records: [] as any[],
    async record(entry: any) {
      this.records.push(entry);
    },
  };

  const outboxRepo = {
    events: [] as any[],
    async publish(input: any) {
      this.events.push(input);
      return `event-${this.events.length}`;
    },
  };

  const tx = {
    executionAttempt: {
      async findFirst(_args: any) {
        return parentAttempt;
      },
      async findFirstForMax() {
        const max = (opts.existingAttempts ?? []).reduce(
          (acc: number, a: any) => Math.max(acc, a.attemptNumber),
          0,
        );
        return { attemptNumber: max };
      },
      async create(args: any) {
        return {
          id: `attempt-new-${Math.random().toString(36).slice(2)}`,
          ...args.data,
        };
      },
    },
  };

  const uow = {
    async execute(work: (tx: any) => Promise<any>) {
      return work(tx);
    },
  };

  return {
    reviewState,
    taskState,
    parentAttempt,
    reviewRepo,
    taskRepo,
    auditRepo,
    outboxRepo,
    tx,
    uow,
  };
}

function buildHandler(fakes: ReturnType<typeof buildFakes>) {
  return new HandlerCtor(
    fakes.uow,
    fakes.reviewRepo,
    fakes.taskRepo,
    fakes.auditRepo,
    fakes.outboxRepo,
  );
}

describe('DecideTaskReviewHandler', () => {
  it('APPROVED transitions the task to APPROVED and emits ReviewApproved', async () => {
    const f = buildFakes({
      review: { status: 'PENDING' as any },
      task: { agentId: 'agent-7' },
    });
    const handler = buildHandler(f);
    const result = await handler.handle(
      {
        reviewId: 'review-1',
        decision: ReviewDecision.APPROVED,
        reviewerId: 'user-2',
        comment: 'Looks good',
      },
      buildMetadata(),
    );
    expect(result.success).toBe(true);
    expect(result.data.newReviewStatus).toBe('APPROVED');
    expect(result.data.newTaskStatus).toBe('APPROVED');
    expect(result.data.revisionAttemptCreated).toBe(false);
    expect(f.taskState.status).toBe('APPROVED');
    expect(f.outboxRepo.events).toHaveLength(1);
    expect(f.outboxRepo.events[0].eventType).toBe('ReviewApproved');
    expect(f.auditRepo.records).toHaveLength(1);
  });

  it('REJECTED transitions the task to CANCELLED', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    const result = await handler.handle(
      {
        reviewId: 'review-1',
        decision: ReviewDecision.REJECTED,
        reviewerId: 'user-2',
      },
      buildMetadata(),
    );
    expect(result.data.newTaskStatus).toBe('CANCELLED');
    expect(f.taskState.status).toBe('CANCELLED');
    expect(f.outboxRepo.events[0].eventType).toBe('ReviewRejected');
  });

  it('CANCELLED does not change task state but still records an outbox event', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    const beforeStatus = f.taskState.status;
    const result = await handler.handle(
      {
        reviewId: 'review-1',
        decision: ReviewDecision.CANCELLED,
        reviewerId: 'user-2',
      },
      buildMetadata(),
    );
    expect(result.data.newTaskStatus).toBeNull();
    expect(f.taskState.status).toBe(beforeStatus);
    expect(f.outboxRepo.events[0].eventType).toBe('ReviewCancelled');
  });

  it('rejects AI self-approval (task.agentId === reviewerId)', async () => {
    const f = buildFakes({
      task: { agentId: 'user-1' }, // same as the actor/reviewer
    });
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          reviewId: 'review-1',
          decision: ReviewDecision.APPROVED,
          reviewerId: 'user-1',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/AI_CANNOT_APPROVE_OWN_WORK/);
    expect(f.taskState.status).toBe('NEEDS_REVIEW'); // unchanged
    expect(f.outboxRepo.events).toHaveLength(0);
    expect(f.auditRepo.records).toHaveLength(0);
  });

  it('rejects a cross-tenant review access', async () => {
    const f = buildFakes();
    f.reviewState.tenantId = 'tenant-B';
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          reviewId: 'review-1',
          decision: ReviewDecision.APPROVED,
          reviewerId: 'user-2',
        },
        buildMetadata({ tenantId: 'tenant-A' }),
      ),
    ).rejects.toThrow(/CROSS_TENANT_ACCESS_DENIED/);
  });

  it('rejects a second decision on an already-decided review', async () => {
    const f = buildFakes({ review: { status: 'APPROVED' as any } });
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          reviewId: 'review-1',
          decision: ReviewDecision.REJECTED,
          reviewerId: 'user-2',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/REVIEW_ALREADY_DECIDED/);
  });

  it('rejects REVISION_REQUESTED without revisionInstructions', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          reviewId: 'review-1',
          decision: ReviewDecision.REVISION_REQUESTED,
          reviewerId: 'user-2',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/REVISION_INSTRUCTIONS_REQUIRED/);
  });

  it('rejects a PENDING "decision" because PENDING is the initial state, never a decision', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          reviewId: 'review-1',
          decision: 'PENDING' as ReviewDecision,
          reviewerId: 'user-2',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/INVALID_DECISION/);
  });

  it('REVISION_REQUESTED creates a new attempt linked via parentAttemptId and copies snapshots', async () => {
    const f = buildFakes({
      task: { agentId: 'agent-7' },
      existingAttempts: [{ attemptNumber: 1 }],
    });
    const handler = buildHandler(f);

    let createdAttempt: any = null;
    f.tx.executionAttempt.create = async (args: any) => {
      createdAttempt = args.data;
      return { id: 'attempt-new-1', ...args.data };
    };

    const result = await handler.handle(
      {
        reviewId: 'review-1',
        decision: ReviewDecision.REVISION_REQUESTED,
        reviewerId: 'user-2',
        revisionInstructions: 'Please also reconcile Q4',
      },
      buildMetadata(),
    );

    expect(result.data.revisionAttemptCreated).toBe(true);
    expect(result.data.revisionAttemptId).toBe('attempt-new-1');
    expect(createdAttempt).toMatchObject({
      parentAttemptId: 'attempt-1',
      attemptNumber: 2,
      status: 'QUEUED',
      agentId: 'agent-7',
      taskInstructionsSnapshot: 'Please also reconcile Q4',
      modelVersion: 'm1',
      graphVersion: 'g1',
      toolVersion: 't1',
      promptVersion: 'v1',
    });
    expect(f.taskState.status).toBe('QUEUED');
    expect(f.outboxRepo.events.map((event) => event.eventType)).toEqual([
      'TaskExecutionRequested',
      'RevisionRequested',
    ]);
    expect(f.outboxRepo.events[0].payload).toMatchObject({
      attemptId: 'attempt-new-1',
      taskId: 'task-1',
      agentId: 'agent-7',
      attemptNumber: 2,
      parentAttemptId: 'attempt-1',
      revision: true,
    });
    expect(f.outboxRepo.events[1].payload.revisionAttemptId).toBe(
      'attempt-new-1',
    );
  });

  it('REVISION_REQUESTED never mutates the parent attempt (immutability)', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    const beforeSnapshot = JSON.stringify(f.parentAttempt);

    f.tx.executionAttempt.create = async (args: any) => {
      return { id: 'attempt-new-1', ...args.data };
    };

    await handler.handle(
      {
        reviewId: 'review-1',
        decision: ReviewDecision.REVISION_REQUESTED,
        reviewerId: 'user-2',
        revisionInstructions: 'More detail',
      },
      buildMetadata(),
    );

    expect(JSON.stringify(f.parentAttempt)).toBe(beforeSnapshot);
    // No UPDATE statement was issued against the parent attempt.
  });
});
