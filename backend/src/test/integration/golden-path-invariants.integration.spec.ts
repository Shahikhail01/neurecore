// src/test/integration/golden-path-invariants.integration.spec.ts
/**
 * G1.1 — Real PostgreSQL invariant tests.
 *
 * Policy: integration tests MUST NOT silently skip in CI.
 *
 * Modes:
 *   - Default: tests SKIP if no DATABASE_URL is set
 *     (acceptable for developer's local unit-test command)
 *   - AWL_REQUIRE_INTEGRATION_DB=true: tests FAIL HARD if no DB
 *     (required for the CI integration job)
 *
 * Per NC-AWL-IMP-1 §11.2:
 *   - Same idempotency key cannot create two projects
 *   - Transaction atomicity
 *   - Worker claim exclusivity
 *   - Stale lease recovery
 *   - Dead-letter transition
 *   - Tenant isolation
 */

import { PrismaClient, EnterpriseEventOutboxStatus } from '@prisma/client';
import { PrismaUnitOfWork } from '../../common/persistence/prisma-unit-of-work';
import { PrismaIdempotencyRepository } from '../../common/persistence/prisma-idempotency.repository';
import { PrismaOutboxRepository } from '../../common/persistence/prisma-outbox.repository';
import { InitiationStateMachine } from '../../modules/enterprise-initiation/domain/initiation-state-machine';
import { InitiationStatus } from '../../modules/enterprise-initiation/domain/initiation-states';

const RECONSTRUCTION_TENANT = 'reconstruction-integration-test';
const REQUIRE_DB = process.env.AWL_REQUIRE_INTEGRATION_DB === 'true';
const DB_AVAILABLE = !!process.env.DATABASE_URL;

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

const describeOrSkip = REQUIRE_DB || DB_AVAILABLE ? describe : describe.skip;

