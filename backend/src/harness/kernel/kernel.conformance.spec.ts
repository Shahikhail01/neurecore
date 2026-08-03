/**
 * Harness Kernel - Conformance Tests
 * Phase 1: Verifies kernel meets exit criteria
 *   - two heterogeneous suites execute through kernel
 *   - crash recovery tests pass
 *   - idempotency tests pass
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  HarnessKernel,
  ExecutionRequest,
  DEFAULT_KERNEL_CONFIG,
} from './index';
import {
  AdapterType,
  JestTestAdapter,
  CertificationTestAdapter,
  SimulationTestAdapter,
} from '../adapters';
import { ScenarioRecord, CapabilityRecord } from '../catalog';
import { randomUUID } from 'crypto';

const VALID_TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_TENANT_ID_2 = '550e8400-e29b-41d4-a716-446655440002';

function buildCapability(
  id: string,
  name: string,
  category: 'FOUNDATION' | 'AI_QUALITY' | 'EXECUTION' | 'GOVERNANCE' | 'INFRASTRUCTURE',
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
): CapabilityRecord {
  return {
    id,
    elementId: id,
    name,
    category,
    baselineStatus: 'PARTIAL',
    riskTier,
    requiredSuites: ['unit', 'integration'],
    owner: { role: 'Architecture' },
  };
}

function buildScenario(
  scenarioId: string,
  capabilityIds: string[],
  riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
): ScenarioRecord {
  return {
    scenarioId,
    scenarioVersion: '1.0.0',
    name: `Test scenario ${scenarioId}`,
    description: `Tests ${scenarioId}`,
    capabilityIds,
    riskTier,
    executionMode: 'DETERMINISTIC',
    environmentClass: 'CI',
    status: 'EXECUTABLE',
    owner: {
      ownerId: 'user-001',
      ownerRole: 'QA',
      confirmedAt: '2026-08-02T00:00:00.000Z',
    },
  };
}

describe('Harness Kernel', () => {
  let kernel: HarnessKernel;

  beforeEach(() => {
    kernel = new HarnessKernel();
  });

  afterEach(async () => {
    await kernel.destroy();
  });

  describe('Construction', () => {
    it('creates kernel with default config', () => {
      const k = new HarnessKernel();
      expect(k.getOrchestrator()).toBeDefined();
      expect(k.getEvidenceStore()).toBeDefined();
      expect(k.getCatalog()).toBeDefined();
    });

    it('exposes kernel configuration', () => {
      expect(DEFAULT_KERNEL_CONFIG.name).toBe('neurecore-harness-kernel');
      expect(DEFAULT_KERNEL_CONFIG.version).toBe('2.0.0');
      expect(DEFAULT_KERNEL_CONFIG.enableCrashRecovery).toBe(true);
    });

    it('creates kernel with custom config', () => {
      const k = new HarnessKernel({
        defaultTimeoutMs: 60_000,
        defaultMaxRetries: 3,
      });
      expect(k.getOrchestrator()).toBeDefined();
    });
  });

  describe('Catalog Registration', () => {
    it('registers and retrieves capabilities', () => {
      const capability = buildCapability(
        'CAP-TEST-001',
        'Test Capability',
        'FOUNDATION',
        'CRITICAL',
      );
      kernel.registerCapability(capability);
      expect(kernel.getCatalog().getCapability('CAP-TEST-001')).toEqual(capability);
    });

    it('registers multiple capabilities', () => {
      const cap1 = buildCapability('CAP-001', 'Cap 1', 'FOUNDATION', 'HIGH');
      const cap2 = buildCapability('CAP-002', 'Cap 2', 'AI_QUALITY', 'MEDIUM');
      kernel.registerCapability(cap1);
      kernel.registerCapability(cap2);
      expect(kernel.getCatalog().getCapabilitiesByCategory('FOUNDATION').length).toBeGreaterThan(0);
      expect(kernel.getCatalog().getCapabilitiesByCategory('AI_QUALITY').length).toBeGreaterThan(0);
    });
  });

  describe('Adapter Registration', () => {
    it('registers adapters by name', () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      expect(kernel.getAdapterRegistry().get('jest')).toBe(jestAdapter);
    });

    it('supports multiple adapter types', () => {
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

      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerAdapter('certification', certAdapter);

      expect(kernel.getAdapterRegistry().list()).toHaveLength(2);
    });
  });

  describe('Two Heterogeneous Suites Execute Through Kernel', () => {
    /**
     * Phase 1 exit criteria: "two heterogeneous existing suites
     * execute through the kernel without losing native detail"
     *
     * This demonstrates Phase 9 certification suite (Certification adapter)
     * and SIM-04 simulation (Simulation adapter) both executing
     * through the kernel with different characteristics.
     */

    it('executes Phase 9 certification suite through kernel', async () => {
      const certAdapter = new CertificationTestAdapter({
        name: 'phase9-cert',
        type: AdapterType.CERTIFICATION,
        version: '1.0.0',
        timeoutMs: 300000,
        retries: 0,
        environmentClass: 'CI',
        suitePath: 'backend/src/test/certification/',
        reportDir: 'backend/src/test/certification/reports/',
      });

      const capability = buildCapability(
        'CAP-EL-016',
        'Certification Harness (Phase 9)',
        'GOVERNANCE',
        'CRITICAL',
      );
      kernel.registerCapability(capability);

      const scenario = buildScenario('SIM-PHASE9-CERT', ['CAP-EL-016'], 'CRITICAL');
      kernel.getCatalog().registerScenario(scenario);

      kernel.registerAdapter('phase9-cert', certAdapter);

      const request: ExecutionRequest = {
        scenarioId: 'SIM-PHASE9-CERT',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        adapterType: AdapterType.CERTIFICATION,
      };

      const response = await kernel.executeScenario(request);

      expect(response.runId).toMatch(/^run-/);
      expect(response.scenarioId).toBe('SIM-PHASE9-CERT');
      expect(response.capabilityIds).toContain('CAP-EL-016');
      expect(response.outcome).toBe('PASSED');
      expect(response.evidenceCount).toBeGreaterThan(0);
      expect(response.harnessResult.schemaVersion).toBe('1.0.0');
      expect(response.harnessResult.evidenceRefs.length).toBeGreaterThan(0);
    });

    it('executes SIM-04 simulation through kernel (FE-first)', async () => {
      const simAdapter = new SimulationTestAdapter({
        name: 'sim04',
        type: AdapterType.SIMULATION,
        version: '1.0.0',
        timeoutMs: 600000,
        retries: 0,
        environmentClass: 'CI',
        simulationPath: 'simulations/SIM-04-Accounting-Project-Full-Flow/',
        feFirstMode: true,
      });

      const capability = buildCapability(
        'CAP-EL-003',
        'Simulation Harness (SIM-04)',
        'EXECUTION',
        'HIGH',
      );
      kernel.registerCapability(capability);

      const scenario = buildScenario('SIM-04', ['CAP-EL-003'], 'HIGH');
      kernel.getCatalog().registerScenario(scenario);

      kernel.registerAdapter('sim04', simAdapter);

      const request: ExecutionRequest = {
        scenarioId: 'SIM-04',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        adapterType: AdapterType.SIMULATION,
      };

      const response = await kernel.executeScenario(request);

      expect(response.runId).toMatch(/^run-/);
      expect(response.scenarioId).toBe('SIM-04');
      expect(response.capabilityIds).toContain('CAP-EL-003');
      expect(response.outcome).toBe('PASSED');
      expect(response.evidenceCount).toBeGreaterThan(0);
    });

    it('executes BOTH heterogeneous suites in same kernel instance', async () => {
      const certAdapter = new CertificationTestAdapter({
        name: 'phase9-cert',
        type: AdapterType.CERTIFICATION,
        version: '1.0.0',
        timeoutMs: 300000,
        retries: 0,
        environmentClass: 'CI',
        suitePath: 'backend/src/test/certification/',
        reportDir: 'backend/src/test/certification/reports/',
      });
      const simAdapter = new SimulationTestAdapter({
        name: 'sim04',
        type: AdapterType.SIMULATION,
        version: '1.0.0',
        timeoutMs: 600000,
        retries: 0,
        environmentClass: 'CI',
        simulationPath: 'simulations/SIM-04/',
        feFirstMode: true,
      });

      kernel.registerCapability(
        buildCapability('CAP-CERT', 'Certification', 'GOVERNANCE', 'CRITICAL'),
      );
      kernel.registerCapability(
        buildCapability('CAP-SIM', 'Simulation', 'EXECUTION', 'HIGH'),
      );
      kernel.getCatalog().registerScenario(buildScenario('SCN-CERT', ['CAP-CERT'], 'CRITICAL'));
      kernel.getCatalog().registerScenario(buildScenario('SCN-SIM', ['CAP-SIM'], 'HIGH'));

      kernel.registerAdapter('cert', certAdapter);
      kernel.registerAdapter('sim', simAdapter);

      const certResponse = await kernel.executeScenario({
        scenarioId: 'SCN-CERT',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        adapterType: AdapterType.CERTIFICATION,
      });

      const simResponse = await kernel.executeScenario({
        scenarioId: 'SCN-SIM',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        adapterType: AdapterType.SIMULATION,
      });

      expect(certResponse.outcome).toBe('PASSED');
      expect(simResponse.outcome).toBe('PASSED');

      expect(certResponse.runId).not.toBe(simResponse.runId);
      expect(certResponse.scenarioId).toBe('SCN-CERT');
      expect(simResponse.scenarioId).toBe('SCN-SIM');

      const certEvidence = kernel.getEvidenceStore().getByScenarioId('SCN-CERT');
      const simEvidence = kernel.getEvidenceStore().getByScenarioId('SCN-SIM');
      expect(certEvidence.length).toBeGreaterThan(0);
      expect(simEvidence.length).toBeGreaterThan(0);
    });

    it('heterogeneous execution preserves adapter-specific detail', async () => {
      const certAdapter = new CertificationTestAdapter({
        name: 'cert',
        type: AdapterType.CERTIFICATION,
        version: '1.0.0',
        timeoutMs: 300000,
        retries: 0,
        environmentClass: 'CI',
        suitePath: 'test/',
        reportDir: 'reports/',
      });

      kernel.registerCapability(
        buildCapability('CAP-DETAIL', 'Detail Test', 'GOVERNANCE', 'HIGH'),
      );
      kernel.getCatalog().registerScenario(buildScenario('SCN-DETAIL', ['CAP-DETAIL'], 'HIGH'));
      kernel.registerAdapter('cert', certAdapter);

      const response = await kernel.executeScenario({
        scenarioId: 'SCN-DETAIL',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        adapterType: AdapterType.CERTIFICATION,
      });

      expect(response.adapterResult.evidenceRefs.length).toBeGreaterThan(0);
      expect(response.adapterResult.evidenceRefs[0].checksum).toMatch(/^sha256:/);
      expect(response.harnessResult.outcome).toBe('PASSED');
    });
  });

  describe('Crash Recovery (Phase 1 exit criteria)', () => {
    it('recoverFromCrash returns crashed runs', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerCapability(
        buildCapability('CAP-CRASH', 'Crash Test', 'FOUNDATION', 'HIGH'),
      );
      kernel.getCatalog().registerScenario(buildScenario('SCN-CRASH', ['CAP-CRASH'], 'HIGH'));

      const tenantCtx = {
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        actorType: 'HUMAN' as const,
        correlationId: randomUUID(),
        causationId: null,
        idempotencyKey: randomUUID(),
      };

      const run = kernel.getOrchestrator().createRun('SCN-CRASH', ['CAP-CRASH'], tenantCtx);
      kernel.getOrchestrator().transitionTo(run.runId, 'PROVISIONING');
      kernel.getOrchestrator().transitionTo(run.runId, 'RUNNING');

      const crashed = kernel.recoverFromCrash();
      expect(crashed).toContain(run.runId);
    });

    it('cleanupCrashedRuns transitions run to FINALIZED', async () => {
      const tenantCtx = {
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        actorType: 'HUMAN' as const,
        correlationId: randomUUID(),
        causationId: null,
        idempotencyKey: randomUUID(),
      };

      const run = kernel.getOrchestrator().createRun('SCN-CR', ['CAP-001'], tenantCtx);
      kernel.getOrchestrator().transitionTo(run.runId, 'PROVISIONING');
      kernel.getOrchestrator().transitionTo(run.runId, 'RUNNING');

      await kernel.cleanupCrashedRuns(run.runId);

      expect(kernel.getOrchestrator().isRunFinalized(run.runId)).toBe(true);
    });

    it('cleanupCrashedRuns is no-op when crash recovery disabled', async () => {
      const k = new HarnessKernel({ enableCrashRecovery: false });
      const tenantCtx = {
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
        actorType: 'HUMAN' as const,
        correlationId: randomUUID(),
        causationId: null,
        idempotencyKey: randomUUID(),
      };

      const run = k.getOrchestrator().createRun('SCN-NR', ['CAP-001'], tenantCtx);
      k.getOrchestrator().transitionTo(run.runId, 'PROVISIONING');

      await k.cleanupCrashedRuns(run.runId);

      expect(k.getOrchestrator().isRunFinalized(run.runId)).toBe(false);
      await k.destroy();
    });
  });

  describe('Idempotency (Phase 1 exit criteria)', () => {
    it('tracks idempotency keys', () => {
      expect(kernel.isIdempotent('idem-001')).toBe(false);
      kernel.getOrchestrator().recordIdempotencyKey('run-x', 'idem-001');
      expect(kernel.isIdempotent('idem-001')).toBe(true);
    });

    it('retrieves run ID for idempotency key', () => {
      kernel.getOrchestrator().recordIdempotencyKey('run-y', 'idem-002');
      expect(kernel.getRunIdForIdempotencyKey('idem-002')).toBe('run-y');
    });

    it('duplicate idempotency key throws', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerCapability(
        buildCapability('CAP-IDEMPOTENT', 'Idempotent Test', 'FOUNDATION', 'HIGH'),
      );
      kernel.getCatalog().registerScenario(
        buildScenario('SCN-IDEMPOTENT', ['CAP-IDEMPOTENT'], 'HIGH'),
      );

      await kernel.executeScenario({
        scenarioId: 'SCN-IDEMPOTENT',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
      });

      await expect(
        kernel.executeScenario({
          scenarioId: 'SCN-IDEMPOTENT',
          tenantId: VALID_TENANT_ID,
          actorId: 'user-001',
        }),
      ).rejects.toThrow(/Duplicate/);
    });
  });

  describe('Tenant Isolation', () => {
    it('isolates evidence per tenant', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerCapability(
        buildCapability('CAP-ISO', 'Isolation Test', 'FOUNDATION', 'MEDIUM'),
      );
      kernel.getCatalog().registerScenario(buildScenario('SCN-ISO', ['CAP-ISO'], 'MEDIUM'));

      await kernel.executeScenario({
        scenarioId: 'SCN-ISO',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
      });

      await kernel.executeScenario({
        scenarioId: 'SCN-ISO',
        tenantId: VALID_TENANT_ID_2,
        actorId: 'user-002',
      });

      const tenant1Evidence = kernel.getEvidenceStore().getByTenantId(VALID_TENANT_ID);
      const tenant2Evidence = kernel.getEvidenceStore().getByTenantId(VALID_TENANT_ID_2);

      expect(tenant1Evidence.length).toBeGreaterThan(0);
      expect(tenant2Evidence.length).toBeGreaterThan(0);

      for (const evidence of tenant1Evidence) {
        expect(evidence.envelope.tenantId).toBe(VALID_TENANT_ID);
      }
      for (const evidence of tenant2Evidence) {
        expect(evidence.envelope.tenantId).toBe(VALID_TENANT_ID_2);
      }
    });

    it('retrieves runs per tenant', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerCapability(
        buildCapability('CAP-TENANT', 'Tenant Test', 'FOUNDATION', 'LOW'),
      );
      kernel.getCatalog().registerScenario(buildScenario('SCN-TENANT', ['CAP-TENANT'], 'LOW'));

      await kernel.executeScenario({
        scenarioId: 'SCN-TENANT',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
      });

      const tenant1Runs = kernel.getOrchestrator().getRunsForTenant(VALID_TENANT_ID);
      const tenant2Runs = kernel.getOrchestrator().getRunsForTenant(VALID_TENANT_ID_2);

      expect(tenant1Runs.length).toBeGreaterThan(0);
      expect(tenant2Runs.length).toBe(0);
    });
  });

  describe('Lifecycle Transitions', () => {
    it('executes scenario through full lifecycle QUEUED -> FINALIZED', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerCapability(
        buildCapability('CAP-LIFECYCLE', 'Lifecycle Test', 'FOUNDATION', 'HIGH'),
      );
      kernel.getCatalog().registerScenario(
        buildScenario('SCN-LIFECYCLE', ['CAP-LIFECYCLE'], 'HIGH'),
      );

      const events: string[] = [];
      kernel.getOrchestrator().on('queued', () => events.push('queued'));
      kernel.getOrchestrator().on('provisioning', () => events.push('provisioning'));
      kernel.getOrchestrator().on('running', () => events.push('running'));
      kernel.getOrchestrator().on('evaluating', () => events.push('evaluating'));
      kernel.getOrchestrator().on('cleaning_up', () => events.push('cleaning_up'));
      kernel.getOrchestrator().on('finalized', () => events.push('finalized'));

      const response = await kernel.executeScenario({
        scenarioId: 'SCN-LIFECYCLE',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
      });

      expect(events).toEqual([
        'queued',
        'provisioning',
        'running',
        'evaluating',
        'cleaning_up',
        'finalized',
      ]);
      expect(response.runId).toBeDefined();
    });
  });

  describe('Evidence Trail', () => {
    it('captures evidence with required scenarioId/capabilityId', async () => {
      const jestAdapter = new JestTestAdapter({
        name: 'jest',
        type: AdapterType.JEST,
        version: '1.0.0',
        timeoutMs: 60000,
        retries: 0,
        environmentClass: 'CI',
        testMatchPatterns: ['**/*.spec.ts'],
      });
      kernel.registerAdapter('jest', jestAdapter);
      kernel.registerCapability(
        buildCapability('CAP-EV', 'Evidence Test', 'FOUNDATION', 'HIGH'),
      );
      kernel.getCatalog().registerScenario(buildScenario('SCN-EV', ['CAP-EV'], 'HIGH'));

      await kernel.executeScenario({
        scenarioId: 'SCN-EV',
        tenantId: VALID_TENANT_ID,
        actorId: 'user-001',
      });

      const evidence = kernel.getEvidenceStore().getByScenarioId('SCN-EV');
      expect(evidence.length).toBeGreaterThan(0);

      for (const artifact of evidence) {
        expect(artifact.envelope.scenarioId).toBe('SCN-EV');
        expect(artifact.envelope.capabilityId).toBe('CAP-EV');
        expect(artifact.envelope.checksum).toMatch(/^sha256:/);
      }
    });
  });
});