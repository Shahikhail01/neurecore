/* eslint-disable @typescript-eslint/no-unsafe-call --
 * Inline test-only adapter object literals call this.X() to swap
 * individual boundaries; the surrounding describe blocks already
 * exercise the BoundaryAdapter contract.
 */
// src/modules/service-gateway-v2/certification/tenant-isolation-probe.spec.ts
/**
 * Unit tests for the Phase 7 Tenant Isolation Probe harness.
 *
 * These tests run without a database. They exercise the runner
 * against the default in-memory adapters and verify:
 *   - Every boundary returns `denied: true` for default fixtures.
 *   - The runner emits a `gateG7` summary with `releaseApproved=true`.
 *   - Unknown boundaries fail closed (`allowed: false`).
 *   - Probe adapters can be swapped for custom implementations.
 *   - Channel mapping store seeds resolve only inside the seeded tenant.
 */

import {
  TenantIsolationProbeRunner,
  defaultProbeAdapters,
  InMemoryChannelMappingStore,
  channelsProbeFactory,
  PROBE_BOUNDARIES,
  classifyGateG7,
  TenantIsolationProbeCompat,
  type ProbeAdapters,
  type RouterContextAdapter,
  type ReadGatewayAdapter,
} from './tenant-isolation-probe';
// (ProbeResult type used implicitly via the runner's typed export)

const FIXTURE = {
  tenantA: { id: 'tenant-a', label: 'Tenant A' },
  tenantB: { id: 'tenant-b', label: 'Tenant B' },
  foreignIds: {
    project: 'prj-tenant-b-1',
    task: 'tsk-tenant-b-1',
    executionAttempt: 'wr-tenant-b-1',
    approvalRequest: 'apr-tenant-b-1',
    agent: 'agt-tenant-b-1',
    analyticsSnapshot: 'snap-tenant-b-1',
    webhook: 'wh-tenant-b-1',
    envelope: 'env-tenant-b-1',
    artifact: 'art-tenant-b-1',
  },
  collisions: { projectName: 'Colliding Project' },
};

