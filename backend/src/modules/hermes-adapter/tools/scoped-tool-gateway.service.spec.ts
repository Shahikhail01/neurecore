/**
 * ScopedToolGatewayService — Creatio parity `nc.*` tool tests.
 *
 * Covers the 9 new tools (score_lead, next_best_step, forecast_pipeline,
 * generate_quote, resolve_case, search_kb, customer_360, run_ai_twin,
 * dispatch_channel) added in Phase 9.1:
 *   - tenant scoping (every read filters by claims.tenantId);
 *   - happy-path dispatch result shape;
 *   - BadRequestException on malformed args (Zod validation);
 *   - ForbiddenException when tenantId is the wildcard;
 *   - dispatch_channel rejects unknown channelKind.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ScopedToolGatewayService } from './scoped-tool-gateway.service';
import { NC_TOOL_NAMES } from './scoped-tool.schemas';

const TENANT_ID = 'tenant-abc';
const OTHER_TENANT = 'tenant-xyz';
const USER_ID = 'user-1';
const EXEC_ID = 'exec-1';
const APPROVAL_ID = 'ap-1';

const baseClaims = {
  sub: USER_ID,
  tenantId: TENANT_ID,
  executionId: EXEC_ID,
  allowedTools: NC_TOOL_NAMES as unknown as string[],
  scope: 'hermes.exec',
  iat: 0,
  exp: 0,
};

function makePrismaStub() {
  return {
    customer: {
      findFirst: jest.fn(async () => ({
        id: 'cust-1',
        tenantId: TENANT_ID,
        name: 'Acme',
        financialSubType: 'BANKING',
        lifecycleStage: 'PROSPECT',
        createdAt: new Date(),
      })),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    approvalRequest: { findFirst: jest.fn(async () => null) },
    quote: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    aiTwin: {
      findFirst: jest.fn(async () => ({
        id: 'twin-1',
        slug: 'default-twin',
        displayName: 'Default Twin',
        status: 'ACTIVE',
      })),
    },
  };
}

function makeSvc(opts: { prisma?: object } = {}) {
  const prisma = (opts.prisma ?? makePrismaStub()) as never;
  const customers = { findAll: jest.fn() } as never;
  const projects = {} as never;
  const goals = {} as never;
  const tasks = {} as never;
  const approvals = {
    create: jest.fn(async () => ({ id: APPROVAL_ID })),
    findOne: jest.fn(async () => ({
      id: APPROVAL_ID,
      tenantId: TENANT_ID,
      status: 'APPROVED',
      resourceId: EXEC_ID,
    })),
  } as never;
  const notifications = {} as never;
  const memory = {} as never;
  const prediction = {
    predict: jest.fn(async () => ({
      id: 'pred-1',
      tenantId: TENANT_ID,
      subject: { type: 'lead', id: 'lead-1' },
      predictionType: 'lead_score',
      value: 0.82,
      confidence: 0.91,
      model: { id: 'm1', version: '1' },
      featureSnapshotId: 'fs-1',
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      explanation: ['top feature: recency'],
      limitations: ['stub'],
    })),
  } as never;
  const quoteService = {
    createDraft: jest.fn(async (args: Record<string, unknown>) => ({
      id: 'quote-1',
      tenantId: args['tenantId'],
      dealId: args['dealId'],
      quoteNumber: 'Q-1',
      total: 100,
      status: 'DRAFT',
    })),
  } as never;
  const caseTriage = {
    evaluate: jest.fn(async () => ({
      matched: true,
      ruleId: 'rule-1',
      priority: 'HIGH',
      action: 'AUTO_ROUTE_OWNER',
      target: 'user-2',
    })),
  } as never;
  const realTimeGuidance = {
    suggest: jest.fn(async () => ({
      id: 'rg-1',
      tenantId: TENANT_ID,
      caseId: 'case-1',
      hint: 'Check 3 last touchpoints',
      confidence: 0.82,
      trigger: 'kb:general',
    })),
  } as never;
  const knowledgeGap = {
    list: jest.fn(async () => [
      {
        id: 'kg-1',
        topic: 'billing',
        suggestedTitle: 'Billing FAQ',
        status: 'OPEN',
        caseCount: 3,
      },
    ]),
  } as never;
  const customerTouchpoint = {
    get360View: jest.fn(async () => ({
      tenantId: TENANT_ID,
      customerId: 'cust-1',
      timeline: [],
      intentSignals: [],
      summary: { totalTouchpoints: 0, channelsTouched: [], lastTouchpointAt: null, activeIntent: null },
    })),
  } as never;
  const aiTwin = {} as never;
  const twinGraphExecutor = {
    invoke: jest.fn(async (params: Record<string, unknown>) => ({
      runId: 'run-test',
      twinId: params['twinId'],
      status: 'completed',
      intent: params['intent'],
      output: { text: 'graph ran' },
      toolCalls: [],
      checkpoints: [],
      durationMs: 12,
      correlationId: `twin_${params['twinId']}_run-test`,
    })),
  } as never;
  const dealsService = {
    forecastForTenant: jest.fn(async () => ({
      byStage: [],
      weightedTotal: 0,
      committedTotal: 0,
      bestCaseTotal: 0,
      totalAmount: 0,
      dealsCount: 0,
    })),
  } as never;
  const channelService = {
    dispatch: jest.fn(async () => ({ ok: true, providerId: 'msg-1' })),
  } as never;

  return {
    svc: new ScopedToolGatewayService(
      customers,
      projects,
      goals,
      tasks,
      approvals,
      notifications,
      memory,
      prisma,
      prediction,
      quoteService,
      caseTriage,
      realTimeGuidance,
      knowledgeGap,
      customerTouchpoint,
      aiTwin,
      twinGraphExecutor,
      dealsService,
      channelService,
    ),
    mocks: {
      prediction, quoteService, caseTriage, realTimeGuidance,
      knowledgeGap, customerTouchpoint, channelService, prisma,
      twinGraphExecutor, dealsService,
    },
  };
}

const leadId = '11111111-1111-4111-8111-111111111111';

describe('ScopedToolGatewayService — Creatio parity nc.* tools', () => {
  it('dispatches nc.score_lead to the prediction service and returns a score envelope', async () => {
    const { svc, mocks } = makeSvc();
    const result = await svc.execute(
      'nc.score_lead',
      { leadId },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.prediction.predict).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      subject: { type: 'lead', id: leadId },
      predictionType: 'lead_score',
    });
    expect((result.data as { leadId: string }).leadId).toBe(leadId);
    expect((result.data as { tenantId: string }).tenantId).toBe(TENANT_ID);
    expect((result.data as { confidence: number }).confidence).toBe(0.91);
  });

  it('rejects nc.score_lead when leadId is not a uuid', async () => {
    const { svc } = makeSvc();
    await expect(
      svc.execute('nc.score_lead', { leadId: 'not-a-uuid' }, { ...baseClaims }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dispatches nc.next_best_step with dealId subject', async () => {
    const { svc, mocks } = makeSvc();
    const dealId = '22222222-2222-4222-8222-222222222222';
    const result = await svc.execute(
      'nc.next_best_step',
      { dealId },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.prediction.predict).toHaveBeenCalled();
    expect((result.data as { subjectType: string }).subjectType).toBe('deal');
    expect((result.data as { subjectId: string }).subjectId).toBe(dealId);
  });

  it('dispatches nc.next_best_step with contactId subject', async () => {
    const { svc } = makeSvc();
    const contactId = '33333333-3333-4333-8333-333333333333';
    const result = await svc.execute(
      'nc.next_best_step',
      { contactId },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect((result.data as { subjectType: string }).subjectType).toBe('contact');
  });

  it('rejects nc.next_best_step when neither dealId nor contactId is present', async () => {
    const { svc } = makeSvc();
    await expect(
      svc.execute('nc.next_best_step', {}, { ...baseClaims }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dispatches nc.forecast_pipeline with horizon defaults', async () => {
    const { svc, mocks } = makeSvc();
    const result = await svc.execute(
      'nc.forecast_pipeline',
      {},
      { ...baseClaims },
    );
    expect(result.success).toBe(true);
    expect((result.data as { horizonDays: number }).horizonDays).toBe(90);
    expect(mocks.prisma.quote.findMany).toHaveBeenCalled();
  });

  it('dispatches nc.generate_quote and creates a draft quote', async () => {
    const { svc, mocks } = makeSvc();
    const dealId = '44444444-4444-4444-8444-444444444444';
    const result = await svc.execute(
      'nc.generate_quote',
      {
        dealId,
        items: [{ sku: 'WIDGET-1', quantity: 2, unitPrice: 50 }],
      },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.quoteService.createDraft).toHaveBeenCalled();
    expect((mocks.quoteService.createDraft.mock.calls[0][0] as { aiGenerated: boolean }).aiGenerated).toBe(true);
    expect((result.data as { dealId: string }).dealId).toBe(dealId);
  });

  it('rejects nc.generate_quote with empty items', async () => {
    const { svc } = makeSvc();
    const dealId = '44444444-4444-4444-8444-444444444444';
    await expect(
      svc.execute(
        'nc.generate_quote',
        { dealId, items: [] },
        { ...baseClaims },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reuses an existing draft quote for the same dealId', async () => {
    const prisma = makePrismaStub();
    (prisma.quote.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'existing',
      quoteNumber: 'Q-OLD',
      total: 99,
      status: 'DRAFT',
    });
    const { svc, mocks } = makeSvc({ prisma });
    const dealId = '55555555-5555-4555-8555-555555555555';
    const result = await svc.execute(
      'nc.generate_quote',
      {
        dealId,
        items: [{ sku: 'WIDGET-2', quantity: 1, unitPrice: 100 }],
      },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.quoteService.createDraft).not.toHaveBeenCalled();
    expect((result.data as { reused: boolean }).reused).toBe(true);
  });

  it('dispatches nc.resolve_case with action=classify', async () => {
    const { svc, mocks } = makeSvc();
    const caseId = '66666666-6666-4666-8666-666666666666';
    const result = await svc.execute(
      'nc.resolve_case',
      { caseId, action: 'classify' },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.caseTriage.evaluate).toHaveBeenCalled();
    expect((result.data as { action: string }).action).toBe('classify');
  });

  it('dispatches nc.resolve_case with action=suggest', async () => {
    const { svc, mocks } = makeSvc();
    const caseId = '66666666-6666-4666-8666-666666666666';
    const result = await svc.execute(
      'nc.resolve_case',
      { caseId, action: 'suggest' },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.realTimeGuidance.suggest).toHaveBeenCalled();
    expect((result.data as { action: string }).action).toBe('suggest');
  });

  it('dispatches nc.resolve_case with action=draft_reply (no service call)', async () => {
    const { svc, mocks } = makeSvc();
    const caseId = '66666666-6666-4666-8666-666666666666';
    const result = await svc.execute(
      'nc.resolve_case',
      { caseId, action: 'draft_reply' },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.caseTriage.evaluate).not.toHaveBeenCalled();
    expect((result.data as { action: string }).action).toBe('draft_reply');
    expect(typeof (result.data as { draft: string }).draft).toBe('string');
  });

  it('rejects nc.resolve_case with unknown action', async () => {
    const { svc } = makeSvc();
    const caseId = '66666666-6666-4666-8666-666666666666';
    await expect(
      svc.execute(
        'nc.resolve_case',
        { caseId, action: 'bogus' },
        { ...baseClaims },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dispatches nc.search_kb and returns topic matches', async () => {
    const { svc, mocks } = makeSvc();
    const result = await svc.execute(
      'nc.search_kb',
      { query: 'billing' },
      { ...baseClaims },
    );
    expect(result.success).toBe(true);
    expect(mocks.knowledgeGap.list).toHaveBeenCalledWith(TENANT_ID);
    expect((result.data as { totalMatches: number }).totalMatches).toBeGreaterThanOrEqual(1);
  });

  it('rejects nc.search_kb with empty query', async () => {
    const { svc } = makeSvc();
    await expect(
      svc.execute('nc.search_kb', { query: '' }, { ...baseClaims }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dispatches nc.customer_360 and merges customer + 360 view', async () => {
    const { svc } = makeSvc();
    const customerId = '77777777-7777-4777-8777-777777777777';
    const result = await svc.execute(
      'nc.customer_360',
      { customerId },
      { ...baseClaims },
    );
    expect(result.success).toBe(true);
    expect((result.data as { id: string }).id).toBe('cust-1');
    expect((result.data as { tenantId: string }).tenantId).toBe(TENANT_ID);
  });

  it('dispatches nc.run_ai_twin through TwinGraphExecutor (real LangGraph run, not audit stub)', async () => {
    const { svc, mocks } = makeSvc();
    const twinId = '88888888-8888-4888-8888-888888888888';
    const result = await svc.execute(
      'nc.run_ai_twin',
      { twinId, intent: 'summarise my week' },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    // The LangGraph executor is invoked with the correct tenant + actor
    expect(mocks.twinGraphExecutor.invoke).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      actorId: USER_ID,
      twinId,
      intent: 'summarise my week',
    });
    // The audit-only stub path (prisma.auditLog.create for ai_twin) is no longer reachable
    const aiTwinAuditCalls = (mocks.prisma.auditLog.create as jest.Mock).mock.calls.filter(
      (c) => (c[0]?.data?.action ?? '') === 'autonomous.ai_twin.run',
    );
    expect(aiTwinAuditCalls).toHaveLength(0);
    // The new shape carries runId + output + toolCalls + correlationId
    const data = result.data as {
      twinId: string; runId: string; status: string;
      intent: string; output: unknown; toolCalls: unknown[];
      durationMs: number; correlationId: string;
    };
    expect(data.twinId).toBe(twinId);
    expect(data.runId).toBe('run-test');
    expect(data.status).toBe('completed');
    expect(data.intent).toBe('summarise my week');
    expect(data.correlationId).toContain(twinId);
  });

  it('dispatches nc.dispatch_channel with a valid ChannelKind', async () => {
    const { svc, mocks } = makeSvc();
    const result = await svc.execute(
      'nc.dispatch_channel',
      {
        channelKind: 'EMAIL',
        targetId: 'conn-1',
        payload: { subject: 'hi', body: 'there' },
      },
      { ...baseClaims },
      APPROVAL_ID,
    );
    expect(result.success).toBe(true);
    expect(mocks.channelService.dispatch).toHaveBeenCalled();
    expect((mocks.channelService.dispatch.mock.calls[0][0] as { kind: string }).kind).toBe('EMAIL');
  });

  it('rejects nc.dispatch_channel with unknown channelKind', async () => {
    const { svc } = makeSvc();
    await expect(
      svc.execute(
        'nc.dispatch_channel',
        {
          channelKind: 'BOGUS_CHANNEL',
          targetId: 'conn-1',
          payload: {},
        },
        { ...baseClaims },
        APPROVAL_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses nc.score_lead when tenantId is the wildcard', async () => {
    const { svc } = makeSvc();
    const claims = { ...baseClaims, tenantId: '*' };
    await expect(
      svc.execute('nc.score_lead', { leadId }, claims, APPROVAL_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses nc.customer_360 when tenantId is the wildcard', async () => {
    const { svc } = makeSvc();
    const claims = { ...baseClaims, tenantId: '*' };
    const customerId = '77777777-7777-4777-8777-777777777777';
    await expect(
      svc.execute('nc.customer_360', { customerId }, claims),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses nc.run_ai_twin when tenantId is the wildcard', async () => {
    const { svc } = makeSvc();
    const claims = { ...baseClaims, tenantId: '*' };
    const twinId = '88888888-8888-4888-8888-888888888888';
    await expect(
      svc.execute('nc.run_ai_twin', { twinId, intent: 'x' }, claims, APPROVAL_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not leak data for other tenants (cross-tenant guard)', async () => {
    const { svc, mocks } = makeSvc();
    const otherClaims = { ...baseClaims, tenantId: OTHER_TENANT };
    await svc.execute('nc.score_lead', { leadId }, otherClaims, APPROVAL_ID);
    expect(mocks.prediction.predict).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: OTHER_TENANT }),
    );
  });
});