/**
 * Governance Composition — Tests.
 */

import { GovernanceCompositionService } from './governance-composition.service';
import { GovernanceDomain } from '@prisma/client';

function mockPrisma() {
  return {
    governanceControl: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    governanceControlEvaluation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    governanceControlRule: { count: jest.fn().mockResolvedValue(0) },
    securityControlState: { count: jest.fn().mockResolvedValue(0) },
  } as any;
}

describe('GovernanceCompositionService', () => {
  let svc: GovernanceCompositionService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new GovernanceCompositionService(prisma);
  });

  it('compose returns 4 domains (even when none are seeded)', async () => {
    prisma.governanceControl.findMany.mockResolvedValue([]);
    const out = await svc.compose('tenant-a');
    expect(out.domains.length).toBe(4);
    for (const d of out.domains) {
      expect(d.totalControls).toBe(0);
      expect(d.enabledControls).toBe(0);
      expect(d.failingControls).toBe(0);
      expect(d.averageScore).toBeNull();
      expect(d.lastEvaluatedAt).toBeNull();
    }
  });

  it('compose aggregates totals + failing + average score per domain', async () => {
    prisma.governanceControl.findMany.mockResolvedValue([
      { id: 'c1', domain: 'data' as GovernanceDomain, status: 'ACTIVE' },
      { id: 'c2', domain: 'data' as GovernanceDomain, status: 'ACTIVE' },
      { id: 'c3', domain: 'security' as GovernanceDomain, status: 'ACTIVE' },
    ]);
    prisma.governanceControlEvaluation.findMany.mockResolvedValue([
      { controlId: 'c1', score: 100, outcome: 'PASS', finishedAt: new Date('2026-01-01') },
      { controlId: 'c2', score: 0, outcome: 'FAIL', finishedAt: new Date('2026-01-02') },
      { controlId: 'c3', score: 80, outcome: 'PASS', finishedAt: new Date('2026-01-03') },
    ]);
    prisma.governanceControlRule.count.mockResolvedValue(2);
    prisma.securityControlState.count.mockResolvedValue(4);
    const out = await svc.compose('tenant-a');
    expect(out.domains[0].totalControls).toBe(2); // data
    expect(out.domains[0].failingControls).toBe(1); // c2 FAIL
    expect(out.domains[0].averageScore).toBe(50); // (100+0)/2
    expect(out.domains[3].totalControls).toBe(1); // security
    expect(out.domains[3].averageScore).toBe(80);
    expect(out.customRuleCount).toBe(2);
    expect(out.securityControlCount).toBe(4);
  });

  it('compose uses the MOST RECENT evaluation per control', async () => {
    prisma.governanceControl.findMany.mockResolvedValue([
      { id: 'c1', domain: 'data' as GovernanceDomain, status: 'ACTIVE' },
    ]);
    prisma.governanceControlEvaluation.findMany.mockResolvedValue([
      // Returned in order: most recent FIRST.
      { controlId: 'c1', score: 50, outcome: 'PASS', finishedAt: new Date('2026-02-01') },
      { controlId: 'c1', score: 100, outcome: 'PASS', finishedAt: new Date('2026-01-01') },
    ]);
    const out = await svc.compose('tenant-a');
    expect(out.domains[0].averageScore).toBe(50); // most recent, not 100
  });
});
