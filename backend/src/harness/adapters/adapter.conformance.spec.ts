/**
 * Harness Adapters - Conformance Tests
 * Phase 1: Verifies adapter module meets heterogeneous execution contracts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AdapterType,
  JestTestAdapter,
  PlaywrightTestAdapter,
  CertificationTestAdapter,
  SimulationTestAdapter,
  createAdapter,
  AdapterRegistry,
  runAdapterConformance,
  ITestAdapter,
} from './index';
import { ScenarioManifestSchema } from '../contracts';
import { createTenantContext } from '../orchestrator';

const VALID_SCENARIO = {
  schemaVersion: '1.0.0',
  scenarioId: 'SCN-TEST-001',
  scenarioVersion: '1.0.0',
  capabilityIds: ['CAP-001'],
  riskTier: 'CRITICAL' as const,
  executionMode: 'DETERMINISTIC' as const,
  environmentClass: 'CI' as const,
  requiredFeatures: [],
  requiredDatasets: [],
  steps: [
    {
      stepId: 'step-001',
      name: 'Test Step',
      adapter: 'jest',
    },
  ],
  assertions: [
    {
      assertionId: 'assert-001',
      name: 'Test Assertion',
      type: 'DETERMINISTIC' as const,
      expression: 'true === true',
    },
  ],
  cleanupPolicy: {
    cleanupPolicy: 'IMMEDIATE' as const,
    timeout: 60000,
  },
  evidencePolicy: {
    retentionClass: 'MEDIUM_TERM' as const,
    classification: 'INTERNAL' as const,
    redactionRequired: false,
  },
};

describe('Adapter Configurations', () => {
  describe('JestTestAdapter', () => {
    it('creates adapter with correct type', () => {
      const adapter = new JestTestAdapter({
        name: 'jest-adapter',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });

      expect(adapter.type).toBe(AdapterType.JEST);
      expect(adapter.config.name).toBe('jest-adapter');
    });
  });

  describe('PlaywrightTestAdapter', () => {
    it('creates adapter with correct type', () => {
      const adapter = new PlaywrightTestAdapter({
        name: 'playwright-adapter',
        type: AdapterType.PLAYWRIGHT,
        version: '1.0.0',
        timeoutMs: 120000,
        retries: 1,
        environmentClass: 'CI',
        browserType: 'chromium',
        viewport: { width: 1920, height: 1080 },
      });

      expect(adapter.type).toBe(AdapterType.PLAYWRIGHT);
      expect(adapter.config.browserType).toBe('chromium');
    });
  });

  describe('CertificationTestAdapter', () => {
    it('creates adapter with correct type', () => {
      const adapter = new CertificationTestAdapter({
        name: 'certification-adapter',
        type: AdapterType.CERTIFICATION,
        version: '1.0.0',
        timeoutMs: 300000,
        retries: 0,
        environmentClass: 'CI',
        suitePath: 'backend/src/test/certification/',
        reportDir: 'backend/src/test/certification/reports/',
      });

      expect(adapter.type).toBe(AdapterType.CERTIFICATION);
      expect(adapter.config.suitePath).toContain('certification');
    });
  });

  describe('SimulationTestAdapter', () => {
    it('creates adapter with FE-first mode', () => {
      const adapter = new SimulationTestAdapter({
        name: 'simulation-adapter',
        type: AdapterType.SIMULATION,
        version: '1.0.0',
        timeoutMs: 600000,
        retries: 0,
        environmentClass: 'CI',
        simulationPath: 'simulations/SIM-04/',
        feFirstMode: true,
      });

      expect(adapter.type).toBe(AdapterType.SIMULATION);
      expect(adapter.config.feFirstMode).toBe(true);
    });
  });
});

describe('createAdapter factory', () => {
  it('creates JestTestAdapter for JEST type', () => {
    const adapter = createAdapter({
      name: 'jest',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    expect(adapter.type).toBe(AdapterType.JEST);
  });

  it('creates PlaywrightTestAdapter for PLAYWRIGHT type', () => {
    const adapter = createAdapter({
      name: 'playwright',
      type: AdapterType.PLAYWRIGHT,
      version: '1.0.0',
      timeoutMs: 120000,
      retries: 0,
      environmentClass: 'CI',
    });

    expect(adapter.type).toBe(AdapterType.PLAYWRIGHT);
  });

  it('creates CertificationTestAdapter for CERTIFICATION type', () => {
    const adapter = createAdapter({
      name: 'certification',
      type: AdapterType.CERTIFICATION,
      version: '1.0.0',
      timeoutMs: 300000,
      retries: 0,
      environmentClass: 'CI',
      suitePath: 'test/',
      reportDir: 'reports/',
    });

    expect(adapter.type).toBe(AdapterType.CERTIFICATION);
  });

  it('creates SimulationTestAdapter for SIMULATION type', () => {
    const adapter = createAdapter({
      name: 'simulation',
      type: AdapterType.SIMULATION,
      version: '1.0.0',
      timeoutMs: 600000,
      retries: 0,
      environmentClass: 'CI',
      simulationPath: 'sim/',
      feFirstMode: true,
    });

    expect(adapter.type).toBe(AdapterType.SIMULATION);
  });

  it('throws for unknown adapter type', () => {
    expect(() =>
      createAdapter({
        name: 'unknown',
        type: 'UNKNOWN' as AdapterType,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
      }),
    ).toThrow();
  });
});

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('registers and retrieves adapter', () => {
    const adapter = createAdapter({
      name: 'jest-adapter',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    registry.register('jest-adapter', adapter);
    expect(registry.get('jest-adapter')?.config.name).toBe('jest-adapter');
  });

  it('throws when registering duplicate name', () => {
    const adapter = createAdapter({
      name: 'jest-adapter',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    registry.register('jest-adapter', adapter);
    expect(() => registry.register('jest-adapter', adapter)).toThrow();
  });

  it('getByType returns all adapters of a type', () => {
    const jestAdapter = createAdapter({
      name: 'jest',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    const certAdapter = createAdapter({
      name: 'certification',
      type: AdapterType.CERTIFICATION,
      version: '1.0.0',
      timeoutMs: 300000,
      retries: 0,
      environmentClass: 'CI',
      suitePath: 'test/',
      reportDir: 'reports/',
    });

    registry.register('jest', jestAdapter);
    registry.register('certification', certAdapter);

    const jestAdapters = registry.getByType(AdapterType.JEST);
    expect(jestAdapters).toHaveLength(1);
    expect(jestAdapters[0].type).toBe(AdapterType.JEST);
  });

  it('list returns all registered adapters', () => {
    registry.register(
      'jest',
      createAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      }),
    );

    registry.register(
      'playwright',
      createAdapter({
        name: 'playwright',
        type: AdapterType.PLAYWRIGHT,
        version: '1.0.0',
        timeoutMs: 120000,
        retries: 0,
        environmentClass: 'CI',
      }),
    );

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((a) => a.type).sort()).toEqual(['JEST', 'PLAYWRIGHT']);
  });

  it('destroyAll calls destroy on each adapter', async () => {
    const adapter = createAdapter({
      name: 'jest',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    registry.register('jest', adapter);
    await registry.destroyAll();

    expect(registry.list()).toHaveLength(0);
  });
});

describe('Adapter Execution', () => {
  const tenantCtx = createTenantContext('550e8400-e29b-41d4-a716-446655440099', 'actor-test', 'HUMAN');

  describe('JestTestAdapter execution', () => {
    it('executes scenario and returns result', async () => {
      const adapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });

      await adapter.initialize();

      const result = await adapter.execute(VALID_SCENARIO, tenantCtx);

      expect(result.runId).toMatch(/^jest-/);
      expect(result.scenarioId).toBe('SCN-TEST-001');
      expect(result.capabilityIds).toEqual(['CAP-001']);
      expect(['PASSED', 'FAILED']).toContain(result.outcome);
      expect(result.assertionResults.length).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      await adapter.destroy();
    });
  });

  describe('CertificationTestAdapter execution', () => {
    it('creates evidence envelope with scenarioId/capabilityId', async () => {
      const adapter = new CertificationTestAdapter({
        name: 'certification',
        type: AdapterType.CERTIFICATION,
        version: '1.0.0',
        timeoutMs: 300000,
        retries: 0,
        environmentClass: 'CI',
        suitePath: 'test/',
        reportDir: 'reports/',
      });

      await adapter.initialize();

      const result = await adapter.execute(VALID_SCENARIO, tenantCtx);

      expect(result.runId).toMatch(/^cert-/);
      expect(result.evidenceRefs.length).toBeGreaterThan(0);
      expect(result.evidenceRefs[0].evidenceId).toBeDefined();
      expect(result.evidenceRefs[0].checksum).toMatch(/^sha256:/);

      await adapter.destroy();
    });
  });

  describe('SimulationTestAdapter execution', () => {
    it('executes with FE-first mode set', async () => {
      const adapter = new SimulationTestAdapter({
        name: 'simulation',
        type: AdapterType.SIMULATION,
        version: '1.0.0',
        timeoutMs: 600000,
        retries: 0,
        environmentClass: 'CI',
        simulationPath: 'sim/',
        feFirstMode: true,
      });

      await adapter.initialize();

      const result = await adapter.execute(VALID_SCENARIO, tenantCtx);

      expect(result.runId).toMatch(/^sim-/);
      expect(result.evidenceRefs.length).toBeGreaterThan(0);

      await adapter.destroy();
    });
  });

  describe('Heterogeneous execution (two different adapters)', () => {
    it('Jest and Certification adapters produce compatible result shape', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });

      const certAdapter = new CertificationTestAdapter({
        name: 'certification',
        type: AdapterType.CERTIFICATION,
        version: '1.0.0',
        timeoutMs: 300000,
        retries: 0,
        environmentClass: 'CI',
        suitePath: 'test/',
        reportDir: 'reports/',
      });

      await jestAdapter.initialize();
      await certAdapter.initialize();

      const jestResult = await jestAdapter.execute(VALID_SCENARIO, tenantCtx);
      const certResult = await certAdapter.execute(VALID_SCENARIO, tenantCtx);

      expect(jestResult.runId).toMatch(/^jest-/);
      expect(certResult.runId).toMatch(/^cert-/);
      expect(jestResult.outcome).toBeDefined();
      expect(certResult.outcome).toBeDefined();
      expect(jestResult.assertionResults).toBeDefined();
      expect(certResult.assertionResults).toBeDefined();
      expect(jestResult.evidenceRefs).toBeDefined();
      expect(certResult.evidenceRefs).toBeDefined();

      await jestAdapter.destroy();
      await certAdapter.destroy();
    });
  });
});

describe('runAdapterConformance', () => {
  it('runs basic conformance tests on adapter', async () => {
    const adapter = new JestTestAdapter({
      name: 'jest-conformance',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    const result = await runAdapterConformance(adapter);

    expect(result.adapterName).toBe('jest-conformance');
    expect(Array.isArray(result.tests)).toBe(true);
    expect(result.tests.some((t) => t.name === 'initialize')).toBe(true);
    expect(result.tests.some((t) => t.name === 'destroy')).toBe(true);
  });
});

describe('Cancellation', () => {
  it('cancel sets cancelled flag', async () => {
    const adapter = new JestTestAdapter({
      name: 'jest',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    await adapter.initialize();
    await adapter.cancel('run-001');
    expect(adapter.isCancelled('run-001')).toBe(true);
    await adapter.destroy();
  });

  it('clearCancelled clears flag', async () => {
    const adapter = new JestTestAdapter({
      name: 'jest',
      type: AdapterType.JEST,
      version: '1.0.0',
      timeoutMs: 60000,
      retries: 0,
      environmentClass: 'CI',
      testMatchPatterns: ['**/*.spec.ts'],
    });

    await adapter.initialize();
    await adapter.cancel('run-001');
    adapter.clearCancelled('run-001');
    expect(adapter.isCancelled('run-001')).toBe(false);
    await adapter.destroy();
  });
});
