// src/test/unit/assignment.service.spec.ts
// Phase 4 / plan §6.2 — AssignmentService unit coverage.
//
// Exercises the full transactional contract:
//   - Eligibility filtering + scoring deterministic ordering
//   - Optimistic concurrency on task assignment
//   - Manual override records an audit row + emits outbox
//   - Reassignment in the same transaction
//   - Release path with optional reassignment
//   - Sweep expired releases
//   - Cross-tenant rejection and "no eligible agent" error

import { AssignmentService } from '../../modules/assignments/application/assignment.service';
import type { AssignTaskInput } from '../../modules/assignments/commands/assign-task.command';
import type { ReleaseAssignmentInput } from '../../modules/assignments/commands/release-assignment.command';
import { CommandMetadata } from '../../common/correlation/correlation.interface';

interface FakeTaskRepoRow {
  id: string;
  tenantId: string;
  status: string;
  title: string;
  version: number;
  agentId: string | null;
  requiredRole: string | null;
  requiredCapabilities: string[];
  dataClassification: string | null;
  departmentId: string | null;
}

interface FakeAgentRepoRow {
  id: string;
  tenantId: string;
  name: string;
  role: string | null;
  capabilities: string[];
  permissions: string[];
  maxConcurrency: number | null;
  availability: string;
  archived: boolean;
  dataClassification: string;
  departmentId: string | null;
}

interface FakeTaskAssignmentRow {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  generation: number;
  rationale: string;
  status: string;
  version: number;
  releasedAt: Date | null;
  releasedByActorId: string | null;
  releaseReason: string | null;
  expiresAt: Date | null;
}

interface AuditRow {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string;
  assignmentGeneration: number;
  previousAgentId: string | null;
  rationale: string;
  overrideByActorId: string;
  overrideByActorType: string;
  dataClassificationAtOverride: string | null;
  occurredAt: Date;
}

interface OutboxRow {
  eventType: string;
  payload: any;
  idempotencyKey: string;
  tenantId: string;
}

function buildTaskRepo(initial: FakeTaskRepoRow[]) {
  const rows = new Map<string, FakeTaskRepoRow>(
    initial.map((row) => [row.id, { ...row }]),
  );
  const updates: Array<{ id: string; status: string; agentId: string | null }> = [];
  return {
    rows,
    updates,
    get(id: string) {
      return rows.get(id);
    },
    snapshot() {
      return Array.from(rows.values());
    },
    // IAgentRepository surface used by AssignmentService
    async findById(tenantId: string, id: string) {
      const row = rows.get(id);
      return row && row.tenantId === tenantId
        ? {
            id: row.id,
            tenantId: row.tenantId,
            status: row.status,
            title: row.title,
            version: row.version,
            agentId: row.agentId,
            requiredRole: row.requiredRole,
            requiredCapabilities: row.requiredCapabilities,
            dataClassification: row.dataClassification,
            departmentId: row.departmentId,
          }
        : null;
    },
    async updateAssignment(input: { id: string; expectedVersion: number; agentId: string | null; status: string }) {
      const row = rows.get(input.id);
      if (!row) throw new Error('TASK_NOT_FOUND');
      if (row.version !== input.expectedVersion) {
        throw new Error('OPTIMISTIC_LOCK_FAILED');
      }
      row.version += 1;
      row.agentId = input.agentId;
      row.status = input.status;
      updates.push({ id: row.id, status: row.status, agentId: row.agentId });
      return {
        id: row.id,
        tenantId: row.tenantId,
        status: row.status,
        title: row.title,
        version: row.version,
        agentId: row.agentId,
        requiredRole: row.requiredRole,
        requiredCapabilities: row.requiredCapabilities,
        dataClassification: row.dataClassification,
        departmentId: row.departmentId,
      };
    },
    async updateStatus(input: { id: string; expectedVersion: number; status: string; agentId?: string | null }) {
      const row = rows.get(input.id);
      if (!row) throw new Error('TASK_NOT_FOUND');
      row.status = input.status;
      if (input.agentId !== undefined) row.agentId = input.agentId;
      return {
        id: row.id,
        tenantId: row.tenantId,
        status: row.status,
        title: row.title,
        version: row.version,
        agentId: row.agentId,
        requiredRole: row.requiredRole,
        requiredCapabilities: row.requiredCapabilities,
        dataClassification: row.dataClassification,
        departmentId: row.departmentId,
      };
    },
    async countActiveByAgent(agentId: string) {
      return Array.from(rows.values()).filter(
        (row) => row.agentId === agentId && (row.status === 'QUEUED' || row.status === 'IN_PROGRESS'),
      ).length;
    },
  };
}

