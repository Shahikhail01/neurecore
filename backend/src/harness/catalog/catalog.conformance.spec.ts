/**
 * Harness Catalog - Conformance Tests
 * Phase 1: Verifies catalog module meets contracts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { z } from 'zod';
import {
  CapabilityRecordSchema,
  ScenarioRecordSchema,
  SuiteRecordSchema,
  HarnessCatalogSchema,
  InMemoryCatalog,
  CapabilityResolver,
  CATALOG_VERSION,
  CATALOG_SCHEMA_VERSION,
} from './index';

const VALID_CAPABILITY: z.infer<typeof CapabilityRecordSchema> = {
  id: 'CAP-001',
  elementId: 'EL-001',
  name: 'Test Harness',
  category: 'FOUNDATION',
  baselineStatus: 'PARTIAL',
  riskTier: 'CRITICAL',
  surfaces: [{ path: 'backend/src/test/', description: 'Test harness sources' }],
  dependencies: [],
  requiredSuites: ['unit', 'integration', 'contract'],
  owner: { role: 'Architecture', confirmedBy: 'Architecture Team', reviewDate: '2026-08-02' },
  raci: {
    responsiblePartners: ['Platform', 'QA'],
    consultedParties: ['Security'],
    informedParties: ['Release Engineering'],
  },
  definitionOfDone: {
    canonicalOwnerExists: true,
    capabilityMappingComplete: true,
    threatConsiderationsDocumented: false,
    runbookExists: false,
    contractsRuntimeValidated: true,
    conformanceTestsExist: true,
    positiveNegativeTestsDefined: 'PARTIAL',
    tenantIsolationEnforced: 'PARTIAL',
    immutableEvidenceProduced: 'false',
    determinismMeasured: 'false',
    ciLaneConsumesResults: false,
    operationalAlertsTested: false,
    limitationsDocumented: false,
    independentReviewerAccepted: false,
  },
  knownGaps: ['Common test kernel not formally defined'],
  phase0Action: 'Define common kernel',
  remediationOwner: 'Architecture',
  remediationPhase: 'Phase 1',
};

const VALID_SCENARIO: z.infer<typeof ScenarioRecordSchema> = {
  scenarioId: 'SCN-001',
  scenarioVersion: '1.0.0',
  name: 'Test Scenario',
  description: 'Tests the test harness',
  capabilityIds: ['CAP-001'],
  riskTier: 'CRITICAL',
  executionMode: 'DETERMINISTIC',
  environmentClass: 'CI',
  status: 'EXECUTABLE',
  owner: {
    ownerId: 'user-001',
    ownerRole: 'QA Lead',
    confirmedAt: '2026-08-02T00:00:00.000Z',
  },
  tags: ['critical', 'regression'],
};

const VALID_SUITE: z.infer<typeof SuiteRecordSchema> = {
  suiteId: 'SUITE-001',
  suiteVersion: '1.0.0',
  name: 'Test Suite',
  description: 'Unit and integration tests',
  type: 'UNIT',
  status: 'ACTIVE',
  scenarioIds: ['SCN-001'],
  capabilityIds: ['CAP-001'],
  testPaths: ['backend/src/test/**/*.spec.ts'],
  owner: {
    ownerId: 'user-001',
    ownerRole: 'QA Lead',
    confirmedAt: '2026-08-02T00:00:00.000Z',
  },
  adapterType: 'JEST',
};

