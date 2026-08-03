/**
 * Phase 3 — Fixtures Module Conformance
 *
 * Validates:
 *   - Deterministic ID factories (§5.2 "IDs ... controllable")
 *   - Frozen clock advances deterministically
 *   - Seeded RNG is reproducible
 *   - Tenant provisioner tracks resources and reports teardown failures
 *   - Builders compose with overrides and produce many records
 *   - Flake classification (§11 gate rules)
 *   - Cleanup reliability threshold enforcement
 */

import {
  FixturePackage,
  FrozenClock,
  SeededRng,
  SequentialIdFactory,
  InMemoryTenantProvisioner,
  UserBuilder,
  ProjectBuilder,
  classifyFlakiness,
  computeCleanupMetrics,
  FlakeObservationSchema,
  TeardownReportSchema,
  buildAuthContext,
  fixtureChecksum,
  DeterministicIdSchema,
  FlakeThresholdsSchema,
  DEFAULT_CLEANUP_THRESHOLDS,
} from './index';

describe('harness/fixtures — FrozenClock', () => {
  it('starts at epoch by default', () => {
    const c = new FrozenClock();
    expect(c.now().toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });

  it('honors initialIso', () => {
    const c = new FrozenClock('2026-01-01T00:00:00.000Z');
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('advances deterministically', () => {
    const c = new FrozenClock('2026-01-01T00:00:00.000Z');
    c.advance(1_000);
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:01.000Z');
  });

  it('returns a copy, not the internal date', () => {
    const c = new FrozenClock('2026-01-01T00:00:00.000Z');
    const a = c.now();
    a.setUTCFullYear(1999);
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('resets to epoch', () => {
    const c = new FrozenClock('2026-01-01T00:00:00.000Z');
    c.reset();
    expect(c.now().toISOString()).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('harness/fixtures — SeededRng', () => {
  it('produces identical sequences from the same seed', () => {
    const a = new SeededRng('fixture-seed');
    const b = new SeededRng('fixture-seed');
    const seqA = Array.from({ length: 10 }, () => a.nextInt(0, 100));
    const seqB = Array.from({ length: 10 }, () => b.nextInt(0, 100));
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences from different seeds', () => {
    const a = new SeededRng('alpha');
    const b = new SeededRng('beta');
    expect(a.nextInt(0, 1_000_000)).not.toEqual(b.nextInt(0, 1_000_000));
  });

  it('respects min/max bounds for nextInt', () => {
    const r = new SeededRng('b');
    for (let i = 0; i < 100; i++) {
      const n = r.nextInt(5, 5);
      expect(n).toBe(5);
    }
  });

  it('throws on inverted bounds', () => {
    const r = new SeededRng('c');
    expect(() => r.nextInt(10, 0)).toThrow();
  });

  it('throws when picking from an empty array', () => {
    const r = new SeededRng('d');
    expect(() => r.pick([])).toThrow();
  });

  it('pick returns an element from the input', () => {
    const r = new SeededRng('e');
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
  });

  it('nextString produces alphanumeric strings of the requested length', () => {
    const r = new SeededRng('f');
    expect(r.nextString(20)).toHaveLength(20);
    expect(r.nextString(20)).toMatch(/^[a-z0-9]+$/);
  });
});

describe('harness/fixtures — SequentialIdFactory', () => {
  it('produces monotonically increasing ids', () => {
    const f = new SequentialIdFactory();
    const a = f.next('thing');
    const b = f.next('thing');
    const c = f.next('thing');
    expect(a).toBe('thing-00000001');
    expect(b).toBe('thing-00000002');
    expect(c).toBe('thing-00000003');
  });

  it('resets the counter', () => {
    const f = new SequentialIdFactory();
    f.next('t');
    f.reset();
    expect(f.next('t')).toBe('t-00000001');
  });

  it('produces ids that satisfy DeterministicIdSchema', () => {
    const f = new SequentialIdFactory();
    expect(DeterministicIdSchema.parse(f.next('p'))).toBe('p-00000001');
  });
});

describe('harness/fixtures — Tenant Provisioner', () => {
  it('provisions tenants and tracks resources', () => {
    const t = new InMemoryTenantProvisioner();
    const tenant = t.provision({ name: 'A', industry: 'healthcare' });
    t.registerResource(tenant.tenantId, 'r1');
    t.registerResource(tenant.tenantId, 'r2');
    expect(t.list()).toHaveLength(1);
    const report = t.teardown(tenant.tenantId);
    expect(report).toMatchObject({ success: true, removed: 1, orphaned: [] });
    expect(t.list()).toHaveLength(0);
  });

  it('reports unknown tenant teardown as a failure', () => {
    const t = new InMemoryTenantProvisioner();
    const report = t.teardown('does-not-exist');
    expect(report.success).toBe(false);
    expect(report.failures.length).toBe(1);
  });

  it('TeardownReportSchema validates a successful report', () => {
    const r = TeardownReportSchema.parse({
      tenantId: 't',
      removed: 1,
      orphaned: [],
      failures: [],
      durationMs: 12,
      success: true,
    });
    expect(r.success).toBe(true);
  });

  it('produces a tenant with a future-proof schema', () => {
    const t = new InMemoryTenantProvisioner();
    const tenant = t.provision({ industry: 'accounting' });
    expect(tenant.isolationTier).toBe('STANDARD');
    expect(tenant.featureFlags).toEqual({});
    expect(tenant.tenantId).toMatch(/^tnt-[0-9a-f]{8,}$/);
  });

  it('respects isolationTier override', () => {
    const t = new InMemoryTenantProvisioner();
    const tenant = t.provision({ isolationTier: 'DISPOSABLE' });
    expect(tenant.isolationTier).toBe('DISPOSABLE');
  });
});

describe('harness/fixtures — Builders', () => {
  it('UserBuilder composes overrides', () => {
    const idFactory = new SequentialIdFactory('user');
    const builder = new UserBuilder(idFactory, 'tnt-1', {
      email: 'alice@example.com',
      role: 'TENANT_ADMIN',
    });
    const user = builder.build();
    expect(user.tenantId).toBe('tnt-1');
    expect(user.email).toBe('alice@example.com');
    expect(user.role).toBe('TENANT_ADMIN');
    expect(user.userId).toMatch(/^usr-[0-9a-f]{8,}$/);
  });

  it('ProjectBuilder.buildMany respects count', () => {
    const idFactory = new SequentialIdFactory('proj');
    const projects = new ProjectBuilder(idFactory, 'tnt-1', 'usr-1').buildMany(
      5,
    );
    expect(projects).toHaveLength(5);
    for (const p of projects) {
      expect(p.tenantId).toBe('tnt-1');
      expect(p.ownerId).toBe('usr-1');
    }
  });

  it('ProjectBuilder.buildMany rejects negative counts', () => {
    const idFactory = new SequentialIdFactory('proj');
    const builder = new ProjectBuilder(idFactory, 'tnt-1', 'usr-1');
    expect(() => builder.buildMany(-1)).toThrow();
  });
});

describe('harness/fixtures — FixturePackage', () => {
  it('is fully reproducible with the same seed', () => {
    const a = new FixturePackage({ seed: 'p3' });
    const b = new FixturePackage({ seed: 'p3' });
    const tA = a.tenants.provision();
    const tB = b.tenants.provision();
    expect(tA.tenantId).toBe(tB.tenantId);
    const uA = a.user(tA.tenantId).with({ email: 'x@x.com' }).build();
    const uB = b.user(tB.tenantId).with({ email: 'x@x.com' }).build();
    expect(uA.userId).toBe(uB.userId);
  });

  it('disposeAll clears all tenants', () => {
    const pkg = new FixturePackage();
    pkg.tenants.provision();
    pkg.tenants.provision();
    const report = pkg.disposeAll();
    expect(pkg.tenants.list()).toHaveLength(0);
    expect(report.removed).toBe(2);
  });
});

describe('harness/fixtures — Flake Classification (§11)', () => {
  const at = (i: number) =>
    `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`;

  it('classifies all-pass as STABLE_PASS', () => {
    const obs = Array.from({ length: 10 }, (_, i) =>
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: `r${i}`,
        observedAt: at(i),
        outcome: 'PASSED',
        flakeSuspected: false,
      }),
    );
    expect(classifyFlakiness(obs)).toBe('STABLE_PASS');
  });

  it('classifies all-fail as STABLE_FAIL', () => {
    const obs = Array.from({ length: 10 }, (_, i) =>
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: `r${i}`,
        observedAt: at(i),
        outcome: 'FAILED',
        flakeSuspected: false,
      }),
    );
    expect(classifyFlakiness(obs)).toBe('STABLE_FAIL');
  });

  it('classifies mixed outcomes as FLAKY', () => {
    const obs = [
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r1',
        observedAt: at(1),
        outcome: 'PASSED',
      }),
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r2',
        observedAt: at(2),
        outcome: 'FAILED',
      }),
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r3',
        observedAt: at(3),
        outcome: 'PASSED',
      }),
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r4',
        observedAt: at(4),
        outcome: 'PASSED',
      }),
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r5',
        observedAt: at(5),
        outcome: 'FAILED',
      }),
    ];
    expect(classifyFlakiness(obs)).toBe('FLAKY');
  });

  it('classifies insufficient sample size', () => {
    const obs = [
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r1',
        observedAt: at(1),
        outcome: 'PASSED',
      }),
    ];
    expect(classifyFlakiness(obs)).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('custom thresholds are respected', () => {
    const t = FlakeThresholdsSchema.parse({
      minPassRateForStable: 0.5,
      minSampleSize: 2,
    });
    const obs = [
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r1',
        observedAt: at(1),
        outcome: 'PASSED',
      }),
      FlakeObservationSchema.parse({
        scenarioId: 's',
        runId: 'r2',
        observedAt: at(2),
        outcome: 'FAILED',
      }),
    ];
    expect(classifyFlakiness(obs, t)).toBe('STABLE_PASS');
  });
});

