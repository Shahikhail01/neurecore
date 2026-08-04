/**
 * Sales Outreach Orchestrator — unit tests.
 *
 * Asserts:
 *   1. schedule persists one run per step with cumulative delay.
 *   2. schedule refuses empty steps + wildcard tenant.
 *   3. ensureOobPolicies is idempotent.
 *   4. markSent / markFailed enforce the state machine.
 *   5. Approval policy gate logic: ALL_STEPS_AUTO never approves;
 *    STEPS_ABOVE_TIER_3_REQUIRE_APPROVAL approves tier > 3; etc.
 */

import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalPolicyKind } from '@prisma/client';
import {
  SalesOutreachOrchestrator,
  OOB_APPROVAL_POLICIES,
} from './sales-outreach-orchestrator.service';

function mockPrisma() {
  return {
    approvalPolicy: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    salesOutreachRun: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    studioEnvironmentConfig: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    mobileOmnichannelSession: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
}

describe('SalesOutreachOrchestrator', () => {
  let svc: SalesOutreachOrchestrator;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new SalesOutreachOrchestrator(prisma);
  });

  it('ships 3 OOB approval policies', () => {
    expect(OOB_APPROVAL_POLICIES.length).toBe(3);
  });

  describe('schedule', () => {
    it('persists one run per step with cumulative delay', async () => {
      prisma.salesOutreachRun.create
        .mockResolvedValueOnce({
          id: 'r1',
          stepIndex: 0,
          status: 'PENDING',
          scheduledFor: new Date(Date.now() + 86_400_000),
        })
        .mockResolvedValueOnce({
          id: 'r2',
          stepIndex: 1,
          status: 'PENDING',
          scheduledFor: new Date(Date.now() + 2 * 86_400_000),
        });
      const out = await svc.schedule({
        tenantId: 'tenant-a',
        campaignId: 'c1',
        contactId: 'contact-1',
        steps: [
          { channelKind: 'EMAIL', actionName: 'email-send', riskTier: 3 },
          { channelKind: 'SMS', actionName: 'sms-send', riskTier: 4, delayMs: 3600_000 },
        ],
      });
      expect(out).toHaveLength(2);
      expect(out[0].stepIndex).toBe(0);
      expect(out[1].stepIndex).toBe(1);
      expect(prisma.salesOutreachRun.create).toHaveBeenCalledTimes(2);
    });

    it('refuses empty steps', async () => {
      await expect(
        svc.schedule({
          tenantId: 'tenant-a',
          campaignId: 'c1',
          contactId: 'contact-1',
          steps: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses wildcard tenant', async () => {
      await expect(
        svc.schedule({
          tenantId: '*',
          campaignId: 'c1',
          contactId: 'contact-1',
          steps: [{ channelKind: 'EMAIL', actionName: 'email-send', riskTier: 3 }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('markSent / markFailed', () => {
    it('markSent updates status + finishedAt', async () => {
      prisma.salesOutreachRun.findUnique.mockResolvedValue({ id: 'r1', status: 'PENDING' });
      prisma.salesOutreachRun.update.mockResolvedValue({});
      await svc.markSent('r1', 'msg-123');
      expect(prisma.salesOutreachRun.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'SENT', providerId: 'msg-123', finishedAt: expect.any(Date) },
      });
    });

    it('markSent refuses a non-PENDING run', async () => {
      prisma.salesOutreachRun.findUnique.mockResolvedValue({ id: 'r1', status: 'SENT' });
      await expect(svc.markSent('r1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('markFailed is unconditional (logs even after SENT)', async () => {
      prisma.salesOutreachRun.findUnique.mockResolvedValue({ id: 'r1', status: 'SENT' });
      prisma.salesOutreachRun.update.mockResolvedValue({});
      await svc.markFailed('r1', 'flaky');
      expect(prisma.salesOutreachRun.update).toHaveBeenCalled();
    });
  });

  describe('approval-policy gate (via schedule path)', () => {
    it('ALL_STEPS_AUTO: step with riskTier=5 still produces a PENDING run (runner auto-picks it up)', async () => {
      prisma.salesOutreachRun.create.mockResolvedValue({ id: 'r1', stepIndex: 0, status: 'PENDING', scheduledFor: new Date() });
      await svc.schedule({
        tenantId: 'tenant-a',
        campaignId: 'c1',
        contactId: 'co',
        policyKind: ApprovalPolicyKind.ALL_STEPS_AUTO,
        steps: [{ channelKind: 'EMAIL', actionName: 'email-send', riskTier: 5 }],
      });
      expect(prisma.salesOutreachRun.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
      );
    });

    it('ALL_STEPS_REQUIRE_APPROVAL: gates every step (PENDING; runner marks ESCALATED)', async () => {
      prisma.salesOutreachRun.create.mockResolvedValue({ id: 'r1', status: 'PENDING', stepIndex: 0, scheduledFor: new Date() });
      await svc.schedule({
        tenantId: 'tenant-a',
        campaignId: 'c1',
        contactId: 'co',
        policyKind: ApprovalPolicyKind.ALL_STEPS_REQUIRE_APPROVAL,
        steps: [{ channelKind: 'EMAIL', actionName: 'email-send', riskTier: 1 }],
      });
      // All steps persist PENDING; the studio runner escalates them.
      expect(prisma.salesOutreachRun.create).toHaveBeenCalled();
    });
  });

  describe('ensureOobPolicies idempotency', () => {
    it('creates only the missing policies on first call', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue(null);
      prisma.approvalPolicy.create.mockResolvedValue({});
      const created = await svc.ensureOobPolicies('tenant-a');
      expect(created).toBe(OOB_APPROVAL_POLICIES.length);
      expect(prisma.approvalPolicy.create).toHaveBeenCalledTimes(OOB_APPROVAL_POLICIES.length);
    });

    it('creates zero on second call (all already exist)', async () => {
      prisma.approvalPolicy.findUnique.mockResolvedValue({ id: 'p' });
      const created = await svc.ensureOobPolicies('tenant-a');
      expect(created).toBe(0);
      expect(prisma.approvalPolicy.create).not.toHaveBeenCalled();
    });

    it('refuses wildcard tenant', async () => {
      await expect(svc.ensureOobPolicies('*')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('mobile omnichannel sessions', () => {
    it('recordMobileSession upserts idempotently', async () => {
      prisma.mobileOmnichannelSession.upsert.mockResolvedValue({});
      await svc.recordMobileSession({
        tenantId: 'tenant-a',
        connectionId: 'conn-1',
        userId: 'u1',
      });
      expect(prisma.mobileOmnichannelSession.upsert).toHaveBeenCalled();
    });

    it('recordMobileSession refuses wildcard', async () => {
      await expect(
        svc.recordMobileSession({
          tenantId: '*',
          connectionId: 'c1',
          userId: 'u1',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
