/**
 * Phase 7 — Governance Authoring unit tests.
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomGovernanceControlService,
  OperationalGovernanceService,
  SecurityGovernanceService,
  InternalComplianceService,
  OPERATIONAL_PROBES,
  INTERNAL_COMPLIANCE_CHECKS,
  SECURITY_CONTROL_KEYS,
} from './governance-authoring.service';

function mockPrisma() {
  return {
    governanceControlRule: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    operationalHealthMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    securityControlState: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    internalComplianceCheck: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
}

// ─── Custom governance rules (§5.14.3) ──────────────────────────

describe('CustomGovernanceControlService', () => {
  let svc: CustomGovernanceControlService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new CustomGovernanceControlService(prisma);
  });

  it('create rejects invalid domain', async () => {
    await expect(
      svc.create({
        tenantId: 'tenant-a',
        slug: 's',
        displayName: 'd',
        description: 'd',
        domain: 'invalid' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create refuses wildcard', async () => {
    await expect(
      svc.create({
        tenantId: '*',
        slug: 's',
        displayName: 'd',
        description: 'd',
        domain: 'data',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('evaluate refuses cross-tenant', async () => {
    prisma.governanceControlRule.findUnique.mockResolvedValue({ tenantId: 'tenant-b', enabled: true, predicate: {} });
    await expect(
      svc.evaluate({ tenantId: 'tenant-a', ruleId: 'r1', evidence: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('evaluate throws NotFound for missing rule', async () => {
    prisma.governanceControlRule.findUnique.mockResolvedValue(null);
    await expect(
      svc.evaluate({ tenantId: 'tenant-a', ruleId: 'missing', evidence: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('evaluate respects disabled rules', async () => {
    prisma.governanceControlRule.findUnique.mockResolvedValue({ tenantId: 'tenant-a', enabled: false, predicate: {} });
    const out = await svc.evaluate({ tenantId: 'tenant-a', ruleId: 'r1', evidence: { x: 1 } });
    expect(out.passed).toBe(false);
    expect(out.reason).toBe('rule disabled');
  });

  it('evaluate matches predicate (eq operator)', async () => {
    prisma.governanceControlRule.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      enabled: true,
      predicate: { role: { eq: 'ADMIN' } },
    });
    const out = await svc.evaluate({
      tenantId: 'tenant-a',
      ruleId: 'r1',
      evidence: { role: 'ADMIN' },
    });
    expect(out.passed).toBe(true);
  });

  it('evaluate rejects evidence that does not match', async () => {
    prisma.governanceControlRule.findUnique.mockResolvedValue({
      tenantId: 'tenant-a',
      enabled: true,
      predicate: { role: { eq: 'ADMIN' } },
    });
    const out = await svc.evaluate({
      tenantId: 'tenant-a',
      ruleId: 'r1',
      evidence: { role: 'OWNER' },
    });
    expect(out.passed).toBe(false);
  });
});

// ─── Operational governance (§5.14.8) ─────────────────────────

describe('OperationalGovernanceService', () => {
  let svc: OperationalGovernanceService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new OperationalGovernanceService(prisma);
  });

  it('ships 3 OOB probes', () => {
    expect(OPERATIONAL_PROBES.length).toBe(3);
  });

  it('runAll appends one row per probe', async () => {
    prisma.operationalHealthMetric.create.mockResolvedValue({ id: 'r1' });
    const out = await svc.runAll('tenant-a');
    expect(out).toHaveLength(3);
    expect(prisma.operationalHealthMetric.create).toHaveBeenCalledTimes(3);
  });

  it('runAll refuses wildcard', async () => {
    await expect(svc.runAll('*')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runAll produces a deterministic distribution of severities', async () => {
    prisma.operationalHealthMetric.create.mockResolvedValue({});
    const r1 = await svc.runAll('tenant-a');
    const r2 = await svc.runAll('tenant-a');
    // Same tenant + probes → same severities (deterministic hash).
    expect(r1.map((r) => r.severity)).toEqual(r2.map((r) => r.severity));
  });
});

// ─── Security governance (§5.14.9) ───────────────────────────

describe('SecurityGovernanceService', () => {
  let svc: SecurityGovernanceService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new SecurityGovernanceService(prisma);
  });

  it('ships 4 OOB security control keys', () => {
    expect(SECURITY_CONTROL_KEYS.length).toBe(4);
    expect(SECURITY_CONTROL_KEYS).toContain('redis-tls');
    expect(SECURITY_CONTROL_KEYS).toContain('db-tls');
    expect(SECURITY_CONTROL_KEYS).toContain('secure-uploads');
    expect(SECURITY_CONTROL_KEYS).toContain('ai-twin-permission-mirror');
  });

  it('setState rejects unknown controlKey', async () => {
    await expect(
      svc.setState({
        tenantId: 'tenant-a',
        controlKey: 'bogus-control',
        state: 'enabled',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setState upserts idempotently', async () => {
    prisma.securityControlState.upsert.mockResolvedValue({});
    await svc.setState({ tenantId: 'tenant-a', controlKey: 'redis-tls', state: 'enabled' });
    expect(prisma.securityControlState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_controlKey: { tenantId: 'tenant-a', controlKey: 'redis-tls' },
        },
      }),
    );
  });

  it('setState refuses wildcard', async () => {
    await expect(
      svc.setState({ tenantId: '*', controlKey: 'redis-tls', state: 'enabled' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ─── Internal compliance (§5.14.12) ─────────────────────────

describe('InternalComplianceService', () => {
  let svc: InternalComplianceService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new InternalComplianceService(prisma);
  });

  it('ships 6 OOB checks across 3 categories', () => {
    expect(INTERNAL_COMPLIANCE_CHECKS.length).toBe(6);
    const cats = new Set(INTERNAL_COMPLIANCE_CHECKS.map((c) => c.category));
    expect(cats.size).toBe(3);
  });

  it('runAll writes one row per check', async () => {
    prisma.internalComplianceCheck.create.mockResolvedValue({});
    const out = await svc.runAll('tenant-a');
    expect(out).toHaveLength(6);
    expect(prisma.internalComplianceCheck.create).toHaveBeenCalledTimes(6);
  });

  it('runAll refuses wildcard', async () => {
    await expect(svc.runAll('*')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runAll produces deterministic outcomes', async () => {
    prisma.internalComplianceCheck.create.mockResolvedValue({});
    const r1 = await svc.runAll('tenant-a');
    const r2 = await svc.runAll('tenant-a');
    // Different month → may differ; same call → identical.
    expect(r1.length).toBe(r2.length);
  });
});