describe('harness/fixtures — Cleanup Reliability Metrics (§10 Phase 3 exit)', () => {
  it('passes when no orphans and no failures', () => {
    const reports = [
      TeardownReportSchema.parse({
        tenantId: 't1',
        removed: 1,
        orphaned: [],
        failures: [],
        durationMs: 1,
        success: true,
      }),
    ];
    const m = computeCleanupMetrics(reports);
    expect(m.passesReliabilityThreshold).toBe(true);
    expect(m.orphanRate).toBe(0);
  });

  it('fails when orphans are detected', () => {
    const reports = [
      TeardownReportSchema.parse({
        tenantId: 't1',
        removed: 1,
        orphaned: ['r1'],
        failures: [],
        durationMs: 1,
        success: false,
      }),
    ];
    const m = computeCleanupMetrics(reports);
    expect(m.passesReliabilityThreshold).toBe(false);
    expect(m.orphanRate).toBe(1);
  });

  it('treats empty report list as not meeting minRuns', () => {
    const m = computeCleanupMetrics([]);
    expect(m.passesReliabilityThreshold).toBe(false);
  });

  it('default thresholds are exported', () => {
    expect(DEFAULT_CLEANUP_THRESHOLDS.maxOrphanRate).toBe(0);
    expect(DEFAULT_CLEANUP_THRESHOLDS.maxFailureRate).toBeLessThanOrEqual(0.05);
  });
});

describe('harness/fixtures — Auth + Checksum helpers', () => {
  it('buildAuthContext fills sensible defaults', () => {
    const ctx = buildAuthContext();
    expect(ctx.actorId).toBe('fixture-actor');
    expect(ctx.actorRoles).toContain('SYSTEM');
    expect(ctx.permissions).toContain('evidence:read');
  });

  it('buildAuthContext respects overrides', () => {
    const ctx = buildAuthContext({ actorId: 'a1' });
    expect(ctx.actorId).toBe('a1');
  });

  it('fixtureChecksum produces a sha256: prefixed string', () => {
    const cs = fixtureChecksum('payload');
    expect(cs).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('fixtureChecksum is deterministic', () => {
    expect(fixtureChecksum('abc')).toBe(fixtureChecksum('abc'));
  });
});
