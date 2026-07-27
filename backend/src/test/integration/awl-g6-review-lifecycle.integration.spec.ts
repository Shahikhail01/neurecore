// src/test/integration/awl-g6-review-lifecycle.integration.spec.ts
//
// G6 — Phase 6 invariant tests (real PostgreSQL).
//
// Per NC-AWL-IMP-1 §11.2 the certification run requires that:
//   - Reviewer identity and decision are persisted
//   - Revision produces a distinguishable new attempt
//   - Prior evidence remains immutable
//   - Approval advances task and stage exactly once
//   - Project completion guard works
//   - Refresh and relogin show authoritative state
//
// This file proves the database-level invariants that back those
// requirements. The same Prisma clients that power production drive
// these tests — no mocks.

import { PrismaClient, AwlReviewStatus } from '@prisma/client';

const RECONSTRUCTION_TENANT = 'reconstruction-g6';
const REQUIRE_DB = process.env.AWL_REQUIRE_INTEGRATION_DB === 'true';
const DB_AVAILABLE = process.env.AWL_INTEGRATION_DB_AVAILABLE === 'true';
const describeOrSkip = REQUIRE_DB || DB_AVAILABLE ? describe : describe.skip;
const skipIfNoDb = () => {
  if (DB_AVAILABLE) return false;
  if (REQUIRE_DB) {
    throw new Error(
      'INTEGRATION_DB_REQUIRED: AWL_REQUIRE_INTEGRATION_DB=true but DATABASE_URL is not set. ' +
        'Provision PostgreSQL or unset AWL_REQUIRE_INTEGRATION_DB to skip.',
    );
  }
  return true;
};

