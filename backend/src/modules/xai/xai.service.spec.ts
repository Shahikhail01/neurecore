/**
 * Phase 7 — XAI unit tests.
 */

import { ForbiddenException } from '@nestjs/common';
import { XaiService, OOB_XAI_MODEL_REGISTRY } from './xai.service';

function mockPrisma() {
  return {
    agentEnvelopeExplanation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  } as any;
}

describe('XaiService', () => {
  let svc: XaiService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new XaiService(prisma);
  });

  it('ships 2 OOB XAI models', () => {
    expect(OOB_XAI_MODEL_REGISTRY.length).toBe(2);
    expect(OOB_XAI_MODEL_REGISTRY[0].id).toBe('simple-hash-importance');
  });

  it('record is idempotent — second call returns the existing row', async () => {
    const existing = { id: 'x1', executionId: 'e1' };
    prisma.agentEnvelopeExplanation.findFirst.mockResolvedValue(existing);
    const out = await svc.record({
      tenantId: 'tenant-a',
      executionId: 'e1',
      reason: 'r',
      factors: [],
    });
    expect(out).toEqual(existing);
    expect(prisma.agentEnvelopeExplanation.create).not.toHaveBeenCalled();
  });

  it('record creates the row on first call', async () => {
    prisma.agentEnvelopeExplanation.findFirst.mockResolvedValue(null);
    prisma.agentEnvelopeExplanation.create.mockResolvedValue({ id: 'x2' });
    const out = await svc.record({
      tenantId: 'tenant-a',
      executionId: 'e2',
      reason: 'r',
      factors: [{ factor: 'engagement', value: 0.8, weight: 0.4 }],
    });
    expect(out).toEqual({ id: 'x2' });
    expect(prisma.agentEnvelopeExplanation.create).toHaveBeenCalled();
  });

  it('record refuses wildcard', async () => {
    await expect(
      svc.record({
        tenantId: '*',
        executionId: 'e1',
        reason: 'r',
        factors: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('whyPanel normalises weights to sum to 1', async () => {
    const out = await svc.whyPanel({
      tenantId: 'tenant-a',
      intent: 'send-quote',
      factors: [
        { factor: 'engagement', value: 3 },
        { factor: 'budget', value: 1 },
      ],
    });
    const sum = out.factors.reduce((a, f) => a + f.weight, 0);
    expect(sum).toBeCloseTo(1.0, 4);
    expect(out.factors[0].weight).toBeCloseTo(0.75, 4);
    expect(out.factors[1].weight).toBeCloseTo(0.25, 4);
  });

  it('whyPanel refuses wildcard', async () => {
    await expect(
      svc.whyPanel({
        tenantId: '*',
        intent: 'send-quote',
        factors: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