function buildAgentRepo(agents: FakeAgentRepoRow[]) {
  let loadWorkloadsCalls = 0;
  const workloadsByAgent = new Map<
    string,
    {
      active: number;
      assigned: number;
      queued: number;
      inProgress: number;
      blocked: number;
      inflatedActive?: number;
      inflateOnCall?: number;
    }
  >();
  const perfByAgent = new Map<string, { total: number; success: number }>();
  return {
    list: agents,
    workloadsByAgent,
    perfByAgent,
    // IAgentRepository surface used by AssignmentService
    async findEligible(
      tenantId: string,
      filter: {
        departmentId?: string | null;
        role?: string | null;
        requiredCapabilities?: string[];
        dataClassification?: string;
      },
    ) {
      return agents
        .filter((a) => a.tenantId === tenantId && a.availability === 'AVAILABLE' && !a.archived)
        .filter((a) => (filter.role ? a.role === filter.role : true))
        .filter((a) => (filter.departmentId ? a.departmentId === filter.departmentId : true))
        .filter((a) => (filter.dataClassification ? a.dataClassification === filter.dataClassification : true))
        .filter((a) =>
          filter.requiredCapabilities && filter.requiredCapabilities.length > 0
            ? filter.requiredCapabilities.every((cap) => a.capabilities.includes(cap))
            : true,
        )
        .map((a) => ({
          id: a.id,
          tenantId: a.tenantId,
          name: a.name,
          role: a.role,
          capabilities: a.capabilities,
          permissions: a.permissions,
          maxConcurrency: a.maxConcurrency,
          availability: a.availability,
          archived: a.archived,
          dataClassification: a.dataClassification,
          departmentId: a.departmentId,
        }));
    },
    async findById(tenantId: string, id: string) {
      const a = agents.find((row) => row.id === id && row.tenantId === tenantId);
      return a
        ? {
            id: a.id,
            tenantId: a.tenantId,
            name: a.name,
            role: a.role,
            capabilities: a.capabilities,
            permissions: a.permissions,
            maxConcurrency: a.maxConcurrency,
            availability: a.availability,
            archived: a.archived,
            dataClassification: a.dataClassification,
            departmentId: a.departmentId,
          }
        : null;
    },
    async loadWorkloads(tenantId: string, agentIds: string[]) {
      // Increment a call counter so a test can make the second call
      // return inflated values simulating a concurrent assigner.
      loadWorkloadsCalls++;
      return agentIds
        .filter((id) => {
          const agent = agents.find((a) => a.id === id);
          return !!agent && agent.tenantId === tenantId;
        })
        .map((id) => {
          const w = workloadsByAgent.get(id) ?? {
            active: 0,
            assigned: 0,
            queued: 0,
            inProgress: 0,
            blocked: 0,
          };
          const useInflated =
            w.inflatedActive !== undefined &&
            w.inflateOnCall !== undefined &&
            loadWorkloadsCalls >= w.inflateOnCall;
          const activeCount = useInflated ? w.inflatedActive! : w.active;
          return {
            agentId: id,
            activeCount,
            assignedCount: useInflated ? w.inflatedActive! : w.assigned,
            inProgressCount: w.inProgress,
            queuedCount: w.queued,
            blockedCount: w.blocked,
          };
        });
    },
    async loadPerformance(tenantId: string, agentIds: string[]) {
      return agentIds
        .filter((id) => {
          const agent = agents.find((a) => a.id === id);
          return !!agent && agent.tenantId === tenantId;
        })
        .map((id) => {
          const perf = perfByAgent.get(id) ?? { total: 0, success: 0 };
          return {
            agentId: id,
            totalAttempts: perf.total,
            succeededAttempts: perf.success,
            successRate: perf.total === 0 ? 0 : (perf.success / perf.total) * 100,
          };
        });
    },
  };
}

