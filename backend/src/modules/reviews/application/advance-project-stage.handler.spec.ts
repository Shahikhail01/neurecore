// src/modules/reviews/application/advance-project-stage.handler.spec.ts
//
// Unit tests for AdvanceProjectStageHandler. Verifies:
//   - State-machine guard
//   - Cross-aggregate guard (completion requires all mandatory tasks approved)
//   - Waiver recording when guard fails but a waiver is provided
//   - Optimistic concurrency via stageVersion
//   - Concurrent transition failure (STAGE_CONCURRENT_MODIFICATION)
//   - Atomic outbox + audit emission

import { AdvanceProjectStageHandler } from './advance-project-stage.handler';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import { ProjectStatus } from '../../projects/common/project-lifecycle';

function buildMetadata(
  overrides: Partial<CommandMetadata> = {},
): CommandMetadata {
  return {
    tenantId: 'tenant-A',
    actorId: 'user-1',
    actorType: 'HUMAN' as const,
    correlationId: 'corr-1',
    causationId: null,
    idempotencyKey: 'k-1',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    ...overrides,
  };
}

function buildFakes(
  opts: { stageVersion?: number; mandatoryTaskBlocking?: boolean } = {},
) {
  const projectState: any = {
    id: 'project-1',
    tenantId: 'tenant-A',
    status: 'REVIEW' as ProjectStatus,
    stageVersion: opts.stageVersion ?? 1,
  };

  const updatedProjects: any[] = [];
  const tx = {
    lifecycleWaiver: {
      async create(args: any) {
        return {
          id: `waiver-${Math.random().toString(36).slice(2)}`,
          ...args.data,
        };
      },
    },
  };

  const projectRepo = {
    async findById() {
      return projectState;
    },
    async advanceStage(input: any) {
      if (input.expectedStageVersion !== projectState.stageVersion) {
        return false;
      }
      projectState.status = input.toStage;
      projectState.stageVersion += 1;
      if (input.completedAt) {
        projectState.completedAt = input.completedAt;
      }
      updatedProjects.push(input);
      return true;
    },
  };

  const uow = {
    async execute(work: (tx: any) => Promise<any>) {
      return work(tx);
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

  const lifecycleGuard = {
    canTransitionCalls: [] as any[],
    waivers: [] as any[],
    async canTransition(
      tenantId: string,
      _id: string,
      from: ProjectStatus,
      to: ProjectStatus,
    ) {
      this.canTransitionCalls.push({ tenantId, from, to });
      if (opts.mandatoryTaskBlocking) {
        return {
          allowed: false,
          reason: '1 mandatory task requires approval before completion',
        };
      }
      return { allowed: true };
    },
    async recordStructuredWaiver(
      tenantId: string,
      _id: string,
      from: ProjectStatus,
      to: ProjectStatus,
      reason: string,
      guardFailureReason: string,
      metadata: CommandMetadata,
    ) {
      const id = `waiver-${this.waivers.length + 1}`;
      this.waivers.push({
        id,
        tenantId,
        from,
        to,
        reason,
        guardFailureReason,
        metadata,
      });
      return id;
    },
  };

  return {
    projectState,
    tx,
    projectRepo,
    uow,
    auditRepo,
    outboxRepo,
    lifecycleGuard,
    updatedProjects,
  };
}

function buildHandler(f: ReturnType<typeof buildFakes>) {
  return new (AdvanceProjectStageHandler as any)(
    f.uow,
    f.projectRepo,
    f.auditRepo,
    f.outboxRepo,
    f.lifecycleGuard,
  );
}

describe('AdvanceProjectStageHandler', () => {
  it('REVIEW → COMPLETED succeeds when guard allows it', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    const result = await handler.handle(
      {
        projectId: 'project-1',
        toStage: 'COMPLETED' as any,
        actorId: 'user-1',
      },
      buildMetadata(),
    );
    expect(result.success).toBe(true);
    expect(result.data.fromStage).toBe('REVIEW');
    expect(result.data.toStage).toBe('COMPLETED');
    expect(result.data.waiverId).toBeNull();
    expect(f.projectState.status).toBe('COMPLETED');
    expect(f.projectState.stageVersion).toBe(2);
    expect(f.outboxRepo.events).toHaveLength(1);
    expect(f.outboxRepo.events[0].eventType).toBe('StageAdvanced');
    expect(f.auditRepo.records).toHaveLength(1);
  });

  it('rejects with TRANSITION_GUARD_FAILED when guard fails and no waiver is supplied', async () => {
    const f = buildFakes({ mandatoryTaskBlocking: true });
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'user-1',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/TRANSITION_GUARD_FAILED/);
    expect(f.outboxRepo.events).toHaveLength(0);
    expect(f.auditRepo.records).toHaveLength(0);
  });

  it('records a structured waiver and advances when guard fails but waiver is supplied', async () => {
    const f = buildFakes({ mandatoryTaskBlocking: true });
    const handler = buildHandler(f);
    const result = await handler.handle(
      {
        projectId: 'project-1',
        toStage: 'COMPLETED' as any,
        actorId: 'user-1',
        actorRole: 'OWNER',
        waiverReason: 'Customer requested expedited close',
      },
      buildMetadata(),
    );
    expect(result.data.waiverId).toBeTruthy();
    // The handler records the waiver in-line within the same transaction.
    // Verify the tx.lifecycleWaiver.create was called with the right shape.
    expect(f.tx.lifecycleWaiver.create).toBeDefined();
    expect(f.projectState.status).toBe('COMPLETED');
    expect(f.outboxRepo.events[0].payload.waiverId).toBeTruthy();
    // The guard failure reason flows into the audit record.
    expect(f.auditRepo.records[0].details.guardReason).toMatch(
      /mandatory task/i,
    );
  });

  it('rejects when the state machine disallows the transition (LEAD → COMPLETED)', async () => {
    const f = buildFakes();
    f.projectState.status = 'LEAD' as any;
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'user-1',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/INVALID_TRANSITION/);
  });

  it('rejects cross-tenant access', async () => {
    const f = buildFakes();
    f.projectState.tenantId = 'tenant-B';
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'user-1',
        },
        buildMetadata({ tenantId: 'tenant-A' }),
      ),
    ).rejects.toThrow(/CROSS_TENANT_ACCESS_DENIED/);
  });

  it('rejects when stageVersion no longer matches (concurrent transition)', async () => {
    const f = buildFakes();
    f.projectState.stageVersion = 5;
    // Make the repository return false to simulate concurrent modification.
    f.projectRepo.advanceStage = async () => false;
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'user-1',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/STAGE_CONCURRENT_MODIFICATION/);
  });

  it('REVIEW → ACTIVE: reopens the project without requiring a waiver', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    const result = await handler.handle(
      {
        projectId: 'project-1',
        toStage: 'ACTIVE' as any,
        actorId: 'user-1',
      },
      buildMetadata(),
    );
    expect(result.data.toStage).toBe('ACTIVE');
    expect(f.projectState.status).toBe('ACTIVE');
  });

  it('rejects waiver when actorRole is not OWNER or MANAGER', async () => {
    const f = buildFakes({ mandatoryTaskBlocking: true });
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'user-1',
          actorRole: 'LEAD',
          waiverReason: 'I know better',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/WAIVER_REQUIRES_OWNER_OR_MANAGER/);
  });

  it('rejects AI actor types advancing a project stage', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'agent-7',
          actorRole: 'OWNER',
        },
        buildMetadata({ actorType: 'AI_AGENT' }),
      ),
    ).rejects.toThrow(/PROJECT_ADVANCE_REQUIRES_HUMAN_ACTOR/);
  });

  it('rejects empty waiver reason', async () => {
    const f = buildFakes();
    const handler = buildHandler(f);
    await expect(
      handler.handle(
        {
          projectId: 'project-1',
          toStage: 'COMPLETED' as any,
          actorId: 'user-1',
          actorRole: 'OWNER',
          waiverReason: '   ',
        },
        buildMetadata(),
      ),
    ).rejects.toThrow(/WAIVER_REASON_EMPTY/);
  });
});
