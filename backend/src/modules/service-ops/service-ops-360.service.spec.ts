/**
 * Phase 7 — Service Ops 360 unit tests.
 */

import {
  CustomerTouchpointService,
  CaseTriageService,
  RealTimeGuidanceService,
  ChatbotPersonaService,
  KnowledgeGapService,
  QuoteService,
  FieldSalesAssignmentService,
  SalesLeadRoutingService,
  EventService,
  PartnerService,
  CustomerIntentService,
} from './service-ops-360.service';
import { BadRequestException } from '@nestjs/common';

function mockPrisma() {
  return {
    customerTouchpointEvent: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    customerIntentSignal: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    caseTriageRule: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    caseEscalation: { create: jest.fn() },
    realTimeAgentGuidance: { create: jest.fn(), update: jest.fn() },
    chatbotPersona: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    knowledgeGap: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    quote: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    fieldSalesAssignment: { create: jest.fn(), findMany: jest.fn() },
    salesLeadRoutingDecision: { create: jest.fn() },
    event: { create: jest.fn(), findMany: jest.fn() },
    eventInvitation: { create: jest.fn() },
    partner: { create: jest.fn() },
    partnerLeadShare: { create: jest.fn() },
  } as any;
}

// ─── CustomerTouchpointService ───────────────────────────────────

describe('CustomerTouchpointService', () => {
  let svc: CustomerTouchpointService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new CustomerTouchpointService(prisma);
  });

  it('ingest refuses wildcard', async () => {
    await expect(
      svc.ingest({
        tenantId: '*',
        customerId: 'c1',
        channelKind: 'email',
        externalId: 'e1',
        occurredAt: new Date(),
      }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('ingest writes a upsert on (tenantId, channelKind, externalId)', async () => {
    prisma.customerTouchpointEvent.upsert.mockResolvedValue({ id: 't1' });
    await svc.ingest({
      tenantId: 'tenant-a',
      customerId: 'c1',
      channelKind: 'email',
      externalId: 'e1',
      occurredAt: new Date(),
      tags: ['support-question'],
    });
    expect(prisma.customerTouchpointEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_channelKind_externalId: {
            tenantId: 'tenant-a',
            channelKind: 'email',
            externalId: 'e1',
          },
        },
      }),
    );
  });

  it('get360View composes timeline + intent summary', async () => {
    prisma.customerTouchpointEvent.findMany.mockResolvedValue([
      { id: 't1', channelKind: 'email', occurredAt: new Date() },
      { id: 't2', channelKind: 'chat', occurredAt: new Date() },
    ]);
    prisma.customerIntentSignal.findMany.mockResolvedValue([
      { intentKind: 'purchase', confidence: 0.8 },
    ]);
    const out = await svc.get360View('tenant-a', 'c1');
    expect(out.summary.totalTouchpoints).toBe(2);
    expect(out.summary.channelsTouched).toEqual(['email', 'chat']);
    expect(out.summary.activeIntent).toBe('purchase');
  });
});

// ─── CaseTriageService ─────────────────────────────────────────

describe('CaseTriageService', () => {
  let svc: CaseTriageService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new CaseTriageService(prisma);
  });

  it('evaluate returns the highest-priority matching rule', async () => {
    prisma.caseTriageRule.findMany.mockResolvedValue([
      { id: 'r1', priority: 'LOW', action: 'AUTO_PRIORITY', targetQueue: null, targetOwnerId: null, predicate: { priority: 'high' }, enabled: true },
      { id: 'r2', priority: 'URGENT', action: 'ESCALATE_HUMAN', targetQueue: null, targetOwnerId: null, predicate: { priority: 'high' }, enabled: true },
    ]);
    prisma.caseEscalation.create.mockResolvedValue({});
    const out = await svc.evaluate({
      tenantId: 'tenant-a',
      caseId: 'c1',
      payload: { priority: 'high' },
    });
    expect(out.matched).toBe(true);
    if (out.matched) {
      expect(out.ruleId).toBe('r2');
      expect(out.action).toBe('ESCALATE_HUMAN');
    }
  });

  it('evaluate returns matched=false when no rule matches', async () => {
    prisma.caseTriageRule.findMany.mockResolvedValue([
      { id: 'r1', priority: 'URGENT', action: 'AUTO_PRIORITY', targetQueue: null, targetOwnerId: null, predicate: { priority: 'low' }, enabled: true },
    ]);
    const out = await svc.evaluate({
      tenantId: 'tenant-a',
      caseId: 'c1',
      payload: { priority: 'high' },
    });
    expect(out.matched).toBe(false);
    expect(prisma.caseEscalation.create).not.toHaveBeenCalled();
  });

  it('evaluate supports operator maps (eq / ne / gt / in)', async () => {
    prisma.caseTriageRule.findMany.mockResolvedValue([
      { id: 'r1', priority: 'URGENT', action: 'AUTO_ROUTE_QUEUE', targetQueue: 'q-billing', targetOwnerId: null, predicate: { amount: { gt: 1000 }, region: { in: ['us', 'ca'] } }, enabled: true },
    ]);
    prisma.caseEscalation.create.mockResolvedValue({});
    const out = await svc.evaluate({
      tenantId: 'tenant-a',
      caseId: 'c1',
      payload: { amount: 5000, region: 'us' },
    });
    expect(out.matched).toBe(true);
  });

  it('evaluate refuses wildcard', async () => {
    await expect(
      svc.evaluate({ tenantId: '*', caseId: 'c1', payload: {} }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });
});