function buildTaskAssignmentRepo() {
  const rows = new Map<string, FakeTaskAssignmentRow>();
  let nextNumericId = 1;
  return {
    rows,
    add(row: FakeTaskAssignmentRow) {
      rows.set(row.id, row);
    },
    list() {
      return Array.from(rows.values());
    },
    // ITaskAssignmentRepository surface
    async findByGeneration(tenantId: string, taskId: string, generation: number) {
      return (
        Array.from(rows.values()).find(
          (row) =>
            row.tenantId === tenantId &&
            row.taskId === taskId &&
            row.generation === generation,
        ) ?? null
      );
    },
    async findLatestActive(tenantId: string, taskId: string) {
      return (
        Array.from(rows.values())
          .filter(
            (row) =>
              row.tenantId === tenantId &&
              row.taskId === taskId &&
              row.status === 'ACTIVE',
          )
          .sort((a, b) => b.generation - a.generation)[0] ?? null
      );
    },
    async create(input: {
      tenantId: string;
      taskId: string;
      agentId: string;
      generation: number;
      rationale: string;
      status?: string;
      expiresAt?: Date | null;
    }) {
      const id = `assign-gen-${input.generation}-${nextNumericId++}`;
      const row: FakeTaskAssignmentRow = {
        id,
        tenantId: input.tenantId,
        taskId: input.taskId,
        agentId: input.agentId,
        generation: input.generation,
        rationale: input.rationale,
        status: input.status ?? 'ACTIVE',
        version: 1,
        releasedAt: null,
        releasedByActorId: null,
        releaseReason: null,
        expiresAt: input.expiresAt ?? null,
      };
      rows.set(row.id, row);
      return row;
    },
    async updateStatus(input: {
      id: string;
      expectedVersion: number;
      status: string;
      releasedAt?: Date | null;
      releasedByActorId?: string | null;
      releaseReason?: string | null;
    }) {
      const row = rows.get(input.id);
      if (!row) throw new Error('OPTIMISTIC_LOCK_FAILED');
      if (row.version !== input.expectedVersion) {
        throw new Error('OPTIMISTIC_LOCK_FAILED');
      }
      row.version += 1;
      row.status = input.status;
      if (input.releasedAt !== undefined) row.releasedAt = input.releasedAt;
      if (input.releasedByActorId !== undefined) row.releasedByActorId = input.releasedByActorId;
      if (input.releaseReason !== undefined) row.releaseReason = input.releaseReason;
      return row;
    },
    async releaseExpired(_now: Date) {
      const out = await this.releaseExpiredWithContext(_now);
      return out.length;
    },
    async releaseExpiredWithContext(_now: Date) {
      const released: any[] = [];
      for (const row of Array.from(rows.values())) {
        if (row.status === 'ACTIVE' && row.expiresAt && row.expiresAt <= _now) {
          row.status = 'EXPIRED';
          row.releasedAt = _now;
          row.releaseReason = 'assignment-expired';
          row.version += 1;
          released.push({ ...row });
        }
      }
      return released;
    },
    async recordOverrideAudit(input: {
      tenantId: string;
      taskId: string;
      agentId: string;
      assignmentGeneration: number;
      previousAgentId: string | null;
      rationale: string;
      overrideByActorId: string;
      overrideByActorType: string;
      dataClassificationAtOverride?: string | null;
    }) {
      void input;
      return {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenantId: input.tenantId,
        taskId: input.taskId,
        agentId: input.agentId,
        assignmentGeneration: input.assignmentGeneration,
        previousAgentId: input.previousAgentId,
        rationale: input.rationale,
        overrideByActorId: input.overrideByActorId,
        overrideByActorType: input.overrideByActorType,
        dataClassificationAtOverride: input.dataClassificationAtOverride ?? null,
        occurredAt: new Date(),
      };
    },
    async listOverrideAudits(tenantId: string, taskId: string, limit = 20) {
      void tenantId;
      void taskId;
      void limit;
      return [];
    },
  };
}

function buildOverrideAudits() {
  const rows: AuditRow[] = [];
  return {
    rows,
    add(row: AuditRow) {
      rows.push(row);
    },
    list() {
      return [...rows];
    },
  };
}

function buildOutbox() {
  const rows: OutboxRow[] = [];
  return {
    rows,
    add(row: OutboxRow) {
      rows.push(row);
    },
    list() {
      return [...rows];
    },
    // IOutboxRepository surface used by AssignmentService
    async publish(input: {
      tenantId: string;
      eventType: string;
      payload: any;
      idempotencyKey: string;
    }) {
      rows.push({
        eventType: input.eventType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        tenantId: input.tenantId,
      });
      return `event-${rows.length}`;
    },
  };
}

