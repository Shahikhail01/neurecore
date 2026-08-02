/**
 * WorkRuntimeService — integration tests (Phase 4 §18 integration).
 *
 * Uses an in-memory fake WorkRun store + fake collaborators to exercise the
 * REAL WorkRuntimeService orchestration end-to-end: plan → govern → approval
 * pause → resume → execute → idempotency → tenant isolation → events.
 */

import { WorkRuntimeService } from './runtime/work-runtime.service';
import { ToolRegistry } from './registry/tool-registry.service';
import { ToolExecutor } from './executor/tool-executor.service';
import type {
  IWorkPlanner,
  RuntimeTool,
  WorkPlan,
} from './contracts/work-runtime.interface';

// ── Fake WorkRun repository (in-memory, tenant-scoped, optimistic version) ────
class FakeRepo {
  runs: any[] = [];
  steps: any[] = [];
  private rSeq = 0;
  private sSeq = 0;

  async createRun(input: any) {
    const run = {
      id: `run_${++this.rSeq}`,
      ...input,
      status: 'CREATED',
      currentStepIndex: 0,
      planVersion: 0,
      plan: null,
      summary: null,
      failureCode: null,
      failureReason: null,
      version: 0,
      createdAt: new Date(),
    };
    this.runs.push(run);
    return run;
  }
  async findRun(runId: string, tenantId: string) {
    return (
      this.runs.find((r) => r.id === runId && r.tenantId === tenantId) ?? null
    );
  }
  async listSteps(runId: string, tenantId: string) {
    return this.steps
      .filter((s) => s.runId === runId && s.tenantId === tenantId)
      .sort((a, b) => a.sequence - b.sequence);
  }
  async updateRun(
    runId: string,
    tenantId: string,
    expectedVersion: number,
    data: any,
  ) {
    const r = this.runs.find(
      (x) =>
        x.id === runId &&
        x.tenantId === tenantId &&
        x.version === expectedVersion,
    );
    if (!r) return false;
    Object.assign(r, data, { version: r.version + 1 });
    return true;
  }
  async createStep(input: any) {
    const s = {
      id: `step_${++this.sSeq}`,
      ...input,
      status: 'PENDING',
      attemptCount: 0,
      governanceDecision: null,
      governanceReason: null,
      policySource: null,
      approvalId: null,
      result: null,
      errorCode: null,
      errorMessage: null,
    };
    this.steps.push(s);
    return s;
  }
  async updateStep(stepId: string, tenantId: string, data: any) {
    const s = this.steps.find(
      (x) => x.id === stepId && x.tenantId === tenantId,
    );
    if (s) Object.assign(s, data);
  }
  async claimStep(stepId: string, tenantId: string, from: string[]) {
    const s = this.steps.find(
      (x) =>
        x.id === stepId && x.tenantId === tenantId && from.includes(x.status),
    );
    if (!s) return false;
    s.status = 'RUNNING';
    s.startedAt = new Date();
    return true;
  }
  async findStepByApproval(approvalId: string, tenantId: string) {
    return (
      this.steps.find(
        (s) => s.approvalId === approvalId && s.tenantId === tenantId,
      ) ?? null
    );
  }
  async findSucceededByIdempotencyKey(key: string, tenantId: string) {
    return (
      this.steps.find(
        (s) =>
          s.idempotencyKey === key &&
          s.tenantId === tenantId &&
          s.status === 'SUCCEEDED',
      ) ?? null
    );
  }
}

class FakeContextRepo {
  snapshots: any[] = [];
  async save(input: any) {
    const snapshot = { id: `ctx_${this.snapshots.length + 1}`, ...input };
    this.snapshots.push(snapshot);
    return snapshot;
  }
  async loadByRunId(tenantId: string, runId: string) {
    return (
      this.snapshots.find(
        (snapshot) =>
          snapshot.tenantId === tenantId && snapshot.workRunId === runId,
      ) ?? null
    );
  }
}