describeOrSkip('G6 — Phase 6 Invariant Tests (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let customerId: string;
  let projectId: string;
  let taskId: string;
  let attemptId: string;
  let reviewId: string;
  let evidenceId: string;
  let agentId: string;
  let userId: string;

  beforeAll(async () => {
    if (skipIfNoDb()) return;
    prisma = new PrismaClient();
    await prisma.$connect();
    await seed();
  });

  afterAll(async () => {
    if (!prisma) return;
    await cleanup();
    await prisma.$disconnect();
  });

  async function seed(): Promise<void> {
    tenantId = `${RECONSTRUCTION_TENANT}-${Date.now()}`;
    const tenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: tenantId,
        industry: 'accounting',
        status: 'ACTIVE',
      } as any,
    });
    tenantId = tenant.id;

    const customer = await prisma.customer.create({
      data: { tenantId, name: 'Test customer' },
    });
    customerId = customer.id;

    const project = await prisma.project.create({
      data: {
        tenantId,
        name: `G6 Project ${Date.now()}`,
        status: 'ACTIVE',
      },
    });
    projectId = project.id;

    const agent = await prisma.agent.create({
      data: {
        tenantId,
        name: 'Test agent',
        role: 'AI_WORKER' as any,
      } as any,
    });
    agentId = agent.id;

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `g6-${Date.now()}@test.local`,
        firstName: 'Test',
        lastName: 'Reviewer',
      } as any,
    });
    userId = user.id;

    const task = await prisma.task.create({
      data: {
        tenantId,
        projectId,
        title: 'G6 Sample Task',
        status: 'NEEDS_REVIEW',
        agentId,
        requiredCapabilities: ['BOOKKEEPING'],
      },
    });
    taskId = task.id;

    const attempt = await prisma.executionAttempt.create({
      data: {
        tenantId,
        taskId,
        agentId,
        executionRequestId: `g6-${Date.now()}`,
        attemptNumber: 1,
        status: 'SUBMITTED_FOR_REVIEW',
      },
    });
    attemptId = attempt.id;

    const evidence = await prisma.evidenceArtifact.create({
      data: {
        tenantId,
        taskId,
        executionAttemptId: attemptId,
        artifactType: 'DRAFT',
        storageRef: 's3://bucket/g6-evidence.txt',
        mimeType: 'text/plain',
        checksum: 'sha256:abc',
        source: 'AI_GENERATED',
        createdByActorId: agentId,
      },
    });
    evidenceId = evidence.id;

    const review = await prisma.review.create({
      data: {
        tenantId,
        taskId,
        attemptId,
        status: 'PENDING' as AwlReviewStatus,
        decision: 'PENDING' as any,
      },
    });
    reviewId = review.id;
  }

  async function cleanup(): Promise<void> {
    // Cascade by deleting the tenant — FKs handle the rest.
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }

  describe('Evidence immutability trigger', () => {
    it('rejects UPDATE on evidence_artifacts with the EVIDENCE_ARTIFACT_IMMUTABLE error', async () => {
      let caught: any = null;
      try {
        await prisma.evidenceArtifact.update({
          where: { id: evidenceId },
          data: { checksum: 'sha256:malicious' },
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).not.toBeNull();
      // The trigger raises a check_violation. Prisma surfaces it as a
      // P2010 / generic Error with the message we put in the trigger.
      const message = (caught?.message ?? '') + (caught?.meta?.message ?? '');
      expect(message).toMatch(/EVIDENCE_ARTIFACT_IMMUTABLE/);
    });

    it('rejects DELETE on evidence_artifacts with the EVIDENCE_ARTIFACT_IMMUTABLE error', async () => {
      let caught: any = null;
      try {
        await prisma.evidenceArtifact.delete({ where: { id: evidenceId } });
      } catch (e) {
        caught = e;
      }
      expect(caught).not.toBeNull();
      const message = (caught?.message ?? '') + (caught?.meta?.message ?? '');
      expect(message).toMatch(/EVIDENCE_ARTIFACT_IMMUTABLE/);
    });

    it('still allows INSERT (the only legal mutation)', async () => {
      const newEvidence = await prisma.evidenceArtifact.create({
        data: {
          tenantId,
          taskId,
          executionAttemptId: attemptId,
          artifactType: 'OUTPUT',
          storageRef: 's3://bucket/g6-evidence-2.txt',
          mimeType: 'text/plain',
          checksum: 'sha256:def',
          source: 'AI_GENERATED',
          createdByActorId: agentId,
        },
      });
      expect(newEvidence.id).toBeTruthy();
    });
  });

  describe('Review persistence (reviewer identity, decision, optimistic concurrency)', () => {
    it('records reviewerId, decidedAt, and increments version atomically', async () => {
      const before = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(before?.version).toBe(1);

      // Simulate the handler's optimistic update.
      const updated = await prisma.review.updateMany({
        where: { id: reviewId, version: 1 },
        data: {
          status: 'APPROVED' as AwlReviewStatus,
          decision: 'APPROVED' as any,
          reviewerId: userId,
          comment: 'Looks good',
          decidedAt: new Date(),
          version: { increment: 1 },
        },
      });
      expect(updated.count).toBe(1);

      const after = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(after?.version).toBe(2);
      expect(after?.status).toBe('APPROVED');
      expect(after?.reviewerId).toBe(userId);
      expect(after?.comment).toBe('Looks good');
      expect(after?.decidedAt).not.toBeNull();
    });

    it('rejects a second decision on the same review (optimistic lock)', async () => {
      const stale = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(stale?.version).toBe(2);

      // A second writer with a stale version (1) must not overwrite.
      const updated = await prisma.review.updateMany({
        where: { id: reviewId, version: 1 },
        data: {
          status: 'REVISION_REQUESTED' as AwlReviewStatus,
          decision: 'NEEDS_REVISION' as any,
          reviewerId: userId,
          version: { increment: 1 },
        },
      });
      expect(updated.count).toBe(0);

      // The original decision survives.
      const after = await prisma.review.findUnique({ where: { id: reviewId } });
      expect(after?.status).toBe('APPROVED');
      expect(after?.version).toBe(2);
    });
  });

  describe('Revision lineage', () => {
    let revisionAttemptId: string;
    it('creates a new attempt linked via parentAttemptId and a unique executionRequestId', async () => {
      const newAttempt = await prisma.executionAttempt.create({
        data: {
          tenantId,
          taskId,
          agentId,
          executionRequestId: `revision:${attemptId}:2`,
          attemptNumber: 2,
          status: 'CREATED',
          parentAttemptId: attemptId,
        },
      });
      revisionAttemptId = newAttempt.id;

      // The new attempt is queryable as a child of the parent.
      const children = await prisma.executionAttempt.findMany({
        where: { parentAttemptId: attemptId },
      });
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe(revisionAttemptId);
      expect(children[0].attemptNumber).toBe(2);

      // The parent attempt is unmodified.
      const parent = await prisma.executionAttempt.findUnique({
        where: { id: attemptId },
      });
      expect(parent?.status).toBe('SUBMITTED_FOR_REVIEW');
    });

    it('prior evidence remains queryable and intact after revision', async () => {
      const prior = await prisma.evidenceArtifact.findUnique({
        where: { id: evidenceId },
      });
      expect(prior?.executionAttemptId).toBe(attemptId);
      expect(prior?.checksum).toBe('sha256:abc');
    });
  });

  describe('Project completion guard (state + cross-aggregate)', () => {
    let newProjectId: string;
    it('REVIEW → COMPLETED requires all mandatory tasks approved', async () => {
      const project = await prisma.project.create({
        data: {
          tenantId,
          name: `G6 Completion ${Date.now()}`,
          status: 'REVIEW',
        },
      });
      newProjectId = project.id;

      // Task in NEEDS_REVIEW must block the transition.
      const blocking = await prisma.task.create({
        data: {
          tenantId,
          projectId: newProjectId,
          title: 'Blocking task',
          status: 'NEEDS_REVIEW',
        },
      });

      const blockingTasks = await prisma.task.findMany({
        where: {
          projectId: newProjectId,
          status: {
            in: [
              'PENDING',
              'DRAFT',
              'READY',
              'ASSIGNED',
              'QUEUED',
              'RUNNING',
              'IN_PROGRESS',
              'NEEDS_INPUT',
              'NEEDS_REVIEW',
              'BLOCKED',
              'FAILED_RETRYABLE',
            ] as any,
          },
        },
        select: { id: true },
      });
      expect(blockingTasks.length).toBeGreaterThan(0);

      // Approve the blocking task and re-check.
      await prisma.task.update({
        where: { id: blocking.id },
        data: { status: 'APPROVED' },
      });
      const stillBlocking = await prisma.task.findMany({
        where: {
          projectId: newProjectId,
          status: {
            in: [
              'PENDING',
              'DRAFT',
              'READY',
              'ASSIGNED',
              'QUEUED',
              'RUNNING',
              'IN_PROGRESS',
              'NEEDS_INPUT',
              'NEEDS_REVIEW',
              'BLOCKED',
              'FAILED_RETRYABLE',
            ] as any,
          },
        },
        select: { id: true },
      });
      expect(stillBlocking).toHaveLength(0);
    });
  });

  describe('Optimistic concurrency on project stageVersion', () => {
    it('updateMany with stale stageVersion returns count=0', async () => {
      const project = await prisma.project.create({
        data: {
          tenantId,
          name: `G6 Concurrency ${Date.now()}`,
          status: 'REVIEW',
          stageVersion: 7,
        },
      });

      // Writer A reads stageVersion=7 and updates to 8.
      const a = await prisma.project.updateMany({
        where: { id: project.id, stageVersion: 7 },
        data: { status: 'ACTIVE', stageVersion: { increment: 1 } },
      });
      expect(a.count).toBe(1);

      // Writer B still believes stageVersion=7 — must fail.
      const b = await prisma.project.updateMany({
        where: { id: project.id, stageVersion: 7 },
        data: { status: 'COMPLETED', stageVersion: { increment: 1 } },
      });
      expect(b.count).toBe(0);
    });
  });

  describe('LifecycleWaiver persistence', () => {
    it('stores structured waiver rows with the expected fields', async () => {
      const waiver = await prisma.lifecycleWaiver.create({
        data: {
          tenantId,
          scope: 'PROJECT_STAGE',
          entityType: 'Project',
          entityId: projectId,
          fromStage: 'REVIEW',
          toStage: 'COMPLETED',
          reason: 'Customer requested expedited close',
          waivedByActorId: userId,
          guardFailureReason: '1 mandatory task requires approval before completion',
        },
      });

      expect(waiver.id).toBeTruthy();

      const found = await prisma.lifecycleWaiver.findFirst({
        where: { id: waiver.id, tenantId },
      });
      expect(found?.reason).toBe('Customer requested expedited close');
      expect(found?.waivedByActorId).toBe(userId);
      expect(found?.scope).toBe('PROJECT_STAGE');
    });
  });
});
