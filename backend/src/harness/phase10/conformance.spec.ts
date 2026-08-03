import { createHash } from 'crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HarnessControlService } from './harness-control.service';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';

const digest = (v: unknown) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');

const makeActor = (sub: string, role = 'SUPER_ADMIN', tenantId: string | null = null): JwtPayload =>
  ({ sub, email: `${sub}@example.com`, role, tenantId, jti: 'jti' } as unknown as JwtPayload);

describe('Phase 10 — Harness Control Center conformance', () => {
  describe('§12 Forbidden actions', () => {
    it('rejects self-approval of a harness run', async () => {
      const service = new HarnessControlService({
        harnessRun: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'run-1',
            requestedBy: 'self',
            state: 'REQUESTED',
          }),
        },
      } as never);
      await expect(
        service.approveRun(makeActor('self'), 'run-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects self-approval of a waiver (requester)', async () => {
      const service = new HarnessControlService({
        harnessWaiver: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'w-1',
            requestedBy: 'self',
            ownerId: 'someone-else',
            expiresAt: new Date(Date.now() + 60_000),
          }),
        },
      } as never);
      await expect(
        service.approveWaiver(makeActor('self'), 'w-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects self-approval of a waiver (owner)', async () => {
      const service = new HarnessControlService({
        harnessWaiver: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'w-1',
            requestedBy: 'someone-else',
            ownerId: 'self',
            expiresAt: new Date(Date.now() + 60_000),
          }),
        },
      } as never);
      await expect(
        service.approveWaiver(makeActor('self'), 'w-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects self-approval of a change (creator)', async () => {
      const service = new HarnessControlService({
        harnessChangeVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'c-1',
            createdBy: 'self',
            ownerId: 'someone-else',
            evaluationRunId: 'eval-1',
            rollbackData: { rollback: true },
          }),
        },
      } as never);
      await expect(
        service.approveChange(makeActor('self'), 'c-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects self-approval of a change (owner)', async () => {
      const service = new HarnessControlService({
        harnessChangeVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'c-1',
            createdBy: 'someone-else',
            ownerId: 'self',
            evaluationRunId: 'eval-1',
            rollbackData: { rollback: true },
          }),
        },
      } as never);
      await expect(
        service.approveChange(makeActor('self'), 'c-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects approve of change without evaluation/rollback data', async () => {
      const service = new HarnessControlService({
        harnessChangeVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'c-1',
            createdBy: 'someone-else',
            ownerId: 'another',
            evaluationRunId: null,
            rollbackData: null,
          }),
        },
      } as never);
      await expect(
        service.approveChange(makeActor('reviewer'), 'c-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns NotFound (not cross-tenant) for evidence of another tenant', async () => {
      const service = new HarnessControlService({
        harnessEvidence: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ev-1',
            tenantId: 'tenant-b',
            run: {},
          }),
        },
      } as never);
      const actor = makeActor('reader', 'SUPER_ADMIN', 'tenant-a');
      await expect(service.getEvidence(actor, 'ev-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('denies destructive PRODUCTION run even when policy allows it', async () => {
      const service = new HarnessControlService({
        harnessRunPolicy: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'policy-1',
            deprecatedAt: null,
            approvedAt: new Date(),
            approvedBy: 'reviewer',
            environment: 'PRODUCTION',
            maxBudgetUsd: 100,
            allowedCapabilityIds: [],
            destructiveAllowed: true,
            productionAllowed: true,
            requiresApproval: false,
            maxConcurrency: 5,
          }),
        },
        harnessRun: { count: jest.fn().mockResolvedValue(0) },
      } as never);
      await expect(
        service.requestRun(makeActor('requester'), {
          capabilityId: 'CAP-1',
          scenarioId: 'SCN-1',
          environment: 'PRODUCTION',
          runPolicyId: 'fb718de5-ae0b-45be-bba4-eca4d9b68e32',
          destructive: true,
          budgetUsd: 10,
          idempotencyKey: 'idem-1-2-3-4',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies replay with external side effects (firewall)', async () => {
      const service = new HarnessControlService({
        harnessReplayBundle: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'b-1',
            sourceRunId: '00000000-0000-0000-0000-000000000001',
            environment: 'STAGING',
            externalSideEffects: true,
            schemaVersion: '1',
            manifest: { x: 1 },
            checksum: 'irrelevant',
          }),
        },
        harnessReplayExecution: { create: jest.fn() },
      } as never);
      await expect(
        service.executeReplay(makeActor('operator'), 'b-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('denies PRODUCTION replay regardless of bundle manifest', async () => {
      const manifest = { events: [] };
      const checksum = digest(manifest);
      const service = new HarnessControlService({
        harnessReplayBundle: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'b-2',
            sourceRunId: '00000000-0000-0000-0000-000000000002',
            environment: 'PRODUCTION',
            externalSideEffects: false,
            schemaVersion: '1',
            manifest,
            checksum,
          }),
        },
        harnessReplayExecution: { create: jest.fn() },
      } as never);
      await expect(
        service.executeReplay(makeActor('operator'), 'b-2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses non-SUPER_ADMIN actors for mutating endpoints', async () => {
      const service = new HarnessControlService({} as never);
      await expect(
        service.requestRun(makeActor('someone', 'PLATFORM_ADMIN'), {
          capabilityId: 'C',
          scenarioId: 'S',
          environment: 'LOCAL',
          runPolicyId: '00000000-0000-0000-0000-000000000000',
          destructive: false,
          budgetUsd: 1,
          idempotencyKey: 'idem-1-2-3-4',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses waiver creation when owner equals requester (separation of duties)', async () => {
      const service = new HarnessControlService({} as never);
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      await expect(
        service.createWaiver(makeActor('requester'), {
          capabilityId: 'CAP-1',
          scope: 'policy X',
          reason: 'incident response',
          compensatingControl: 'manual review',
          ownerId: 'requester',
          issueLink: 'https://example.com/issue/1',
          expiresAt: tomorrow,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses replay bundle that mixes PRODUCTION with external side effects at creation', async () => {
      const service = new HarnessControlService({} as never);
      await expect(
        service.createReplayBundle(makeActor('requester'), {
          sourceRunId: '00000000-0000-0000-0000-000000000003',
          environment: 'PRODUCTION',
          externalSideEffects: true,
          schemaVersion: '1',
          manifest: { x: 1 },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('§15 Evidence integrity', () => {
    it('recomputes audit chain deterministically', async () => {
      const created = new Date('2026-01-01T00:00:00Z');
      const eventHash = digest({
        actorId: 'a',
        action: 'x',
        resourceType: 'r',
        resourceId: '1',
        previousHash: null,
        createdAt: created.toISOString(),
        details: { k: 1 },
      });
      const service = new HarnessControlService({
        harnessAuditEvent: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'e1',
              actorId: 'a',
              action: 'x',
              resourceType: 'r',
              resourceId: '1',
              previousHash: null,
              createdAt: created,
              details: { k: 1 },
              eventHash,
            },
          ]),
        },
      } as never);
      const result = await service.verifyAuditChain();
      expect(result).toEqual({ ok: true, checked: 1 });
    });

    it('detects a tampered audit event', async () => {
      const created = new Date('2026-01-01T00:00:00Z');
      const service = new HarnessControlService({
        harnessAuditEvent: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'e1',
              actorId: 'a',
              action: 'x',
              resourceType: 'r',
              resourceId: '1',
              previousHash: null,
              createdAt: created,
              details: { k: 1 },
              eventHash: 'wrong',
            },
          ]),
        },
      } as never);
      const result = await service.verifyAuditChain();
      expect(result.ok).toBe(false);
      expect(result.brokenAt).toBe('e1');
    });
  });
});