// ── Fakes for collaborators ───────────────────────────────────────────────────
class FakeContextPlane {
  constructor(
    private authority: number,
    private blocked = false,
  ) {}
  async assemble(params: any) {
    return {
      tenantId: params.tenantId,
      actorId: params.actorId,
      identity: {
        employeeId: params.actorId,
        role: 'OWNER',
        authorityLevel: this.authority,
      },
      authContext: {
        applicablePolicies: [],
        effectiveAuthority: this.blocked ? 0 : this.authority,
        effectiveAutonomy: this.authority,
        governanceBlocked: this.blocked,
      },
      capabilities: {
        projects: {
          provider: 'p',
          authorization: { access: 'FULL', policySource: 's' },
          data: { ok: true },
          fetchedAt: new Date().toISOString(),
          unavailable: false,
        },
      },
      assembledAt: new Date().toISOString(),
    };
  }
}
class FakePlanner implements IWorkPlanner {
  constructor(private readonly fixedPlan: WorkPlan) {}
  async plan() {
    return this.fixedPlan;
  }
}
class FakeApprovals {
  rows: any[] = [];
  private seq = 0;
  async create(input: any) {
    const a = { id: `appr_${++this.seq}`, ...input, status: 'PENDING' };
    this.rows.push(a);
    return a;
  }
  async findOne(id: string, tenantId: string) {
    const approval = this.rows.find(
      (row) => row.id === id && row.tenantId === tenantId,
    );
    if (!approval) throw new Error('not found');
    return approval;
  }
  approve(id: string) {
    const a = this.rows.find((x) => x.id === id);
    if (a) a.status = 'APPROVED';
  }
  reject(id: string) {
    const a = this.rows.find((x) => x.id === id);
    if (a) a.status = 'REJECTED';
  }
}
class FakeTransport {
  events: any[] = [];
  async publish(input: any) {
    this.events.push(input);
    return { eventId: `e${this.events.length}`, deduplicated: false };
  }
  registerConsumer() {}
  async getConsumerStatus() {
    return {
      consumerId: 'x',
      pending: 0,
      processing: 0,
      processed: 0,
      failed: 0,
      deadLettered: 0,
    };
  }
  async replayDeadLetter() {
    return true;
  }
}

function readTool(
  exec: () => Promise<any> = async () => ({ ok: true, data: { read: true } }),
): RuntimeTool {
  return {
    name: 'projects.get_summary',
    capability: 'projects',
    description: '',
    effect: 'READ',
    requiredAuthority: 10,
    approvalSensitive: false,
    timeoutMs: 1000,
    maxRetries: 1,
    validateInput: () => {},
    execute: exec,
  };
}
function writeTool(): RuntimeTool {
  return {
    name: 'tasks.create',
    capability: 'orchestration',
    description: '',
    effect: 'INTERNAL_WRITE',
    requiredAuthority: 50,
    approvalSensitive: false,
    timeoutMs: 1000,
    maxRetries: 1,
    validateInput: () => {},
    execute: async () => ({ ok: true, data: { taskId: 't1' } }),
  };
}
function sensitiveTool(): RuntimeTool {
  return {
    name: 'projects.transition_status',
    capability: 'projects',
    description: '',
    effect: 'EXTERNAL_WRITE',
    requiredAuthority: 75,
    approvalSensitive: true,
    timeoutMs: 1000,
    maxRetries: 0,
    validateInput: () => {},
    execute: async () => ({ ok: true, data: { status: 'WON' } }),
  };
}

function plan(steps: RuntimeTool[]): WorkPlan {
  return {
    objective: 'test',
    assumptions: [],
    requiredContextCapabilities: [],
    completionCriteria: ['done'],
    steps: steps.map((t, i) => ({
      id: `s${i + 1}`,
      sequence: i + 1,
      description: '',
      toolName: t.name,
      capability: t.capability,
      input: {},
      dependsOn: [],
      effect: t.effect,
      expectedOutput: '',
    })),
  };
}

function build(opts: {
  authority: number;
  blocked?: boolean;
  tools: RuntimeTool[];
  plan: WorkPlan;
  governance: { allowed: boolean; requiresApproval: boolean };
}) {
  const repo = new FakeRepo();
  const contextRepo = new FakeContextRepo();
  const registry = new ToolRegistry();
  for (const t of opts.tools) registry.register(t);
  const contextPlane = new FakeContextPlane(opts.authority, opts.blocked);
  const planner = new FakePlanner(opts.plan);
  const approvals = new FakeApprovals();
  const transport = new FakeTransport();
  const gov = {
    evaluateStep: async (p: any) => {
      // Reuse the real evaluator semantics via a tiny inline mimic:
      const base = {
        actorId: p.actorId,
        scope: {
          tenantId: p.tenantId,
          capability: p.tool.capability,
          toolName: p.tool.name,
        },
        decidedAt: new Date().toISOString(),
        policyVersion: '1.0.0',
        toolRegistrationsVersion: '1.0.0',
      };
      if (p.governanceBlocked)
        return {
          ...base,
          outcome: 'DENY',
          reason: 'blocked',
          policySource: 'g',
        };
      if (p.effectiveAuthority < p.tool.requiredAuthority)
        return {
          ...base,
          outcome: 'DENY',
          reason: 'authority',
          policySource: 'g',
        };
      if (!opts.governance.allowed)
        return { ...base, outcome: 'DENY', reason: 'rule', policySource: 'g' };
      if (p.tool.approvalSensitive || opts.governance.requiresApproval)
        return {
          ...base,
          outcome: 'REQUIRE_APPROVAL',
          reason: 'approval',
          policySource: 'g',
        };
      return { ...base, outcome: 'ALLOW', reason: 'ok', policySource: 'g' };
    },
  };
  const svc = new WorkRuntimeService(
    repo as never,
    contextRepo as never,
    contextPlane as never,
    planner as never,
    registry as never,
    gov as never,
    new ToolExecutor(),
    approvals as never,
    transport as never,
  );
  return { svc, repo, contextRepo, approvals, transport };
}

