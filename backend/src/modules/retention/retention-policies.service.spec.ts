/**
 * Phase 18 — RetentionPoliciesService tests.
 */

import { RetentionPoliciesService } from './retention-policies.service';

function makePrisma() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    prisma: {
      $queryRaw: jest.fn(async () => rows) as never,
      $executeRaw: jest.fn(async () => undefined) as never,
    },
    rows,
  };
}

describe('Phase 18 — RetentionPoliciesService', () => {
  it('list returns empty on wildcard tenantId', async () => {
    const svc = new RetentionPoliciesService(makePrisma().prisma);
    expect(await svc.list('*')).toEqual([]);
  });

  it('upsert refuses wildcard tenantId', async () => {
    const svc = new RetentionPoliciesService(makePrisma().prisma);
    await expect(
      svc.upsert('*', 'chat', 30, 7, false, true),
    ).rejects.toThrow(/tenantId/);
  });

  it('upsert refuses negative retentionDays', async () => {
    const svc = new RetentionPoliciesService(makePrisma().prisma);
    await expect(
      svc.upsert('t', 'chat', -1, 7, false, true),
    ).rejects.toThrow(/retention days/);
  });

  it('isExportWithinPolicy returns true when no policy exists', async () => {
    const svc = new RetentionPoliciesService(makePrisma().prisma);
    expect(
      await svc.isExportWithinPolicy('t', 'chat', new Date()),
    ).toBe(true);
  });

  it('isExportWithinPolicy returns true when legalHold', async () => {
    const { prisma, rows } = makePrisma();
    rows.push({
      id: 'p-1', tenantId: 't', scope: 'chat',
      retentionDays: 1, hardDeleteGraceDays: 7,
      legalHold: true, redactPII: true,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const svc = new RetentionPoliciesService(prisma);
    expect(
      await svc.isExportWithinPolicy('t', 'chat', new Date()),
    ).toBe(true);
  });
});