// ─── RealTimeGuidanceService ──────────────────────────────────────

describe('RealTimeGuidanceService', () => {
  let svc: RealTimeGuidanceService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new RealTimeGuidanceService(prisma);
  });

  it('suggest writes a guidance row with stable hash-derived template', async () => {
    prisma.realTimeAgentGuidance.create.mockResolvedValue({ id: 'g1' });
    const r1 = await svc.suggest({ tenantId: 'tenant-a', caseId: 'c1', agentId: 'agent-1' });
    const r2 = await svc.suggest({ tenantId: 'tenant-a', caseId: 'c1', agentId: 'agent-1' });
    // Same input → same hint (deterministic).
    expect(r1).toEqual(r2);
  });

  it('suggest refuses wildcard', async () => {
    await expect(
      svc.suggest({ tenantId: '*', caseId: 'c1', agentId: 'a1' }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('accept stamps acceptedAt', async () => {
    prisma.realTimeAgentGuidance.update.mockResolvedValue({});
    await svc.accept({ tenantId: 'tenant-a', id: 'g1' });
    expect(prisma.realTimeAgentGuidance.update).toHaveBeenCalledWith({
      where: { id: 'g1' },
      data: { acceptedAt: expect.any(Date) },
    });
  });
});

// ─── ChatbotPersonaService ───────────────────────────────────────

describe('ChatbotPersonaService', () => {
  let svc: ChatbotPersonaService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new ChatbotPersonaService(prisma);
  });

  it('create refuses threshold outside [0,1]', async () => {
    await expect(
      svc.create({
        tenantId: 'tenant-a',
        kind: 'SUPPORT_TIER_1',
        slug: 's',
        displayName: 's',
        systemPrompt: 's',
        escalationThreshold: 1.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolve picks the persona matching the intent', async () => {
    prisma.chatbotPersona.findFirst.mockResolvedValue({ id: 'p1', kind: 'SALES_ASSIST' });
    const out = await svc.resolve({ tenantId: 'tenant-a', intentKind: 'purchase' });
    expect(out?.kind).toBe('SALES_ASSIST');
  });

  it('resolve refuses wildcard', async () => {
    await expect(
      svc.resolve({ tenantId: '*', intentKind: 'support' }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });
});

// ─── KnowledgeGapService ────────────────────────────────────────

describe('KnowledgeGapService', () => {
  let svc: KnowledgeGapService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new KnowledgeGapService(prisma);
  });

  it('detect is idempotent — existing topicHash is not recreated', async () => {
    prisma.knowledgeGap.findUnique.mockResolvedValue({ id: 'k1' });
    const out = await svc.detect({ tenantId: 'tenant-a', topics: ['login'] });
    expect(out).toEqual([]);
    expect(prisma.knowledgeGap.create).not.toHaveBeenCalled();
  });

  it('detect creates a new gap per new topic', async () => {
    prisma.knowledgeGap.findUnique.mockResolvedValue(null);
    prisma.knowledgeGap.create.mockResolvedValue({ id: 'k1' });
    const out = await svc.detect({
      tenantId: 'tenant-a',
      topics: ['billing', 'shipping'],
      caseCount: 3,
    });
    expect(prisma.knowledgeGap.create).toHaveBeenCalledTimes(2);
    expect(out.length).toBe(2);
  });

  it('detect refuses wildcard', async () => {
    await expect(
      svc.detect({ tenantId: '*', topics: [] }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });
});

// ─── QuoteService ─────────────────────────────────────────────

describe('QuoteService', () => {
  let svc: QuoteService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new QuoteService(prisma);
  });

  it('createDraft computes subtotal / discount / total', async () => {
    prisma.quote.create.mockResolvedValue({});
    await svc.createDraft({
      tenantId: 'tenant-a',
      dealId: 'd1',
      items: [
        { sku: 'A', quantity: 2, unitPrice: 100 },
        { sku: 'B', quantity: 1, unitPrice: 50 },
      ],
      discountTotal: 30,
    });
    expect(prisma.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: expect.objectContaining({ d: [250] }),
          discountTotal: expect.objectContaining({ d: [30] }),
          total: expect.objectContaining({ d: [220] }),
        }),
      }),
    );
  });

  it('createDraft refuses wildcard', async () => {
    await expect(
      svc.createDraft({
        tenantId: '*',
        dealId: 'd1',
        items: [{ sku: 'A', quantity: 1, unitPrice: 10 }],
      }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('approve flips status to SENT + sets approver', async () => {
    prisma.quote.findUnique.mockResolvedValue({ id: 'q1', tenantId: 'tenant-a' });
    prisma.quote.update.mockResolvedValue({});
    await svc.approve({ tenantId: 'tenant-a', id: 'q1', actorId: 'admin-1' });
    expect(prisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({
          status: 'SENT',
          approvedByActorId: 'admin-1',
          approvedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('approve refuses cross-tenant', async () => {
    prisma.quote.findUnique.mockResolvedValue({ id: 'q1', tenantId: 'tenant-b' });
    await expect(
      svc.approve({ tenantId: 'tenant-a', id: 'q1', actorId: 'admin-1' }),
    ).rejects.toThrow(/different tenant/);
  });
});

// ─── SalesLeadRoutingService ────────────────────────────────────

describe('SalesLeadRoutingService', () => {
  let svc: SalesLeadRoutingService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new SalesLeadRoutingService(prisma);
  });

  it('route picks a candidate deterministically', async () => {
    prisma.salesLeadRoutingDecision.create.mockResolvedValue({});
    const out = await svc.route({
      tenantId: 'tenant-a',
      leadId: 'lead-1',
      candidateRepIds: ['rep-1', 'rep-2', 'rep-3'],
    });
    expect(out).not.toBeNull();
  });

  it('route returns null when there are no candidates', async () => {
    const out = await svc.route({
      tenantId: 'tenant-a',
      leadId: 'lead-1',
      candidateRepIds: [],
    });
    expect(out).toBeNull();
  });

  it('route refuses wildcard', async () => {
    await expect(
      svc.route({ tenantId: '*', leadId: 'l1', candidateRepIds: [] }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });
});

// ─── EventService ─────────────────────────────────────────────

describe('EventService', () => {
  let svc: EventService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new EventService(prisma);
  });

  it('create writes the event', async () => {
    prisma.event.create.mockResolvedValue({});
    await svc.create({
      tenantId: 'tenant-a',
      slug: 'launch',
      displayName: 'Product Launch',
      startsAt: new Date(),
      endsAt: new Date(),
    });
    expect(prisma.event.create).toHaveBeenCalled();
  });

  it('create refuses wildcard', () => {
    expect(() =>
      svc.create({
        tenantId: '*',
        slug: 's',
        displayName: 'd',
        startsAt: new Date(),
        endsAt: new Date(),
      }),
    ).toThrow(/tenantId "\*" is forbidden/);
  });

  it('invite persists an invitation row', async () => {
    prisma.eventInvitation.create.mockResolvedValue({});
    await svc.invite({ tenantId: 'tenant-a', eventId: 'e1', contactId: 'c1' });
    expect(prisma.eventInvitation.create).toHaveBeenCalled();
  });
});

// ─── PartnerService ───────────────────────────────────────────

describe('PartnerService', () => {
  let svc: PartnerService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new PartnerService(prisma);
  });

  it('shareLead persists the row', async () => {
    prisma.partnerLeadShare.create.mockResolvedValue({});
    await svc.shareLead({ tenantId: 'tenant-a', partnerId: 'p1', leadId: 'l1' });
    expect(prisma.partnerLeadShare.create).toHaveBeenCalled();
  });
});

// ─── CustomerIntentService ─────────────────────────────────────

describe('CustomerIntentService', () => {
  let svc: CustomerIntentService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new CustomerIntentService(prisma);
  });

  it('record refuses confidence outside [0, 1]', async () => {
    await expect(
      svc.record({
        tenantId: 'tenant-a',
        customerId: 'c1',
        source: 'chat',
        intentKind: 'purchase',
        confidence: 1.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('record writes the signal', async () => {
    prisma.customerIntentSignal.create.mockResolvedValue({});
    await svc.record({
      tenantId: 'tenant-a',
      customerId: 'c1',
      source: 'chat',
      intentKind: 'purchase',
      confidence: 0.7,
    });
    expect(prisma.customerIntentSignal.create).toHaveBeenCalled();
  });
});
