/**
 * Harness Replay - Conformance Tests
 * Phase 2 v2.0: Verifies side-effect firewall, sanitization, replay bundle,
 * network sandbox, disposable tenant, production probe per ADR-003.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  SideEffectFirewall,
  EmailStub,
  WebhookStub,
  DatabaseStub,
  ApiStub,
  SanitizationEngine,
  StubModeSchema,
  ReplayBundleSchema,
  NetworkSandbox,
  DisposableTenantFactory,
  ReplayExecutor,
  ProductionProbe,
  createReplayBundle,
  EnvironmentManifestSchema,
  DEFAULT_NETWORK_SANDBOX,
} from './index';

describe('SideEffectFirewall', () => {
  let firewall: SideEffectFirewall;

  beforeEach(() => {
    firewall = new SideEffectFirewall();
  });

  describe('Default mode is BLOCK (§7.2)', () => {
    it('blocks all external effects by default', async () => {
      await expect(
        firewall.intercept('email', 'send', ['test@example.com'])
      ).rejects.toThrow('[REPLAY BLOCKED]');
    });
  });

  describe('LOG mode', () => {
    it('logs action without executing', async () => {
      firewall.configureStub('email', 'LOG');
      const result = await firewall.intercept('email', 'send', ['test@example.com']);
      expect((result as any).logged).toBe(true);
    });
  });

  describe('SIMULATE mode', () => {
    it('returns simulated response', async () => {
      firewall.configureStub('email', 'SIMULATE');
      const result = await firewall.intercept('email', 'send', ['test@example.com']);
      expect((result as any).simulated).toBe(true);
      expect((result as any).messageId).toBeDefined();
    });
  });

  describe('BLOCK mode', () => {
    it('throws error for blocked action', async () => {
      firewall.configureStub('email', 'BLOCK');
      await expect(firewall.intercept('email', 'send', ['test@example.com']))
        .rejects.toThrow('[REPLAY BLOCKED]');
    });
  });

  describe('verifyNoRealEffects', () => {
    it('detects blocked actions', async () => {
      firewall.configureStub('email', 'BLOCK');
      try { await firewall.intercept('email', 'send', ['test']); } catch {}

      const verification = await firewall.verifyNoRealEffects();
      expect(verification.blockedCount).toBe(1);
    });
  });

  describe('reset', () => {
    it('clears all action tracking', async () => {
      firewall.configureStub('email', 'BLOCK');
      try { await firewall.intercept('email', 'send', ['test']); } catch {}

      firewall.reset();

      const verification = await firewall.verifyNoRealEffects();
      expect(verification.blockedCount).toBe(0);
    });
  });
});

describe('StubModeSchema', () => {
  it('accepts valid modes', () => {
    expect(StubModeSchema.safeParse('LOG').success).toBe(true);
    expect(StubModeSchema.safeParse('SIMULATE').success).toBe(true);
    expect(StubModeSchema.safeParse('BLOCK').success).toBe(true);
  });

  it('rejects ALLOW mode (forbidden by ADR-003)', () => {
    expect(StubModeSchema.safeParse('ALLOW').success).toBe(false);
  });
});

describe('Individual Stubs', () => {
  describe('EmailStub', () => {
    it('returns simulated messageId for send action', async () => {
      const stub = new EmailStub();
      stub.setMode('SIMULATE');
      const result = await stub.intercept('send', ['test@example.com']);
      expect((result as any).messageId).toMatch(/^sim-/);
    });
  });

  describe('WebhookStub', () => {
    it('returns simulated response in SIMULATE mode', async () => {
      const stub = new WebhookStub();
      stub.setMode('SIMULATE');
      const result = await stub.intercept('trigger', ['payload']);
      expect((result as any).simulated).toBe(true);
    });
  });

  describe('DatabaseStub', () => {
    it('returns simulated rowsAffected in SIMULATE mode', async () => {
      const stub = new DatabaseStub();
      stub.setMode('SIMULATE');
      const result = await stub.intercept('insert', ['table', {}]);
      expect((result as any).simulated).toBe(true);
    });
  });

  describe('ApiStub', () => {
    it('returns simulated response in SIMULATE mode', async () => {
      const stub = new ApiStub();
      stub.setMode('SIMULATE');
      const result = await stub.intercept('call', ['endpoint']);
      expect((result as any).simulated).toBe(true);
    });
  });
});

describe('SanitizationEngine', () => {
  const engine = new SanitizationEngine();

  it('preserves tenantId per ADR-003 §2.4', () => {
    const input = { tenantId: 'tenant-123', password: 'secret' };
    const { sanitized } = engine.sanitize(input) as any;
    expect(sanitized.tenantId).toBe('tenant-123');
    expect(sanitized.password).toBe('[REDACTED]');
  });

  it('preserves runId, scenarioId, capabilityId, correlationId', () => {
    const input = {
      tenantId: 'tenant-123',
      runId: 'run-456',
      scenarioId: 'scenario-789',
      capabilityId: 'cap-001',
      correlationId: 'corr-123',
      email: 'test@example.com',
    };
    const { sanitized } = engine.sanitize(input) as any;
    expect(sanitized.tenantId).toBe('tenant-123');
    expect(sanitized.runId).toBe('run-456');
    expect(sanitized.scenarioId).toBe('scenario-789');
    expect(sanitized.capabilityId).toBe('cap-001');
    expect(sanitized.correlationId).toBe('corr-123');
    expect(sanitized.email).toBe('redacted@example.com');
  });

  it('redacts passwords and secrets', () => {
    const input = { username: 'john', password: 'secret123' };
    const { sanitized } = engine.sanitize(input) as any;
    expect(sanitized.password).toBe('[REDACTED]');
  });

  it('handles nested objects recursively', () => {
    const input = {
      user: {
        name: 'John',
        password: 'secret',
        contact: { email: 'john@example.com' },
      },
    };
    const { sanitized } = engine.sanitize(input) as any;
    expect(sanitized.user.name).toBe('[REDACTED-NAME]');
    expect(sanitized.user.password).toBe('[REDACTED]');
  });

  it('handles arrays recursively', () => {
    const input = {
      users: [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ],
    };
    const { sanitized } = engine.sanitize(input) as any;
    expect(sanitized.users[0].email).toBe('redacted@example.com');
  });
});

describe('NetworkSandbox (ADR-003 §4.2)', () => {
  let sandbox: NetworkSandbox;

  beforeEach(() => {
    sandbox = new NetworkSandbox();
  });

  it('blocks internet egress by default', () => {
    const result = sandbox.resolveEgress('internet');
    expect(result.allowed).toBe(false);
  });

  it('blocks production egress', () => {
    const result = sandbox.resolveEgress('production');
    expect(result.allowed).toBe(false);
  });

  it('allows harness-internal egress', () => {
    const result = sandbox.resolveEgress('harness-internal');
    expect(result.allowed).toBe(true);
  });

  it('redirects DNS for known services', () => {
    const result = sandbox.resolveEgress('api.openai.com');
    expect(result.allowed).toBe(true);
    expect(result.redirectedTo).toBeDefined();
  });

  it('records egress decisions', () => {
    sandbox.resolveEgress('internet');
    sandbox.resolveEgress('harness-internal');
    const log = sandbox.getEgressLog();
    expect(log.length).toBe(2);
  });

  it('exposes DEFAULT_NETWORK_SANDBOX', () => {
    expect(DEFAULT_NETWORK_SANDBOX.blockedEgress).toContain('internet');
    expect(DEFAULT_NETWORK_SANDBOX.blockedEgress).toContain('production');
  });
});

describe('DisposableTenantFactory (ADR-003 §4.3)', () => {
  let factory: DisposableTenantFactory;

  beforeEach(() => {
    factory = new DisposableTenantFactory();
  });

  it('creates disposable tenant with TTL', () => {
    const tenant = factory.create({ ttlMs: 60_000 });
    expect(tenant.tenantId).toBeDefined();
    expect(tenant.networkIsolated).toBe(true);
    expect(tenant.syntheticDataOnly).toBe(true);
    expect(tenant.destroyed).toBe(false);
  });

  it('marks disposable tenant active when not destroyed and not expired', () => {
    const tenant = factory.create({ ttlMs: 60_000 });
    expect(factory.isActive(tenant.tenantId)).toBe(true);
  });

  it('destroys disposable tenant', () => {
    const tenant = factory.create();
    factory.destroy(tenant.tenantId);
    expect(factory.isActive(tenant.tenantId)).toBe(false);
  });

  it('returns null for unknown tenant', () => {
    expect(factory.get('unknown')).toBeNull();
  });
});

describe('createReplayBundle (§7.2)', () => {
  it('creates a valid ReplayBundle', () => {
    const envManifest = {
      codeSha: 'a'.repeat(40),
      buildId: 'build-001',
      schemaVersion: '2.0.0',
      harnessVersion: '2.0.0',
      adapterVersions: {},
      nodeVersion: '18.0.0',
      platform: 'linux',
      arch: 'x64',
      environmentClass: 'LOCAL' as const,
    };

    const bundle = createReplayBundle({
      runId: 'run-001',
      scenarioId: 'scenario-001',
      capabilityId: 'cap-001',
      tenantId: 'tenant-001',
      actorId: 'actor-001',
      seed: 'seed-123',
      events: [],
      capturedResponses: [],
      originalResult: { outcome: 'PASSED' },
      modelRefs: [],
      promptRefs: [],
      policyRefs: [],
      toolRefs: [],
      datasetRefs: [],
      featureFlags: {},
      environmentManifest: envManifest,
      expectedAssertions: [],
      disposableTenantId: '00000000-0000-0000-0000-000000000001',
      createdBy: 'system',
    });

    expect(bundle.bundleId).toBeDefined();
    expect(bundle.disposableTenantId).toBe('00000000-0000-0000-0000-000000000001');
    expect(bundle.checksumManifest.bundle).toMatch(/^sha256:/);
    expect(bundle.redactionAttestation).toBeDefined();
  });

  it('produces checksum manifest for all required fields', () => {
    const envManifest = {
      codeSha: 'a'.repeat(40),
      buildId: 'build-001',
      schemaVersion: '2.0.0',
      harnessVersion: '2.0.0',
      adapterVersions: {},
      nodeVersion: '18.0.0',
      platform: 'linux',
      arch: 'x64',
      environmentClass: 'CI' as const,
    };

    const bundle = createReplayBundle({
      runId: 'run-001',
      scenarioId: 's-1',
      capabilityId: 'c-1',
      tenantId: 'tenant-001',
      actorId: 'a-1',
      seed: 'seed',
      events: [],
      capturedResponses: [],
      originalResult: { outcome: 'FAILED', error: 'something' },
      modelRefs: [],
      promptRefs: [],
      policyRefs: [],
      toolRefs: [],
      datasetRefs: [],
      featureFlags: {},
      environmentManifest: envManifest,
      expectedAssertions: [],
      disposableTenantId: '00000000-0000-0000-0000-000000000002',
      createdBy: 'system',
    });

    expect(bundle.checksumManifest.inputs).toMatch(/^sha256:/);
    expect(bundle.checksumManifest.context).toMatch(/^sha256:/);
    expect(bundle.checksumManifest.events).toMatch(/^sha256:/);
    expect(bundle.checksumManifest.responses).toMatch(/^sha256:/);
    expect(bundle.checksumManifest.assertions).toMatch(/^sha256:/);
    expect(bundle.checksumManifest.result).toMatch(/^sha256:/);
    expect(bundle.checksumManifest.bundle).toMatch(/^sha256:/);
  });
});

describe('EnvironmentManifestSchema (§5.2 explicit provenance)', () => {
  it('requires codeSha', () => {
    const invalid = {
      buildId: 'b-1',
      schemaVersion: '1.0.0',
      harnessVersion: '1.0.0',
      adapterVersions: {},
      nodeVersion: '18',
      platform: 'linux',
      arch: 'x64',
      environmentClass: 'LOCAL',
    };
    expect(EnvironmentManifestSchema.safeParse(invalid).success).toBe(false);
  });

  it('requires buildId', () => {
    const invalid = {
      codeSha: 'a'.repeat(40),
      schemaVersion: '1.0.0',
      harnessVersion: '1.0.0',
      adapterVersions: {},
      nodeVersion: '18',
      platform: 'linux',
      arch: 'x64',
      environmentClass: 'LOCAL',
    };
    expect(EnvironmentManifestSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('ReplayBundleSchema (§7.2)', () => {
  it('requires disposableTenantId per ADR-003 §4.3', () => {
    const bundle: any = {
      bundleId: '00000000-0000-0000-0000-000000000000',
      schemaVersion: '2.0.0',
      createdAt: new Date().toISOString(),
      createdBy: 'test',
      inputs: {
        tenantId: 't-1',
        actorId: 'a-1',
        request: 'r',
        parameters: {},
      },
      context: {
        runId: 'r-1',
        scenarioId: 's-1',
        capabilityId: 'c-1',
        seed: 'seed',
        featureFlags: {},
        faultSchedule: null,
      },
      events: [],
      expectedAssertions: [],
      originalResult: { outcome: 'PASSED' },
      modelRefs: [],
      promptRefs: [],
      policyRefs: [],
      toolRefs: [],
      datasetRefs: [],
      environmentManifest: {
        codeSha: 'a'.repeat(40),
        buildId: 'b-1',
        schemaVersion: '2.0.0',
        harnessVersion: '2.0.0',
        adapterVersions: {},
        nodeVersion: '18',
        platform: 'linux',
        arch: 'x64',
        environmentClass: 'LOCAL',
      },
      compatibilityVersion: '2.0.0',
      timestamps: {
        bundleCreated: new Date().toISOString(),
        runStarted: new Date().toISOString(),
        runCompleted: new Date().toISOString(),
      },
      faultSchedule: null,
      randomSeed: 'seed',
      featureFlags: {},
      capturedResponses: [],
      // no disposableTenantId
      checksumManifest: {
        inputs: 'sha256:a',
        context: 'sha256:a',
        events: 'sha256:a',
        responses: 'sha256:a',
        assertions: 'sha256:a',
        result: 'sha256:a',
        bundle: 'sha256:a',
      },
      redactionAttestation: {
        redactedAt: new Date().toISOString(),
        redactedBy: 'test',
        fieldsRedacted: [],
        fieldsPreserved: [],
        attestation: 'test',
      },
    };
    const result = ReplayBundleSchema.safeParse(bundle);
    expect(result.success).toBe(false);
  });
});

describe('ReplayExecutor (ADR-003 §4.3)', () => {
  it('verifies side-effect firewall blocks external effects', async () => {
    const firewall = new SideEffectFirewall();
    firewall.configureAllStubs('BLOCK');
    const executor = new ReplayExecutor(
      firewall,
      new NetworkSandbox(),
      new DisposableTenantFactory(),
    );

    const tenant = executor.getDisposableFactory().create();
    const envManifest = {
      codeSha: 'a'.repeat(40),
      buildId: 'b-1',
      schemaVersion: '2.0.0',
      harnessVersion: '2.0.0',
      adapterVersions: {},
      nodeVersion: '18',
      platform: 'linux',
      arch: 'x64',
      environmentClass: 'LOCAL' as const,
    };

    const bundle = createReplayBundle({
      runId: 'r-1',
      scenarioId: 's-1',
      capabilityId: 'c-1',
      tenantId: tenant.tenantId,
      actorId: 'a-1',
      seed: 'seed',
      events: [],
      capturedResponses: [],
      originalResult: { outcome: 'PASSED' },
      modelRefs: [],
      promptRefs: [],
      policyRefs: [],
      toolRefs: [],
      datasetRefs: [],
      featureFlags: {},
      environmentManifest: envManifest,
      expectedAssertions: [],
      disposableTenantId: tenant.tenantId,
      createdBy: 'system',
    });

    const auth = {
      actorId: 'replay-admin',
      actorType: 'SYSTEM' as const,
      actorRoles: ['SYSTEM'] as any,
      tenantId: tenant.tenantId,
      correlationId: 'c-1',
      permissions: ['replay:execute'] as any,
    };

    const result = await executor.execute(bundle, auth);
    expect(result.disposableTenantId).toBe(tenant.tenantId);
  });

  it('denies execution without replay:execute permission', async () => {
    const executor = new ReplayExecutor();
    const tenant = executor.getDisposableFactory().create();
    const envManifest = {
      codeSha: 'a'.repeat(40),
      buildId: 'b-1',
      schemaVersion: '2.0.0',
      harnessVersion: '2.0.0',
      adapterVersions: {},
      nodeVersion: '18',
      platform: 'linux',
      arch: 'x64',
      environmentClass: 'LOCAL' as const,
    };

    const bundle = createReplayBundle({
      runId: 'r-1',
      scenarioId: 's-1',
      capabilityId: 'c-1',
      tenantId: tenant.tenantId,
      actorId: 'a-1',
      seed: 'seed',
      events: [],
      capturedResponses: [],
      originalResult: { outcome: 'PASSED' },
      modelRefs: [],
      promptRefs: [],
      policyRefs: [],
      toolRefs: [],
      datasetRefs: [],
      featureFlags: {},
      environmentManifest: envManifest,
      expectedAssertions: [],
      disposableTenantId: tenant.tenantId,
      createdBy: 'system',
    });

    const auth = {
      actorId: 'u',
      actorType: 'HUMAN' as const,
      actorRoles: ['TENANT_USER'] as any,
      tenantId: tenant.tenantId,
      correlationId: 'c-1',
      permissions: [] as any,
    };

    await expect(executor.execute(bundle, auth)).rejects.toThrow('lacks permission replay:execute');
  });
});

describe('ProductionProbe (ADR-003 §5)', () => {
  it('rejects non-GET methods', () => {
    const probe = new ProductionProbe();
    expect(() => probe.assertReadOnly('/api/evidence/list', 'POST')).toThrow('read-only');
  });

  it('rejects endpoints not in allowlist', () => {
    const probe = new ProductionProbe();
    expect(() => probe.assertReadOnly('/api/admin/secret', 'GET')).toThrow('not in allowedReadEndpoints');
  });

  it('allows read endpoints with GET method', () => {
    const probe = new ProductionProbe();
    expect(() => probe.assertReadOnly('/api/evidence/list', 'GET')).not.toThrow();
  });

  it('is always read-only', () => {
    const probe = new ProductionProbe();
    expect(probe.isReadOnly()).toBe(true);
  });
});