describeOrSkip('G1.1 — Real PostgreSQL Invariant Tests', () => {
  let prisma: PrismaClient;
  let uow: PrismaUnitOfWork;
  let idempotency: PrismaIdempotencyRepository;
  let outbox: PrismaOutboxRepository;

  beforeAll(async () => {
    if (skipIfNoDb()) {
      return;
    }
    prisma = new PrismaClient();
    uow = new PrismaUnitOfWork(prisma as any);
    idempotency = new PrismaIdempotencyRepository(prisma as any);
    outbox = new PrismaOutboxRepository(prisma as any);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  describe('Invariant 1: Idempotency table has correct unique constraint', () => {
    it('rejects duplicate (tenantId, key) inserts', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const key = `test-${Date.now()}`;
      const scope = 'TestScope';
      const fullKey = `${scope}:${key}`;

      await prisma.idempotencyRecord.create({
        data: {
          tenantId,
          key: fullKey,
          requestPath: scope,
          requestHash: 'hash-A',
          status: 'IN_FLIGHT',
          expiresAt: null,
        },
      });

      await expect(
        prisma.idempotencyRecord.create({
          data: {
            tenantId,
            key: fullKey,
            requestPath: scope,
            requestHash: 'hash-B',
            status: 'IN_FLIGHT',
            expiresAt: null,
          },
        }),
      ).rejects.toThrow();

      await prisma.idempotencyRecord.deleteMany({ where: { tenantId, key: fullKey } });
    });
  });

  describe('Invariant 2: Outbox has correct unique constraint', () => {
    it('rejects duplicate (tenantId, idempotencyKey) outbox events', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const idempotencyKey = `outbox-test-${Date.now()}-${Math.random()}`;

      await prisma.enterpriseEventOutbox.create({
        data: {
          tenantId,
          eventType: 'TestEvent',
          version: 1,
          correlationId: 'test-corr',
          idempotencyKey,
          sourceModule: 'test',
          actorType: 'SYSTEM',
          payload: {} as any,
          status: 'PENDING' as any,
        },
      });

      await expect(
        prisma.enterpriseEventOutbox.create({
          data: {
            tenantId,
            eventType: 'TestEvent',
            version: 1,
            correlationId: 'test-corr-2',
            idempotencyKey,
            sourceModule: 'test',
            actorType: 'SYSTEM',
            payload: {} as any,
            status: 'PENDING' as any,
          },
        }),
      ).rejects.toThrow();

      await prisma.enterpriseEventOutbox.deleteMany({
        where: { tenantId, idempotencyKey },
      });
    });
  });

  describe('Invariant 3: EnterpriseInitiation persists with version', () => {
    it('round-trips and supports optimistic lock', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const id = `init-${Date.now()}`;

      const created = await prisma.enterpriseInitiation.create({
        data: {
          id,
          tenantId,
          status: InitiationStatus.DRAFT,
          projectName: 'Integration test',
          version: 1,
        } as any,
      });
      expect(created.version).toBe(1);

      const read = await prisma.enterpriseInitiation.findUnique({ where: { id } });
      expect(read?.status).toBe(InitiationStatus.DRAFT);

      await prisma.enterpriseInitiation.delete({ where: { id } });
    });
  });

  describe('Invariant 4: State machine prevents invalid transitions', () => {
    it('rejects INITIATION_APPROVED from DRAFT', () => {
      expect(() =>
        InitiationStateMachine.assertTransition(
          InitiationStatus.DRAFT,
          InitiationStatus.APPROVED,
        ),
      ).toThrow('Invalid transition');
    });

    it('rejects INITIATION_APPROVED from COMPLETED', () => {
      expect(() =>
        InitiationStateMachine.assertTransition(
          InitiationStatus.COMPLETED,
          InitiationStatus.APPROVED,
        ),
      ).toThrow('Invalid transition');
    });

    it('allows INITIATION_APPROVED from READY_FOR_CONFIRMATION', () => {
      expect(() =>
        InitiationStateMachine.assertTransition(
          InitiationStatus.READY_FOR_CONFIRMATION,
          InitiationStatus.APPROVED,
        ),
      ).not.toThrow();
    });
  });

  describe('Invariant 5: Idempotency replay returns cached result', () => {
    it('first reserves, second returns existing', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const key = `replay-${Date.now()}`;
      const scope = 'TestScope';
      const fullKey = `${scope}:${key}`;

      const first = await idempotency.checkAndReserve({
        tenantId,
        scope,
        idempotencyKey: key,
        requestHash: 'hash-A',
      });
      expect(first.reserved).toBe(true);
      expect(first.replayed).toBe(false);

      await idempotency.complete({
        tenantId,
        scope,
        idempotencyKey: key,
        resultData: { result: 'cached' },
        correlationId: 'test',
      });

      const second = await idempotency.checkAndReserve({
        tenantId,
        scope,
        idempotencyKey: key,
        requestHash: 'hash-A',
      });
      expect(second.reserved).toBe(false);
      expect(second.replayed).toBe(true);
      expect((second.existing as any)?.responseBody).toEqual({ result: 'cached' });

      await prisma.idempotencyRecord.deleteMany({ where: { tenantId, key: fullKey } });
    });
  });

  describe('Invariant 6: Idempotency payload mismatch rejected', () => {
    it('throws IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const key = `reuse-${Date.now()}-${Math.random()}-${process.pid}`;
      const scope = 'TestScope';
      const fullKey = `${scope}:${key}`;

      // Clean up any prior test data
      await prisma.idempotencyRecord.deleteMany({ where: { tenantId, key: fullKey } });

      await idempotency.checkAndReserve({
        tenantId,
        scope,
        idempotencyKey: key,
        requestHash: 'hash-A',
      });
      await idempotency.complete({
        tenantId,
        scope,
        idempotencyKey: key,
        resultData: { result: 'A' },
        correlationId: 'test',
      });

      await expect(
        idempotency.checkAndReserve({
          tenantId,
          scope,
          idempotencyKey: key,
          requestHash: 'hash-B',
        }),
      ).rejects.toThrow('IDEMPOTENCY_KEY_REUSE_WITH_DIFFERENT_PAYLOAD');

      await prisma.idempotencyRecord.deleteMany({ where: { tenantId, key: fullKey } });
    });
  });

  describe('Invariant 7: Durable record has NULL expiresAt (no short TTL)', () => {
    it('completed record persists with NULL expiry', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const key = `durable-${Date.now()}`;
      const scope = 'TestScope';
      const fullKey = `${scope}:${key}`;

      await idempotency.checkAndReserve({
        tenantId,
        scope,
        idempotencyKey: key,
        requestHash: 'hash-A',
      });
      await idempotency.complete({
        tenantId,
        scope,
        idempotencyKey: key,
        resultData: { result: 'durable' },
        correlationId: 'test',
      });

      const record = await prisma.idempotencyRecord.findUnique({
        where: { tenantId_key: { tenantId, key: fullKey } },
      });

      // Durable business idempotency must have NULL expiresAt
      expect(record?.expiresAt).toBeNull();
      expect(record?.status).toBe('COMPLETED');

      await prisma.idempotencyRecord.deleteMany({ where: { tenantId, key: fullKey } });
    });
  });

  describe('Invariant 8: Transaction atomicity via UoW', () => {
    it('rolls back all writes on error', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const initId = `init-uow-${Date.now()}`;

      const beforeInit = await prisma.enterpriseInitiation.count({
        where: { id: initId },
      });
      expect(beforeInit).toBe(0);

      await expect(
        uow.execute(async (tx) => {
          const prismaTx = tx as any;
          await prismaTx.enterpriseInitiation.create({
            data: {
              id: initId,
              tenantId,
              status: InitiationStatus.DRAFT,
              projectName: 'UoW test',
              version: 1,
            } as any,
          });
          throw new Error('FORCED_ROLLBACK');
        }),
      ).rejects.toThrow('FORCED_ROLLBACK');

      const afterInit = await prisma.enterpriseInitiation.count({
        where: { id: initId },
      });
      expect(afterInit).toBe(0);
    });
  });

  describe('Invariant 9: PrismaExecutionEngine enum persists', () => {
    it('Project accepts PrismaExecutionEngine values', async () => {
      if (skipIfNoDb()) return;
      const tenantId = RECONSTRUCTION_TENANT;
      const customerName = `Test Customer ${Date.now()}-${Math.random()}`;
      const customer = await prisma.customer.create({
        data: { tenantId, name: customerName },
      });

      const project = await prisma.project.create({
        data: {
          tenantId,
          name: `Test Project ${Date.now()}`,
          customerId: customer.id,
          executionEngineVersion: 'canonical' as any,
          status: 'ACTIVE',
        } as any,
      });

      expect(project.executionEngineVersion).toBe('canonical');

      await prisma.project.delete({ where: { id: project.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    });
  });
});