describe('Harness Catalog', () => {
  let catalog: InMemoryCatalog;

  beforeEach(() => {
    catalog = new InMemoryCatalog();
  });

  describe('CapabilityRecordSchema', () => {
    it('accepts valid capability record', () => {
      const result = CapabilityRecordSchema.safeParse(VALID_CAPABILITY);
      expect(result.success).toBe(true);
    });

    it('rejects capability with unknown category', () => {
      const result = CapabilityRecordSchema.safeParse({
        ...VALID_CAPABILITY,
        category: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('rejects capability with unknown status', () => {
      const result = CapabilityRecordSchema.safeParse({
        ...VALID_CAPABILITY,
        baselineStatus: 'UNKNOWN',
      });
      expect(result.success).toBe(false);
    });

    it('rejects capability with empty requiredSuites', () => {
      const result = CapabilityRecordSchema.safeParse({
        ...VALID_CAPABILITY,
        requiredSuites: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects capability with extra fields (strict)', () => {
      const result = CapabilityRecordSchema.safeParse({
        ...VALID_CAPABILITY,
        extraField: 'should fail',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ScenarioRecordSchema', () => {
    it('accepts valid scenario record', () => {
      const result = ScenarioRecordSchema.safeParse(VALID_SCENARIO);
      expect(result.success).toBe(true);
    });

    it('rejects scenario with invalid version format', () => {
      const result = ScenarioRecordSchema.safeParse({
        ...VALID_SCENARIO,
        scenarioVersion: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects scenario with unknown execution mode', () => {
      const result = ScenarioRecordSchema.safeParse({
        ...VALID_SCENARIO,
        executionMode: 'RANDOM',
      });
      expect(result.success).toBe(false);
    });

    it('rejects scenario with empty capabilityIds', () => {
      const result = ScenarioRecordSchema.safeParse({
        ...VALID_SCENARIO,
        capabilityIds: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('SuiteRecordSchema', () => {
    it('accepts valid suite record', () => {
      const result = SuiteRecordSchema.safeParse(VALID_SUITE);
      expect(result.success).toBe(true);
    });

    it('rejects suite with empty testPaths', () => {
      const result = SuiteRecordSchema.safeParse({
        ...VALID_SUITE,
        testPaths: [],
      });
      expect(result.success).toBe(false);
    });

    it('rejects suite with unknown type', () => {
      const result = SuiteRecordSchema.safeParse({
        ...VALID_SUITE,
        type: 'UNKNOWN',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('InMemoryCatalogReader', () => {
    beforeEach(() => {
      catalog.registerCapability(VALID_CAPABILITY);
      catalog.registerScenario(VALID_SCENARIO);
      catalog.registerSuite(VALID_SUITE);
    });

    it('getCapability returns registered capability', () => {
      const capability = catalog.getCapability('CAP-001');
      expect(capability).not.toBeNull();
      expect(capability?.name).toBe('Test Harness');
    });

    it('getCapability returns null for unknown ID', () => {
      const capability = catalog.getCapability('UNKNOWN');
      expect(capability).toBeNull();
    });

    it('getCapabilitiesByElement filters correctly', () => {
      const capabilities = catalog.getCapabilitiesByElement('EL-001');
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.every((c) => c.elementId === 'EL-001')).toBe(true);
    });

    it('getCapabilitiesByCategory filters correctly', () => {
      const capabilities = catalog.getCapabilitiesByCategory('FOUNDATION');
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.every((c) => c.category === 'FOUNDATION')).toBe(true);
    });

    it('getScenario returns registered scenario', () => {
      const scenario = catalog.getScenario('SCN-001');
      expect(scenario).not.toBeNull();
      expect(scenario?.name).toBe('Test Scenario');
    });

    it('getSuitesByCapability returns suites covering capability', () => {
      const suites = catalog.getSuitesByCapability('CAP-001');
      expect(suites.length).toBeGreaterThan(0);
      expect(suites.some((s) => s.suiteId === 'SUITE-001')).toBe(true);
    });
  });

  describe('InMemoryCatalogWriter', () => {
    it('registerCapability adds capability to catalog', () => {
      catalog.registerCapability(VALID_CAPABILITY);
      const capability = catalog.getCapability('CAP-001');
      expect(capability).not.toBeNull();
    });

    it('registerScenario adds scenario to catalog', () => {
      catalog.registerScenario(VALID_SCENARIO);
      const scenario = catalog.getScenario('SCN-001');
      expect(scenario).not.toBeNull();
    });

    it('registerSuite adds suite to catalog', () => {
      catalog.registerSuite(VALID_SUITE);
      const suites = catalog.getSuitesByCapability('CAP-001');
      expect(suites.some((s) => s.suiteId === 'SUITE-001')).toBe(true);
    });

    it('retireScenario sets status to RETIRED', () => {
      catalog.registerScenario(VALID_SCENARIO);
      catalog.retireScenario('SCN-001');
      const scenario = catalog.getScenario('SCN-001');
      expect(scenario?.status).toBe('RETIRED');
    });

    it('updateCapability updates existing capability', () => {
      catalog.registerCapability(VALID_CAPABILITY);
      catalog.updateCapability('CAP-001', {
        knownGaps: ['Updated gap list'],
      });
      const capability = catalog.getCapability('CAP-001');
      expect(capability?.knownGaps).toContain('Updated gap list');
    });
  });

  describe('CapabilityResolver', () => {
    let resolver: CapabilityResolver;

    beforeEach(() => {
      const writer = catalog as InMemoryCatalogWriter;
      writer.registerCapability(VALID_CAPABILITY);
      writer.registerScenario(VALID_SCENARIO);
      writer.registerSuite(VALID_SUITE);
      resolver = new CapabilityResolver(catalog);
    });

    it('capabilitiesForSuite returns correct capabilities', () => {
      const capabilities = resolver.capabilitiesForSuite('SUITE-001', [VALID_SUITE]);
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities.some((c) => c.id === 'CAP-001')).toBe(true);
    });

    it('coverageStatus returns missing suites', () => {
      const status = resolver.coverageStatus('CAP-001', [VALID_SUITE]);
      expect(status.total).toBeGreaterThan(0);
      expect(Array.isArray(status.missing)).toBe(true);
    });
  });

  describe('CATALOG_VERSION', () => {
    it('is defined', () => {
      expect(CATALOG_VERSION).toBeDefined();
      expect(typeof CATALOG_VERSION).toBe('string');
    });

    it('matches semver format', () => {
      expect(CATALOG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
