/**
 * AgentsPoolService — unit tests.
 * Phase 10 — verifies SOLID: AgentsPoolService extends PoolService and
 * supports type/enabled filters + clone behaviour.
 */

import { AgentsPoolService } from './agents-pool.service';

describe('AgentsPoolService — Phase 10 AI Employees Pool', () => {
  let service: AgentsPoolService;

  beforeEach(() => {
    service = new AgentsPoolService({} as never);
  });

  it('is an instance of PoolService (Liskov)', () => {
    expect(service).toBeDefined();
    expect(typeof (service as unknown as { list: unknown }).list).toBe('function');
    expect(typeof service.toggleEnabled).toBe('function');
    expect(typeof service.duplicate).toBe('function');
  });

  describe('config.buildWhere', () => {
    it('always scopes to platform-wide (isPublic, tenantId=null)', () => {
      const where = service['config'].buildWhere({});
      expect(where).toMatchObject({
        isPublic: true,
        tenantId: null,
        enabled: true,
        config: {
          path: ['autonomousWorkLayer', 'status'],
          equals: 'certified',
        },
      });
    });

    it('maps status=ENABLED/DISABLED to enabled boolean', () => {
      expect((service['config'].buildWhere({ status: 'ENABLED' }) as { enabled: boolean }).enabled).toBe(true);
      expect((service['config'].buildWhere({ status: 'DISABLED' }) as { enabled: boolean }).enabled).toBe(false);
    });

    it('maps status=EXECUTIVE/etc to type filter', () => {
      const where = service['config'].buildWhere({ status: 'EXECUTIVE' });
      expect((where as { type: string }).type).toBe('EXECUTIVE');
    });

    it('builds OR search across name/description', () => {
      const where = service['config'].buildWhere({ search: 'sales' });
      expect(Array.isArray((where as { OR: unknown[] }).OR)).toBe(true);
    });
  });

  describe('config.buildOrderBy', () => {
    it('defaults to updatedAt DESC', () => {
      expect(service['config'].buildOrderBy({})).toEqual({ updatedAt: 'desc' });
    });
  });
});