function buildUow(opts: {
  taskAssignment?: { rows: any[]; updates: any[] };
  task?: { rows: Map<string, any> };
} = {}) {
  let current: unknown = null;
  return {
    async execute<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const tx: any = {
        taskAssignment: {
          findMany: ({ where, take }: any) => {
            const rows = (opts.taskAssignment?.rows ?? []).filter((row) => {
              if (where?.status && row.status !== where.status) return false;
              if (where?.expiresAt?.lte && row.expiresAt > where.expiresAt) return false;
              return true;
            });
            return rows.slice(0, take ?? rows.length).map((r) => ({
              id: r.id,
              version: r.version,
              tenantId: r.tenantId,
              taskId: r.taskId,
              agentId: r.agentId,
              generation: r.generation,
              releasedAt: r.releasedAt,
            }));
          },
          updateMany: async ({ where, data }: any) => {
            const row = (opts.taskAssignment?.rows ?? []).find(
              (r) =>
                r.id === where.id &&
                r.version === where.version &&
                r.status === where.status,
            );
            if (!row) return { count: 0 };
            row.status = data.status;
            row.version = data.version.increment;
            if (data.releasedAt) row.releasedAt = data.releasedAt;
            if (data.releaseReason) row.releaseReason = data.releaseReason;
            return { count: 1 };
          },
        },
        task: {
          findFirst: ({ where, select }: any) => {
            const row = opts.task?.rows.get(where.id);
            if (!row || row.tenantId !== where.tenantId) return null;
            if (select) {
              const result: any = {};
              for (const key of Object.keys(select)) result[key] = row[key];
              return result;
            }
            return row;
          },
          updateMany: async ({ where, data }: any) => {
            const row = opts.task?.rows.get(where.id);
            if (!row || row.version !== where.version) return { count: 0 };
            for (const [key, value] of Object.entries(data)) row[key] = value;
            return { count: 1 };
          },
        },
      };
      current = tx;
      try {
        return await fn(current);
      } finally {
        current = null;
      }
    },
    getCurrent() {
      return current;
    },
  };
}

function buildAudit() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    record(entry: Record<string, unknown>) {
      rows.push(entry);
    },
  };
}

function buildService(opts: {
  taskRepo: ReturnType<typeof buildTaskRepo>;
  agentRepo: ReturnType<typeof buildAgentRepo>;
  taskAssignmentRepo: ReturnType<typeof buildTaskAssignmentRepo>;
  overrideAudits: ReturnType<typeof buildOverrideAudits>;
  outbox: ReturnType<typeof buildOutbox>;
  uow: ReturnType<typeof buildUow>;
  audit: ReturnType<typeof buildAudit>;
  autoAssignmentEnabled?: boolean;
}) {
  // Wire recordOverrideAudit → shared overrideAudits so tests can
  // assert on a single list.
  const original = opts.taskAssignmentRepo.recordOverrideAudit.bind(opts.taskAssignmentRepo);
  opts.taskAssignmentRepo.recordOverrideAudit = async (input: any) => {
    const r = await original(input);
    opts.overrideAudits.rows.push({
      id: r.id,
      tenantId: r.tenantId,
      taskId: r.taskId,
      agentId: r.agentId,
      assignmentGeneration: r.assignmentGeneration,
      previousAgentId: r.previousAgentId,
      rationale: r.rationale,
      overrideByActorId: r.overrideByActorId,
      overrideByActorType: r.overrideByActorType,
      dataClassificationAtOverride: r.dataClassificationAtOverride,
      occurredAt: r.occurredAt,
    });
    return r;
  };
  // Provide a tenant-flags stub. AUTO_ASSIGNMENT is on by default in
  // tests so the auto path is exercised. Override per-test via
  // `autoAssignmentEnabled: false` to exercise the disabled path.
  const tenantFlags = {
    async isEnabled(flag: string, _tenantId: string): Promise<boolean> {
      if (flag === 'AUTO_ASSIGNMENT') {
        return opts.autoAssignmentEnabled ?? true;
      }
      return true;
    },
  };
  return new AssignmentService(
    opts.uow as any,
    opts.taskRepo as any,
    opts.agentRepo as any,
    opts.taskAssignmentRepo as any,
    opts.audit as any,
    opts.outbox as any,
    tenantFlags as any,
  );
}

const metadata = (tenantId: string): CommandMetadata => ({
  tenantId,
  actorId: 'SYSTEM',
  actorType: 'SYSTEM',
  correlationId: `corr-${tenantId}-1`,
  causationId: null,
  schemaVersion: 1,
  occurredAt: new Date().toISOString(),
  idempotencyKey: `assign-${tenantId}`,
});