describe('WorkRuntimeService (integration)', () => {
  it('runs a read-only plan to COMPLETED', async () => {
    const t = readTool();
    const { svc, transport } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'read it',
    });
    const run = await svc.execute(created.id, 'A');
    expect(run.status).toBe('COMPLETED');
    const types = transport.events.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        'enterprise.workrun.created',
        'enterprise.workrun.planned',
        'enterprise.workrun.completed',
      ]),
    );
  });

  it('completes an authorized internal write', async () => {
    const t = writeTool();
    const { svc } = build({
      authority: 90,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'mgr',
      actorType: 'HUMAN',
      request: 'make a task',
    });
    const run = await svc.execute(created.id, 'A');
    expect(run.status).toBe('COMPLETED');
  });

  it('DENIES a write for a lower-authority actor', async () => {
    const t = writeTool();
    const { svc, repo } = build({
      authority: 20,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'low',
      actorType: 'HUMAN',
      request: 'make a task',
    });
    const run = await svc.execute(created.id, 'A');
    expect(run.status).toBe('FAILED');
    expect(run.failureCode).toBe('GOVERNANCE_DENIED');
    const steps = await repo.listSteps(created.id, 'A');
    expect(steps[0].status).toBe('DENIED');
  });

  it('PAUSES for approval on an approval-sensitive step, resumes after approval', async () => {
    const t = sensitiveTool();
    const { svc, repo, approvals, transport } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'transition status',
    });
    let run = await svc.execute(created.id, 'A');
    expect(run.status).toBe('WAITING_FOR_APPROVAL');
    expect(transport.events.map((e) => e.eventType)).toContain(
      'enterprise.workrun.approval.requested',
    );
    // Approve the created approval, then resume.
    const step = (await repo.listSteps(created.id, 'A'))[0];
    approvals.approve(step.approvalId);
    run = await svc.resume(created.id, 'A');
    expect(run.status).toBe('COMPLETED');
  });

  it('fails the run when approval is rejected', async () => {
    const t = sensitiveTool();
    const { svc, repo, approvals } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'transition',
    });
    await svc.execute(created.id, 'A');
    const step = (await repo.listSteps(created.id, 'A'))[0];
    approvals.reject(step.approvalId);
    const run = await svc.resume(created.id, 'A');
    expect(run.status).toBe('FAILED');
    expect(run.failureCode).toBe('APPROVAL_REJECTED');
  });

  it('does not double-execute on duplicate resume (idempotent)', async () => {
    const t = sensitiveTool();
    const { svc, repo, approvals } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'transition',
    });
    await svc.execute(created.id, 'A');
    const step = (await repo.listSteps(created.id, 'A'))[0];
    approvals.approve(step.approvalId);
    const run1 = await svc.resume(created.id, 'A');
    const run2 = await svc.resume(created.id, 'A'); // duplicate resume
    expect(run1.status).toBe('COMPLETED');
    expect(run2.status).toBe('COMPLETED');
    const succeeded = (await repo.listSteps(created.id, 'A')).filter(
      (s) => s.status === 'SUCCEEDED',
    );
    expect(succeeded).toHaveLength(1); // executed once
  });

  it('isolates runs by tenant (tenant B cannot access tenant A run)', async () => {
    const t = readTool();
    const { svc } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'read',
    });
    expect(await svc.getRun(created.id, 'B')).toBeNull(); // cross-tenant → nothing
    await expect(svc.execute(created.id, 'B')).rejects.toThrow(/not found/);
  });

  it('cancels a run', async () => {
    const t = readTool();
    const { svc } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'read',
    });
    const run = await svc.cancel(created.id, 'A', 'no longer needed');
    expect(run.status).toBe('CANCELLED');
  });

  it('surfaces a non-retryable tool failure as FAILED', async () => {
    const t = readTool(async () => ({
      ok: false,
      errorCode: 'NOT_FOUND',
      errorMessage: 'gone',
      retryable: false,
    }));
    const { svc } = build({
      authority: 100,
      tools: [t],
      plan: plan([t]),
      governance: { allowed: true, requiresApproval: false },
    });
    const created = await svc.createRun({
      tenantId: 'A',
      actorId: 'owner',
      actorType: 'HUMAN',
      request: 'read',
    });
    const run = await svc.execute(created.id, 'A');
    expect(run.status).toBe('FAILED');
    expect(run.failureCode).toBe('NOT_FOUND');
  });
});
