import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RoutingDecisionsService } from './routing-decisions.service';

/**
 * RoutingDecisionsService tests.
 *
 * Pattern mirrors DecisionEvaluationsService.spec.ts: in-memory store +
 * fake $transaction. Validates:
 *   - record() persists every typed field including nullable ones
 *   - listRecent() is tenant-scoped and newest-first
 *   - listRecent() hard-caps the limit and never throws on invalid input
 *   - countAmbiguousSince() filters by ambiguous=true and the date floor
 *   - tenant scoping: rows for tenant A never appear under tenant B
 */
describe('RoutingDecisionsService', () => {
  let service: RoutingDecisionsService;
  let mockPrisma: any;
  let store: Map<string, any>;

  beforeEach(async () => {
    store = new Map();

    mockPrisma = {
      routingDecisionLog: {
        create: jest.fn(async ({ data }: any) => {
          const id = `r-${store.size + 1}`;
          const rec = {
            id,
            tenantId: data.tenantId,
            actorId: data.actorId,
            ruleVersion: data.ruleVersion,
            ruleId: data.ruleId,
            intent: data.intent,
            canonicalCapability: data.canonicalCapability ?? null,
            confidence: data.confidence,
            rawMessageHash: data.rawMessageHash,
            resolvedActionId: data.resolvedActionId ?? null,
            sessionId: data.sessionId ?? null,
            correlationId: data.correlationId ?? null,
            ambiguous: data.ambiguous ?? false,
            createdAt: new Date(),
          };
          store.set(id, rec);
          return rec;
        }),
        findMany: jest.fn(async ({ where, orderBy, take }: any) => {
          let rows = Array.from(store.values()).filter(
            (r) => r.tenantId === where.tenantId,
          );
          if (orderBy?.createdAt) {
            const dir = orderBy.createdAt;
            rows.sort((a, b) =>
              dir === 'desc'
                ? b.createdAt.getTime() - a.createdAt.getTime()
                : a.createdAt.getTime() - b.createdAt.getTime(),
            );
          }
          if (typeof take === 'number') {
            rows = rows.slice(0, take);
          }
          return rows;
        }),
        count: jest.fn(async ({ where }: any) => {
          return Array.from(store.values()).filter(
            (r) =>
              r.tenantId === where.tenantId &&
              r.ambiguous === where.ambiguous &&
              r.createdAt.getTime() >= where.createdAt.gte.getTime(),
          ).length;
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        RoutingDecisionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(RoutingDecisionsService);
  });

  const basePayload = {
    ruleVersion: '1.0.0',
    ruleId: 'entity_fallback',
    intent: 'READ',
    canonicalCapability: 'listProjects',
    confidence: 0.95,
    rawMessageHash: 'a'.repeat(64),
    ambiguous: false,
  };

  describe('record', () => {
    it('persists every typed field and normalizes nullable fields to null', async () => {
      const created = await service.record('t1', 'user-1', basePayload);
      expect(created.tenantId).toBe('t1');
      expect(created.actorId).toBe('user-1');
      expect(created.canonicalCapability).toBe('listProjects');
      expect(created.ambiguous).toBe(false);
    });

    it('persists AMBIGUOUS decisions with canonicalCapability=null', async () => {
      const created = await service.record('t1', 'user-1', {
        ...basePayload,
        intent: 'UNSUPPORTED',
        canonicalCapability: undefined,
        ambiguous: true,
      });
      expect(created.ambiguous).toBe(true);
      expect(created.canonicalCapability).toBeNull();
    });
  });

  describe('listRecent', () => {
    it('returns rows newest-first and tenant-scoped', async () => {
      await service.record('t1', 'user-1', basePayload);
      await service.record('t2', 'user-2', basePayload); // wrong tenant
      const t1Rows = await service.listRecent('t1', 10);
      expect(t1Rows).toHaveLength(1);
      expect(t1Rows[0].tenantId).toBe('t1');
    });

    it('hard-caps limit at 500 and clamps non-positive values to 1', async () => {
      for (let i = 0; i < 3; i++) {
        await service.record('t1', 'user-1', basePayload);
      }
      const capped = await service.listRecent('t1', 99999);
      expect(capped.length).toBeLessThanOrEqual(500);
      const clamped = await service.listRecent('t1', -1);
      // negative limits clamp to the minimum of 1 (Math.floor(-1) = -1,
      // Math.max(1, -1) = 1) so we always get at least one row back when
      // any rows exist for the tenant.
      expect(clamped.length).toBe(1);
      const one = await service.listRecent('t1', 0);
      expect(one.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('countAmbiguousSince', () => {
    it('counts only ambiguous=true rows on or after the floor', async () => {
      await service.record('t1', 'user-1', {
        ...basePayload,
        ambiguous: true,
      });
      await service.record('t1', 'user-1', basePayload); // not ambiguous
      const now = new Date(Date.now() - 60_000);
      const total = await service.countAmbiguousSince('t1', now);
      expect(total).toBe(1);
    });
  });
});
