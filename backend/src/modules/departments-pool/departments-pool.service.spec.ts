/**
 * DepartmentsPoolService — unit tests.
 * Phase 10 — verifies SOLID: DepartmentsPoolService extends PoolService.
 */

import { DepartmentsPoolService } from './departments-pool.service';

describe('DepartmentsPoolService — Phase 10 Departments Pool', () => {
  let service: DepartmentsPoolService;

  beforeEach(() => {
    service = new DepartmentsPoolService({} as never);
  });

  it('is an instance of PoolService (Liskov)', () => {
    expect(service).toBeDefined();
    expect(typeof (service as unknown as { list: unknown }).list).toBe('function');
  });

  it('exposes uniqueKey = slug', () => {
    expect((service as unknown as { uniqueKey: string }).uniqueKey).toBe('slug');
  });

  describe('config.buildWhere', () => {
    it('hides legacy-tier rows by default', () => {
      const where = service['config'].buildWhere({});
      expect(where).toHaveProperty('NOT');
      // post-P13: legacy-tier was collapsed to DepartmentTemplateCategory.OTHER
      expect((where as { NOT: { category: string } }).NOT.category).toBe('OTHER');
    });

    it('filters by category from status', () => {
      const where = service['config'].buildWhere({ status: 'startup' });
      expect((where as { category: string }).category).toBe('startup');
    });

    it('builds OR search', () => {
      const where = service['config'].buildWhere({ search: 'ops' });
      expect(where).toHaveProperty('OR');
      expect(Array.isArray((where as { OR: unknown[] }).OR)).toBe(true);
    });
  });

  describe('config.buildOrderBy', () => {
    it('defaults to createdAt DESC', () => {
      expect(service['config'].buildOrderBy({})).toEqual({ createdAt: 'desc' });
    });
  });
});
