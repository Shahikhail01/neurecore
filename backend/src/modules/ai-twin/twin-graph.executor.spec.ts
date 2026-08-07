/**
 * TwinGraphExecutor — unit tests.
 *
 * Covers:
 *   1. Tenant wildcard / empty tenantId rejected
 *   2. Twin not found → NotFoundException
 *   3. Twin not ACTIVE → ConflictException
 *   4. Happy path: graph invoked with allowedTools, audit recorded
 *   5. Graph failure → TwinGraphException thrown (retriable=true)
 *   6. Evaluation success → status='completed'; failed → 'aborted'
 *   7. allowedTools null/undefined → null passed to graph
 *   8. allowedTools array → Array.from(...) passed to graph
 *   9. Checkpoint service writes key when available
 *  10. recordRunAudit receives correct envelope + result
 *
 * No DB, no LLM — everything is mocked.
 */

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TwinLifecycleStatus } from '@prisma/client';
import {
  TwinGraphExecutor,
  TwinGraphException,
} from './twin-graph.executor';
import { AiTwinService } from './ai-twin.service';
import { TwinPermissionMirrorGuard } from './ai-twin.runtime-contract';

const TENANT = 'tenant-abc';
const TWIN_ID = 'twin-1';
const ACTOR = 'user-1';

function makeTwinRow(overrides: Partial<{
  status: TwinLifecycleStatus;
  agentTemplateId: string | null;
  allowedReadScopes: string[];
  allowedWriteScopes: string[];
}> = {}) {
  return {
    id: TWIN_ID,
    tenantId: TENANT,
    ownerUserId: ACTOR,
    slug: 'default-twin',
    displayName: 'Default Twin',
    status: overrides.status ?? TwinLifecycleStatus.ACTIVE,
    agentTemplateId:
      overrides.agentTemplateId === undefined ? 'tmpl-1' : overrides.agentTemplateId,
    agentTemplateVersionId: 'tmpl-v1',
    allowedReadScopes: overrides.allowedReadScopes ?? ['crm.read.contacts'],
    allowedWriteScopes: overrides.allowedWriteScopes ?? ['crm.write.deals'],
  };
}

function makePrismaStub() {
  return {
    aiTwin: {
      findFirst: jest.fn(async () => makeTwinRow()),
    },
  };
}

function makeAiTwinService() {
  return {
    buildEnvelopeForAction: jest.fn(() => ({ intent: 'TOOL_INVOKED', ok: true })),
    recordRunAudit: jest.fn(async () => undefined),
  };
}

function makeGuard() {
  return {} as unknown as TwinPermissionMirrorGuard;
}

function makeGraph(evalOutcome: 'success' | 'fail' = 'success') {
  return {
    run: jest.fn(async () => ({
      goal: 'x',
      agentId: 'tmpl-1',
      tenantId: TENANT,
      userId: ACTOR,
      plan: null,
      steps: [],
      currentStep: null,
      toolCalls: [],
      toolResults: [
        { toolName: 'crm.read.contacts', input: {}, output: { count: 3 }, durationMs: 5 },
      ],
      evaluation: {
        score: evalOutcome === 'success' ? 0.95 : 0.3,
        success: evalOutcome === 'success',
        reflection: evalOutcome === 'success' ? 'all good' : 'low score',
        suggestions: [],
        shouldRetry: evalOutcome !== 'success',
      },
      messages: [{ role: 'assistant', content: 'done' }],
      currentNode: 'evaluator',
      iteration: 1,
      maxIterations: 10,
      error: null,
      shouldContinue: false,
      model: 'deepseek-chat',
      allowedTools: null,
      envelope: null,
      forcedCapability: null,
      route: null,
    })),
  };
}

function makeCheckpoints(available = true) {
  return {
    isAvailable: jest.fn(() => available),
  };
}

function build(opts: { prisma?: object } = {}) {
  const prisma = (opts.prisma ?? makePrismaStub()) as never;
  const aiTwinSvc = makeAiTwinService() as unknown as AiTwinService;
  const guard = makeGuard();
  const graph = makeGraph() as never;
  const checkpoints = makeCheckpoints() as never;

  const svc = new TwinGraphExecutor(prisma, aiTwinSvc, guard, graph, checkpoints);

  return {
    svc,
    aiTwinSvc,
    graph,
    checkpoints,
    prisma,
  };
}