describe('TenantIsolationProbeRunner', () => {
  it('runs all 12 boundaries with default adapters and denies every cross-tenant attempt', async () => {
    const runner = new TenantIsolationProbeRunner();
    const report = await runner.run(FIXTURE);

    expect(report.results.length).toBe(PROBE_BOUNDARIES.length);
    expect(report.gateG7.totalProbes).toBe(PROBE_BOUNDARIES.length);
    expect(report.gateG7.denied).toBe(PROBE_BOUNDARIES.length);
    expect(report.gateG7.zeroCrossTenantExposure).toBe(true);
    expect(report.gateG7.everyProbeHasEvidence).toBe(true);
    expect(report.gateG7.releaseApproved).toBe(true);

    for (const result of report.results) {
      expect(result.denied).toBe(true);
      expect(result.boundary.length).toBeGreaterThan(0);
      expect(result.tenantId).toBe(FIXTURE.tenantA.id);
      expect(result.evidence.length).toBeGreaterThan(0);
    }
  });

  it('classifies gate G7 into ok/failing buckets', async () => {
    const runner = new TenantIsolationProbeRunner();
    const report = await runner.run(FIXTURE);
    const classification = classifyGateG7(report.gateG7);

    expect(classification.failing).toEqual([]);
    expect(classification.ok.length).toBeGreaterThan(0);
  });

  it('fails closed when an adapter returns denied=false for a foreign ID', async () => {
    const leakyReadGateway: ReadGatewayAdapter = {
      boundary: 'read_gateway',
      async fetch() {
        return { ok: true };
      },
      async probe(ctx) {
        const result = await this.fetch({
          tenantId: ctx.tenantId,
          capability: 'getProject',
          params: {},
        });
        return {
          allowed: !result.ok,
          denied: !result.ok,
          boundary: this.boundary,
          tenantId: ctx.tenantId,
          foreignId: ctx.foreignIds.project,
          errorCode: result.errorCode,
          evidence: result.ok
            ? [`LEAK: foreign project visible to tenant=${ctx.tenantId}`]
            : [`denied for tenant=${ctx.tenantId}`],
        };
      },
    };

    const adapters: ProbeAdapters = {
      ...defaultProbeAdapters(),
      readGateway: leakyReadGateway,
    };
    const runner = new TenantIsolationProbeRunner(adapters);
    const report = await runner.run(FIXTURE);

    const readGateway = report.results.find(
      (r) => r.boundary === 'read_gateway',
    );
    expect(readGateway?.denied).toBe(false);
    expect(readGateway?.evidence[0]).toMatch(/LEAK/);
    expect(report.gateG7.zeroCrossTenantExposure).toBe(false);
    expect(report.gateG7.releaseApproved).toBe(false);
    expect(report.gateG7.failingBoundaries).toContain('read_gateway');
  });

  it('uses channel mapping store to demonstrate tenant-scoped external identity', async () => {
    const store = new InMemoryChannelMappingStore();
    store.seed(FIXTURE.tenantA.id, {
      internalId: 'internal-a-1',
      externalId: `ext-${FIXTURE.tenantA.id}`,
      tenantId: FIXTURE.tenantA.id,
    });
    store.seed(FIXTURE.tenantB.id, {
      internalId: 'internal-b-1',
      externalId: `ext-${FIXTURE.tenantB.id}`,
      tenantId: FIXTURE.tenantB.id,
    });

    const adapters: ProbeAdapters = {
      ...defaultProbeAdapters(),
      channels: channelsProbeFactory(store),
    };
    const runner = new TenantIsolationProbeRunner(adapters);
    const report = await runner.run(FIXTURE);

    const channels = report.results.find((r) => r.boundary === 'channels');
    expect(channels?.denied).toBe(true);
    expect(channels?.evidence.join(' ')).toMatch(
      /cross-tenant mapping not visible/,
    );
  });

  it('replaces router_context adapter when chat composer is wired', async () => {
    const strictRouter: RouterContextAdapter = {
      boundary: 'router_context',
      async compose({ tenantId }) {
        return { effectiveTenantId: tenantId, denied: true };
      },
      async probe(ctx) {
        const result = await this.compose({
          tenantId: ctx.tenantId,
          foreignTenantId: ctx.foreignTenantId,
          message: 'show projects',
          payload: { tenantId: ctx.foreignTenantId },
        });
        return {
          allowed: result.denied,
          denied: result.denied,
          boundary: this.boundary,
          tenantId: ctx.tenantId,
          evidence: [
            `composed with tenant=${result.effectiveTenantId}`,
            result.denied
              ? 'payload could not change effective tenant'
              : `LEAK: payload overrode tenant to ${result.effectiveTenantId}`,
          ],
        };
      },
    };

    const adapters: ProbeAdapters = {
      ...defaultProbeAdapters(),
      routerContext: strictRouter,
    };
    const runner = new TenantIsolationProbeRunner(adapters);
    const report = await runner.run(FIXTURE);

    const router = report.results.find((r) => r.boundary === 'router_context');
    expect(router?.denied).toBe(true);
  });

  it('serializes to JSON without losing shape', async () => {
    const runner = new TenantIsolationProbeRunner();
    const report = await runner.run(FIXTURE);
    const json = JSON.stringify(report);
    const round = JSON.parse(json) as typeof report;

    expect(round.runId).toBe(report.runId);
    expect(round.gateG7.denied).toBe(report.gateG7.denied);
    expect(round.results.length).toBe(report.results.length);
    for (const r of round.results) {
      expect(typeof r.boundary).toBe('string');
      expect(typeof r.tenantId).toBe('string');
      expect(Array.isArray(r.evidence)).toBe(true);
    }
  });
});

describe('TenantIsolationProbeCompat (legacy interface)', () => {
  it('returns fail-closed for unknown boundaries', async () => {
    const compat = new TenantIsolationProbeCompat();
    const result = await compat.execute({
      tenantId: 'tenant-a',
      boundary: 'never_heard_of_it',
    });
    expect(result.allowed).toBe(false);
    expect(result.evidence.join(' ')).toMatch(/Unknown boundary/);
  });

  it('delegates known boundaries through the new adapters', async () => {
    const compat = new TenantIsolationProbeCompat();
    const result = await compat.execute({
      tenantId: 'tenant-a',
      boundary: 'read_gateway',
      foreignId: 'foreign-project',
    });
    expect(result.allowed).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