describe('AssignmentService (Phase 4)', () => {
  it('picks the eligible agent and emits an audit + outbox row', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'Categorize transactions',
        version: 1,
        agentId: null,
        requiredRole: 'STAFF_ACCOUNTANT',
        requiredCapabilities: ['data_entry'],
        dataClassification: 'INTERNAL',
        departmentId: 'dept-accounting',
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice (Staff)',
        role: 'STAFF_ACCOUNTANT',
        capabilities: ['data_entry'],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: 'dept-accounting',
      },
      {
        id: 'agent-B',
        tenantId: 'tnt-acme',
        name: 'Bob (Senior)',
        role: 'STAFF_ACCOUNTANT',
        capabilities: ['data_entry'],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: 'dept-accounting',
      },
    ]);
    agentRepo.workloadsByAgent.set('agent-A', { active: 0, assigned: 0, queued: 0, inProgress: 0, blocked: 0 });
    agentRepo.workloadsByAgent.set('agent-B', { active: 3, assigned: 0, queued: 3, inProgress: 0, blocked: 0 });
    agentRepo.perfByAgent.set('agent-A', { total: 10, success: 9 });
    agentRepo.perfByAgent.set('agent-B', { total: 10, success: 5 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();

    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });
    const input: AssignTaskInput = {
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      requiredRole: 'STAFF_ACCOUNTANT',
      requiredCapabilities: ['data_entry'],
      departmentId: 'dept-accounting',
    };
    const result = await service.executeAssign(input, metadata('tnt-acme'));

    expect(result.success).toBe(true);
    expect(result.data?.agentId).toBe('agent-A');
    expect(result.data?.generation).toBe(1);
    expect(result.data?.manualOverride).toBe(false);
    expect(result.data?.policyVersion).toBe('1.0');
    expect(taskAssignmentRepo.list().length).toBe(1);
    expect(taskRepo.get('task-1')?.agentId).toBe('agent-A');
    expect(taskRepo.get('task-1')?.status).toBe('ASSIGNED');
    expect(taskRepo.get('task-1')?.version).toBe(2);
    expect(outbox.list().length).toBe(1);
    expect(outbox.list()[0].eventType).toBe('TaskAssigned');
    expect(outbox.list()[0].idempotencyKey).toBe('task-assigned:task-1:1');
    expect(audit.rows.length).toBe(1);
    expect(audit.rows[0].action).toBe('TASK_AUTO_ASSIGNED');
    expect(overrideAudits.list().length).toBe(0);
  });

  it('records override audit + emits TaskAssigned outbox when manualOverrideRationale is provided', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice',
        role: null,
        capabilities: [],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    agentRepo.workloadsByAgent.set('agent-A', { active: 0, assigned: 0, queued: 0, inProgress: 0, blocked: 0 });
    agentRepo.perfByAgent.set('agent-A', { total: 0, success: 0 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();

    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });
    const result = await service.executeAssign(
      {
        tenantId: 'tnt-acme',
        taskId: 'task-1',
        agentId: 'agent-A',
        manualOverrideRationale: 'Customer escalation requires VIP routing.',
      },
      metadata('tnt-acme'),
    );

    expect(result.success).toBe(true);
    expect(result.data?.manualOverride).toBe(true);
    expect(overrideAudits.list().length).toBe(1);
    expect(overrideAudits.list()[0].overrideByActorId).toBe('SYSTEM');
    expect(overrideAudits.list()[0].rationale).toContain('VIP routing');
    expect(audit.rows[0].action).toBe('TASK_ASSIGNMENT_OVERRIDDEN');
  });

  it('throws NO_ELIGIBLE_AI_EMPLOYEE when no agent matches', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: ['forbidden_capability'],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice',
        role: null,
        capabilities: [],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    agentRepo.workloadsByAgent.set('agent-A', { active: 0, assigned: 0, queued: 0, inProgress: 0, blocked: 0 });
    agentRepo.perfByAgent.set('agent-A', { total: 0, success: 0 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    await expect(
      service.executeAssign(
        {
          tenantId: 'tnt-acme',
          taskId: 'task-1',
          requiredCapabilities: ['forbidden_capability'],
        },
        metadata('tnt-acme'),
      ),
    ).rejects.toThrow('NO_ELIGIBLE_AI_EMPLOYEE');
  });

  it('rejects cross-tenant assignment attempts', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    // The tenant-scoped findById returns null for cross-tenant requests,
    // so the canonical-fail-fast is TASK_NOT_FOUND. The manual override
    // path is the only one that could cross, but it goes through the
    // same findById. Either error is acceptable — we just verify it
    // doesn't silently succeed.
    await expect(
      service.executeAssign(
        {
          tenantId: 'tnt-other',
          taskId: 'task-1',
          agentId: 'agent-A',
          manualOverrideRationale: 'tenant boundary',
        },
        metadata('tnt-other'),
      ),
    ).rejects.toThrow(/TASK_NOT_FOUND|CROSS_TENANT_ACCESS_DENIED/);
  });

  it('releases an assignment and emits TaskAssignmentReleased', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'ASSIGNED',
        title: 'T',
        version: 2,
        agentId: 'agent-A',
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    taskAssignmentRepo.add({
      id: 'assign-1',
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      agentId: 'agent-A',
      generation: 1,
      rationale: 'previous',
      status: 'ACTIVE',
      version: 1,
      releasedAt: null,
      releasedByActorId: null,
      releaseReason: null,
      expiresAt: null,
    });
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    const input: ReleaseAssignmentInput = {
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      reason: 'AGENT_OFFLINE',
      releasedByActorId: 'usr-admin',
    };
    const result = await service.executeRelease(input, metadata('tnt-acme'));

    expect(result.success).toBe(true);
    expect(result.data?.reassignment).toBeUndefined();
    expect(taskAssignmentRepo.list()[0].status).toBe('RELEASED');
    expect(taskAssignmentRepo.list()[0].releaseReason).toBe('AGENT_OFFLINE');
    expect(taskRepo.get('task-1')?.agentId).toBe(null);
    expect(taskRepo.get('task-1')?.status).toBe('READY');
    expect(outbox.list()[0].eventType).toBe('TaskAssignmentReleased');
    expect(audit.rows[0].action).toBe('TASK_ASSIGNMENT_RELEASED');
  });

  it('release + reassign records a new generation atomically', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'ASSIGNED',
        title: 'T',
        version: 2,
        agentId: 'agent-A',
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-B',
        tenantId: 'tnt-acme',
        name: 'Bob (Staff)',
        role: 'STAFF_ACCOUNTANT',
        capabilities: ['data_entry'],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: 'dept-accounting',
      },
    ]);
    agentRepo.workloadsByAgent.set('agent-B', {
      active: 0,
      assigned: 0,
      queued: 0,
      inProgress: 0,
      blocked: 0,
    });
    agentRepo.perfByAgent.set('agent-B', { total: 0, success: 0 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    taskAssignmentRepo.add({
      id: 'assign-1',
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      agentId: 'agent-A',
      generation: 1,
      rationale: 'previous',
      status: 'ACTIVE',
      version: 1,
      releasedAt: null,
      releasedByActorId: null,
      releaseReason: null,
      expiresAt: null,
    });
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    const result = await service.executeRelease(
      {
        tenantId: 'tnt-acme',
        taskId: 'task-1',
        reason: 'AGENT_OVERLOADED',
        releasedByActorId: 'usr-admin',
        reassignToAgentId: 'agent-B',
        reassignGeneration: 2,
        reassignRationale: 'manual reassignment to free-capacity agent',
        reassignManualOverride: true,
        reassignOverrideActorId: 'usr-admin',
        reassignOverrideActorType: 'HUMAN',
      },
      metadata('tnt-acme'),
    );

    expect(result.success).toBe(true);
    expect(result.data?.reassignment?.agentId).toBe('agent-B');
    expect(result.data?.reassignment?.generation).toBe(2);
    const rows = taskAssignmentRepo.list();
    expect(rows.length).toBe(2);
    expect(rows.find((r) => r.id === 'assign-1')?.status).toBe('RELEASED');
    expect(rows.find((r) => r.id !== 'assign-1')?.agentId).toBe('agent-B');
    expect(taskRepo.get('task-1')?.agentId).toBe('agent-B');
    expect(taskRepo.get('task-1')?.status).toBe('ASSIGNED');
    expect(overrideAudits.list().length).toBe(1);
    expect(overrideAudits.list()[0].previousAgentId).toBe('agent-A');
    expect(outbox.list().length).toBe(1);
    expect(outbox.list()[0].eventType).toBe('TaskAssigned');
  });

  it('sweepExpiredReleases marks expired ACTIVE rows as EXPIRED', async () => {
    const taskRepo = buildTaskRepo([]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const pastExpiry = new Date(Date.now() - 60000);
    taskAssignmentRepo.add({
      id: 'assign-expired',
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      agentId: 'agent-A',
      generation: 1,
      rationale: 'auto',
      status: 'ACTIVE',
      version: 1,
      releasedAt: null,
      releasedByActorId: null,
      releaseReason: null,
      expiresAt: pastExpiry,
    });
    taskAssignmentRepo.add({
      id: 'assign-active',
      tenantId: 'tnt-acme',
      taskId: 'task-2',
      agentId: 'agent-B',
      generation: 1,
      rationale: 'auto',
      status: 'ACTIVE',
      version: 1,
      releasedAt: null,
      releasedByActorId: null,
      releaseReason: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    const released = await service.sweepExpiredReleases();
    expect(released).toBe(1);
    expect(taskAssignmentRepo.list().find((r) => r.id === 'assign-expired')?.status).toBe('EXPIRED');
    expect(taskAssignmentRepo.list().find((r) => r.id === 'assign-active')?.status).toBe('ACTIVE');
  });

  it('sweepExpiredReleases emits TaskAssignmentReleased outbox + drops agent linkage', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'ASSIGNED',
        title: 'T',
        version: 2,
        agentId: 'agent-A',
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    taskAssignmentRepo.add({
      id: 'assign-expired',
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      agentId: 'agent-A',
      generation: 1,
      rationale: 'auto',
      status: 'ACTIVE',
      version: 1,
      releasedAt: null,
      releasedByActorId: null,
      releaseReason: null,
      expiresAt: new Date(Date.now() - 60000),
    });
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    await service.sweepExpiredReleases();

    const events = outbox.list();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('TaskAssignmentReleased');
    expect(events[0].payload.reason).toBe('EXPIRED_SWEEP');
    expect(events[0].payload.taskId).toBe('task-1');
    expect(events[0].payload.releasedAssignmentId).toBe('assign-expired');
    // Task linkage should be dropped; the task is reusable.
    expect(taskRepo.get('task-1')?.agentId).toBe(null);
  });

  it('rejects auto-assign when AUTO_ASSIGNMENT flag is disabled', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice',
        role: null,
        capabilities: [],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({
      taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit,
      autoAssignmentEnabled: false,
    });

    await expect(
      service.executeAssign(
        { tenantId: 'tnt-acme', taskId: 'task-1' },
        metadata('tnt-acme'),
      ),
    ).rejects.toThrow('AUTO_ASSIGNMENT_DISABLED');
  });

  it('allows manual override even when AUTO_ASSIGNMENT flag is disabled', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice',
        role: null,
        capabilities: [],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    agentRepo.workloadsByAgent.set('agent-A', { active: 0, assigned: 0, queued: 0, inProgress: 0, blocked: 0 });
    agentRepo.perfByAgent.set('agent-A', { total: 0, success: 0 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({
      taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit,
      autoAssignmentEnabled: false,
    });

    const result = await service.executeAssign(
      {
        tenantId: 'tnt-acme',
        taskId: 'task-1',
        agentId: 'agent-A',
        manualOverrideRationale: 'override despite flag',
      },
      metadata('tnt-acme'),
    );

    expect(result.success).toBe(true);
    expect(result.data?.manualOverride).toBe(true);
    expect(overrideAudits.list().length).toBe(1);
  });

  it('rejects auto-assign when chosen agent has reached maxConcurrency inside the transaction', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice',
        role: null,
        capabilities: ['data_entry'],
        permissions: [],
        maxConcurrency: 5,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    // Pre-filter: agent has 4 active tasks (under 5) so the eligibility scan
    // passes (first loadWorkloads call returns 4). Inside the transaction,
    // the in-transaction re-check sees the inflated value (call #2
    // returns 5) — should reject.
    agentRepo.workloadsByAgent.set('agent-A', {
      active: 4,
      assigned: 4,
      queued: 0,
      inProgress: 0,
      blocked: 0,
      inflatedActive: 5,
      inflateOnCall: 2,
    });
    agentRepo.perfByAgent.set('agent-A', { total: 0, success: 0 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    await expect(
      service.executeAssign(
        { tenantId: 'tnt-acme', taskId: 'task-1', requiredCapabilities: ['data_entry'] },
        metadata('tnt-acme'),
      ),
    ).rejects.toThrow('AGENT_AT_MAX_CONCURRENCY');
  });

  it('rejects manual override when override agent is at capacity', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'READY',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'Alice',
        role: null,
        capabilities: [],
        permissions: [],
        maxConcurrency: 2,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: null,
      },
    ]);
    // Override path only does one loadWorkloads call. Inflate to 2 on
    // the first call to simulate the agent already at capacity.
    agentRepo.workloadsByAgent.set('agent-A', {
      active: 2,
      assigned: 2,
      queued: 0,
      inProgress: 0,
      blocked: 0,
      inflatedActive: 2,
      inflateOnCall: 1,
    });
    agentRepo.perfByAgent.set('agent-A', { total: 0, success: 0 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    await expect(
      service.executeAssign(
        {
          tenantId: 'tnt-acme',
          taskId: 'task-1',
          agentId: 'agent-A',
          manualOverrideRationale: 'force override',
        },
        metadata('tnt-acme'),
      ),
    ).rejects.toThrow('AGENT_AT_MAX_CONCURRENCY');
  });

  it('dedup branch returns deduplicated:true without re-running scoring', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'ASSIGNED',
        title: 'T',
        version: 2,
        agentId: 'agent-A',
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    taskAssignmentRepo.add({
      id: 'assign-1',
      tenantId: 'tnt-acme',
      taskId: 'task-1',
      agentId: 'agent-A',
      generation: 1,
      rationale: 'auto-assignment by scoring policy 1.0',
      status: 'ACTIVE',
      version: 1,
      releasedAt: null,
      releasedByActorId: null,
      releaseReason: null,
      expiresAt: null,
    });
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    const result = await service.executeAssign(
      // Auto-path replay: no agentId, no manualOverrideRationale.
      { tenantId: 'tnt-acme', taskId: 'task-1' },
      metadata('tnt-acme'),
    );

    expect(result.success).toBe(true);
    expect(result.deduplicated).toBe(true);
    expect(result.data?.agentId).toBe('agent-A');
    // No new outbox, no new audit, no new assignment row.
    expect(outbox.list().length).toBe(0);
    expect(taskAssignmentRepo.list().length).toBe(1);
  });

  it('rejects dedup-replay only when no matching active assignment exists', async () => {
    // A COMPLETED task with a stale ACTIVE assignment row (rare but
    // possible if release was missed) must surface as "no active
    // assignment" rather than silently resurrecting the prior row.
    // Plan §6.5 — "Assignment persists consistently across views".
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'COMPLETED',
        title: 'T',
        version: 5,
        agentId: 'agent-A',
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    // No active assignment row → dedup doesn't fire → state machine
    // check rejects.
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    await expect(
      service.executeAssign(
        { tenantId: 'tnt-acme', taskId: 'task-1' },
        metadata('tnt-acme'),
      ),
    ).rejects.toThrow(/Invalid task transition|TASK_NOT_FOUND/);
  });

  it('findEligibleAgents ranks by deterministic score', async () => {
    const taskRepo = buildTaskRepo([]);
    const agentRepo = buildAgentRepo([
      {
        id: 'agent-A',
        tenantId: 'tnt-acme',
        name: 'A',
        role: 'SENIOR_ACCOUNTANT',
        capabilities: ['data_entry', 'review'],
        permissions: ['data_entry', 'review'],
        maxConcurrency: 10,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: 'dept-accounting',
      },
      {
        id: 'agent-B',
        tenantId: 'tnt-acme',
        name: 'B',
        role: 'SENIOR_ACCOUNTANT',
        capabilities: ['data_entry', 'review'],
        permissions: ['data_entry', 'review'],
        maxConcurrency: 10,
        availability: 'AVAILABLE',
        archived: false,
        dataClassification: 'INTERNAL',
        departmentId: 'dept-accounting',
      },
    ]);
    agentRepo.workloadsByAgent.set('agent-A', { active: 5, assigned: 0, queued: 0, inProgress: 5, blocked: 0 });
    agentRepo.workloadsByAgent.set('agent-B', { active: 1, assigned: 0, queued: 0, inProgress: 1, blocked: 0 });
    agentRepo.perfByAgent.set('agent-A', { total: 10, success: 6 });
    agentRepo.perfByAgent.set('agent-B', { total: 10, success: 10 });
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    const result = await service.findEligibleAgents({
      tenantId: 'tnt-acme',
      requiredRole: 'SENIOR_ACCOUNTANT',
      requiredCapabilities: ['data_entry', 'review'],
      departmentId: 'dept-accounting',
    });

    expect(result.length).toBe(2);
    expect(result[0].agentId).toBe('agent-B');
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[0].rationale).toContain('policy 1.0');
  });

  it('rejects assignment transition from non-READY/CANCELLED state', async () => {
    const taskRepo = buildTaskRepo([
      {
        id: 'task-1',
        tenantId: 'tnt-acme',
        status: 'COMPLETED',
        title: 'T',
        version: 1,
        agentId: null,
        requiredRole: null,
        requiredCapabilities: [],
        dataClassification: null,
        departmentId: null,
      },
    ]);
    const agentRepo = buildAgentRepo([]);
    const taskAssignmentRepo = buildTaskAssignmentRepo();
    const overrideAudits = buildOverrideAudits();
    const outbox = buildOutbox();
    const uow = buildUow();
    const audit = buildAudit();
    const service = buildService({ taskRepo, agentRepo, taskAssignmentRepo, overrideAudits, outbox, uow, audit });

    await expect(
      service.executeAssign(
        { tenantId: 'tnt-acme', taskId: 'task-1', agentId: 'agent-A', manualOverrideRationale: 'force' },
        metadata('tnt-acme'),
      ),
    ).rejects.toThrow(/Invalid task transition/);
  });
});