describe('TwinGraphExecutor', () => {
  it('rejects empty tenantId', async () => {
    const { svc } = build();
    await expect(
      svc.invoke({
        tenantId: '',
        actorId: ACTOR,
        twinId: TWIN_ID,
        intent: 'x',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects wildcard tenantId', async () => {
    const { svc } = build();
    await expect(
      svc.invoke({
        tenantId: '*',
        actorId: ACTOR,
        twinId: TWIN_ID,
        intent: 'x',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when twin is not found', async () => {
    const prisma = {
      aiTwin: { findFirst: jest.fn(async () => null) },
    } as never;
    const { svc } = build({ prisma });
    await expect(
      svc.invoke({
        tenantId: TENANT,
        actorId: ACTOR,
        twinId: 'no-such',
        intent: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when twin is not ACTIVE', async () => {
    const prisma = {
      aiTwin: {
        findFirst: jest.fn(async () => makeTwinRow({ status: TwinLifecycleStatus.DRAFT })),
      },
    } as never;
    const { svc } = build({ prisma });
    await expect(
      svc.invoke({
        tenantId: TENANT,
        actorId: ACTOR,
        twinId: TWIN_ID,
        intent: 'x',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('happy path: graph invoked with allowedTools array, audit recorded', async () => {
    const { svc, aiTwinSvc, graph } = build();
    const result = await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'summarise my week',
      allowedTools: ['crm.read.contacts', 'crm.write.deals'],
    });

    expect(result.twinId).toBe(TWIN_ID);
    expect(result.status).toBe('completed'); // evaluation.success === true
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe('crm.read.contacts');
    expect(result.runId).toMatch(/^run_/);
    expect(result.correlationId).toContain(TWIN_ID);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Graph was called with Array.from(allowedTools)
    expect(graph.run).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        userId: ACTOR,
        agentId: 'tmpl-1',
        allowedTools: ['crm.read.contacts', 'crm.write.deals'],
      }),
    );

    // Audit was recorded exactly once with the result attached
    expect(aiTwinSvc.recordRunAudit).toHaveBeenCalledTimes(1);
    const auditArg = (aiTwinSvc.recordRunAudit as jest.Mock).mock.calls[0][0];
    expect(auditArg.twinId).toBe(TWIN_ID);
    expect(auditArg.tenantId).toBe(TENANT);
    expect(auditArg.runId).toBe(result.runId);
    expect(auditArg.correlationId).toBe(result.correlationId);
    expect(auditArg.result).toBe(result);
    expect(auditArg.envelope).toBeDefined();
  });

  it('passes null to graph.allowedTools when caller passes null/undefined (inherit policy)', async () => {
    const { svc, graph } = build();
    await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
      allowedTools: undefined,
    });
    expect(graph.run).toHaveBeenCalledWith(expect.objectContaining({ allowedTools: null }));

    await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
      allowedTools: null,
    });
    expect(graph.run).toHaveBeenLastCalledWith(expect.objectContaining({ allowedTools: null }));
  });

  it('uses twin.agentTemplateId when present (no fallback)', async () => {
    const { svc, graph } = build();
    await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
    });
    expect(graph.run).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'tmpl-1' }));
  });

  it('falls back to "twin:<id>" as agentId when agentTemplateId is null', async () => {
    const prisma = {
      aiTwin: {
        findFirst: jest.fn(async () => makeTwinRow({ agentTemplateId: null })),
      },
    } as never;
    const { svc, graph } = build({ prisma });
    await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
    });
    expect(graph.run).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: `twin:${TWIN_ID}` }),
    );
  });

  it('evaluation failure → status=aborted; audit still recorded', async () => {
    const graph = makeGraph('fail') as never;
    const prisma = makePrismaStub() as never;
    const aiTwinSvc = makeAiTwinService() as unknown as AiTwinService;
    const svc = new TwinGraphExecutor(
      prisma,
      aiTwinSvc,
      makeGuard(),
      graph,
      makeCheckpoints(),
    );

    const result = await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
    });

    expect(result.status).toBe('aborted');
    expect(aiTwinSvc.recordRunAudit).toHaveBeenCalledTimes(1);
  });

  it('wraps graph exceptions in TwinGraphException with retriable=true', async () => {
    const graph = {
      run: jest.fn(async () => {
        throw new Error('LLM provider unreachable');
      }),
    } as never;
    const prisma = makePrismaStub() as never;
    const aiTwinSvc = makeAiTwinService() as unknown as AiTwinService;
    const svc = new TwinGraphExecutor(
      prisma,
      aiTwinSvc,
      makeGuard(),
      graph,
      makeCheckpoints(),
    );

    await expect(
      svc.invoke({
        tenantId: TENANT,
        actorId: ACTOR,
        twinId: TWIN_ID,
        intent: 'x',
      }),
    ).rejects.toMatchObject({
      name: 'TwinGraphException',
      retriable: true,
    });

    expect(aiTwinSvc.recordRunAudit).not.toHaveBeenCalled();
  });

  it('records checkpoint when AgentCheckpointService is available', async () => {
    const { svc, checkpoints } = build();
    await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
    });
    expect(checkpoints.isAvailable).toHaveBeenCalled();
  });

  it('emits no checkpoints when AgentCheckpointService is unavailable', async () => {
    const checkpoints = makeCheckpoints(false) as never;
    const prisma = makePrismaStub() as never;
    const aiTwinSvc = makeAiTwinService() as unknown as AiTwinService;
    const svc = new TwinGraphExecutor(
      prisma,
      aiTwinSvc,
      makeGuard(),
      makeGraph(),
      checkpoints,
    );
    const result = await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
    });
    expect(result.checkpoints).toHaveLength(0);
  });

  it('envelope is built with twin allow-list merged into scopesUsed', async () => {
    const { svc, aiTwinSvc } = build();
    await svc.invoke({
      tenantId: TENANT,
      actorId: ACTOR,
      twinId: TWIN_ID,
      intent: 'x',
    });
    const arg = (aiTwinSvc.buildEnvelopeForAction as jest.Mock).mock.calls[0][0];
    expect(arg.scopesUsed).toEqual(
      expect.arrayContaining(['crm.read.contacts', 'crm.write.deals']),
    );
    expect(arg.intent).toBe('TOOL_INVOKED');
  });
});
