/**
 * NeureCore Harness - Catalog Module
 *
 * This module defines the versioned catalog of capabilities, scenarios,
 * suites, ownership, tags, and dependencies per Phase 1 requirements.
 *
 * Document ID: NC-HARNESS-CATALOG-001
 * Version: 1.0
 * Status: PHASE_1_IMPLEMENTED
 */

import { z } from 'zod';
import type {
  RunStatus,
  RiskTier,
  ExecutionMode,
  EnvironmentClass,
} from '../contracts';
import {
  RunStatusSchema,
  RiskTierSchema,
  ExecutionModeSchema,
  EnvironmentClassSchema,
  SemverSchema,
  UuidSchema,
} from '../contracts';

// ============================================================
// CAPABILITY REGISTRY
// ============================================================

export const CapabilityCategorySchema = z.enum([
  'FOUNDATION',
  'AI_QUALITY',
  'EXECUTION',
  'GOVERNANCE',
  'INFRASTRUCTURE',
]);
export type CapabilityCategory = z.infer<typeof CapabilityCategorySchema>;

export const CapabilityStatusSchema = z.enum([
  'IMPLEMENTED',
  'PARTIAL',
  'WEAK',
  'MISSING',
  'PLANNED',
  'DEPRECATED',
]);
export type CapabilityStatus = z.infer<typeof CapabilityStatusSchema>;

export const RACISchema = z.object({
  responsiblePartners: z.array(z.string()).min(1),
  consultedParties: z.array(z.string()).optional(),
  informedParties: z.array(z.string()).optional(),
});
export type RACI = z.infer<typeof RACISchema>;

export const OwnerSchema = z.object({
  role: z.string().min(1),
  confirmedBy: z.string().min(1).optional(),
  reviewDate: z.string().optional(),
});
export type Owner = z.infer<typeof OwnerSchema>;

export const DependencyRefSchema = z.object({
  elementId: z.string().min(1),
  description: z.string().optional(),
});
export type DependencyRef = z.infer<typeof DependencyRefSchema>;

export const SurfaceRefSchema = z.object({
  path: z.string().min(1),
  description: z.string().optional(),
});
export type SurfaceRef = z.infer<typeof SurfaceRefSchema>;

export const RequiredSuiteSchema = z.enum([
  'unit',
  'integration',
  'contract',
  'e2e',
  'security',
  'performance',
  'load',
  'deterministicAssertions',
  'referenceBasedMetrics',
  'modelGraders',
  'humanEvaluation',
  'statisticalEvaluation',
  'commonManifestRunner',
  'stateAssertions',
  'feFirstClassification',
  'scenarioCoverageMap',
  'defectCatalog',
  'promotionPolicy',
  'quarantineControls',
  'browserMatrix',
  'accessibilityTests',
  'traceRetention',
  'roleMatrix',
  'memoryIsolation',
  'delegationTests',
  'autonomyBudget',
  'escalationTests',
  'longHorizonTests',
  'stateMachineOracle',
  'idempotencyTests',
  'retryTests',
  'compensationTests',
  'concurrencyTests',
  'toolRegistry',
  'parameterValidation',
  'authTests',
  'sideEffectTests',
  'ingestionBenchmarks',
  'retrievalBenchmarks',
  'groundingTests',
  'aclTests',
  'freshnessTests',
  'promptRegistry',
  'immutableTemplates',
  'lineageTests',
  'secretScanning',
  'canaryTests',
  'threatModelSuites',
  'injectionTests',
  'exfiltrationTests',
  'ssrfTests',
  'rateAbuseTests',
  'controlMatrix',
  'auditTests',
  'consentTests',
  'retentionTests',
  'legalHoldTests',
  'jurisdictionTests',
  'sloWorkloads',
  'percentileTests',
  'coldStartTests',
  'costRegressionTests',
  'concurrentTenantTests',
  'queuePressureTests',
  'spikeTests',
  'stressTests',
  'soakTests',
  'recoveryTests',
  'correlatedTelemetry',
  'redactionTests',
  'missingSignalTests',
  'capabilityRegistry',
  'evidenceResolver',
  'verdictService',
  'expiryTests',
  'revocationTests',
  'bundleCapture',
  'sanitizationTests',
  'dependencyVirtualization',
  'schemaMigration',
  'replayTests',
  'resourceActionMatrix',
  'existenceLeakTests',
  'dataContractTests',
  'driftTests',
  'lineageTests',
  'quarantineTests',
  'riskTierPolicy',
  'changedSurfaceMapping',
  'gateAggregation',
  'waiverWorkflow',
  'rollbackTests',
  'reviewPolicyRouting',
  'reviewerIndependence',
  'reviewEvidenceQuality',
  'reviewTimeoutTests',
]);
export type RequiredSuite = z.infer<typeof RequiredSuiteSchema>;

export const DefinitionOfDoneSchema = z.object({
  canonicalOwnerExists: z.boolean(),
  capabilityMappingComplete: z.boolean(),
  threatConsiderationsDocumented: z.boolean(),
  runbookExists: z.boolean(),
  contractsRuntimeValidated: z.boolean(),
  conformanceTestsExist: z.boolean(),
  positiveNegativeTestsDefined: z.enum(['true', 'false', 'PARTIAL']),
  tenantIsolationEnforced: z.enum(['true', 'false', 'PARTIAL']),
  immutableEvidenceProduced: z.enum(['true', 'false', 'PARTIAL']),
  determinismMeasured: z.enum(['true', 'false', 'PARTIAL']),
  ciLaneConsumesResults: z.boolean(),
  operationalAlertsTested: z.boolean(),
  limitationsDocumented: z.boolean(),
  independentReviewerAccepted: z.boolean(),
});
export type DefinitionOfDone = z.infer<typeof DefinitionOfDoneSchema>;

export const CapabilityRecordSchema = z.object({
  id: z.string().min(1),
  elementId: z.string().min(1),
  name: z.string().min(1),
  category: CapabilityCategorySchema,
  baselineStatus: CapabilityStatusSchema,
  riskTier: RiskTierSchema,
  surfaces: z.array(SurfaceRefSchema).optional(),
  dependencies: z.array(DependencyRefSchema).optional(),
  requiredSuites: z.array(RequiredSuiteSchema).min(1),
  owner: OwnerSchema,
  raci: RACISchema.optional(),
  definitionOfDone: DefinitionOfDoneSchema.optional(),
  knownGaps: z.array(z.string()).optional(),
  phase0Action: z.string().optional(),
  remediationOwner: z.string().optional(),
  remediationPhase: z.string().optional(),
}).strict();
export type CapabilityRecord = z.infer<typeof CapabilityRecordSchema>;

// ============================================================
// SCENARIO REGISTRY
// ============================================================

export const ScenarioStatusSchema = z.enum([
  'DRAFT',
  'REGISTERED',
  'EXECUTABLE',
  'CERTIFICATION_CANDIDATE',
  'CERTIFIED',
  'RETIRED',
]);
export type ScenarioStatus = z.infer<typeof ScenarioStatusSchema>;

export const ScenarioTagSchema = z.string().min(1);
export type ScenarioTag = z.infer<typeof ScenarioTagSchema>;

export const OwnerRefSchema = z.object({
  ownerId: z.string().min(1),
  ownerRole: z.string().min(1),
  confirmedAt: z.string().datetime(),
});
export type OwnerRef = z.infer<typeof OwnerRefSchema>;

export const ScenarioDependencySchema = z.object({
  scenarioId: z.string().min(1),
  type: z.enum(['REQUIRES', 'BLOCKS', 'COVERS']),
  description: z.string().optional(),
});
export type ScenarioDependency = z.infer<typeof ScenarioDependencySchema>;

export const ScenarioRecordSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioVersion: SemverSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  capabilityIds: z.array(z.string().min(1)).min(1),
  riskTier: RiskTierSchema,
  executionMode: ExecutionModeSchema,
  environmentClass: EnvironmentClassSchema,
  status: ScenarioStatusSchema,
  owner: OwnerRefSchema,
  tags: z.array(ScenarioTagSchema).optional(),
  dependencies: z.array(ScenarioDependencySchema).optional(),
  reviewDate: z.string().datetime().optional(),
  lastExecutedAt: z.string().datetime().optional(),
}).strict();
export type ScenarioRecord = z.infer<typeof ScenarioRecordSchema>;

// ============================================================
// SUITE REGISTRY
// ============================================================

export const SuiteTypeSchema = z.enum([
  'UNIT',
  'INTEGRATION',
  'CONTRACT',
  'E2E',
  'SECURITY',
  'PERFORMANCE',
  'LOAD',
  'CERTIFICATION',
  'SIMULATION',
  'REPLAY',
  'REGRESSION',
]);
export type SuiteType = z.infer<typeof SuiteTypeSchema>;

export const SuiteStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'DEPRECATED',
  'RETIRED',
]);
export type SuiteStatus = z.infer<typeof SuiteStatusSchema>;

export const SuiteRecordSchema = z.object({
  suiteId: z.string().min(1),
  suiteVersion: SemverSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  type: SuiteTypeSchema,
  status: SuiteStatusSchema,
  scenarioIds: z.array(z.string().min(1)),
  capabilityIds: z.array(z.string().min(1)),
  testPaths: z.array(z.string().min(1)).min(1),
  owner: OwnerRefSchema,
  adapterType: z.enum(['JEST', 'PLAYWRIGHT', 'CERTIFICATION', 'SIMULATION', 'CUSTOM']).optional(),
  reviewDate: z.string().datetime().optional(),
}).strict();
export type SuiteRecord = z.infer<typeof SuiteRecordSchema>;

// ============================================================
// CATALOG
// ============================================================

export const HarnessCatalogSchema = z.object({
  schemaVersion: SemverSchema,
  catalogId: z.string().min(1),
  version: SemverSchema,
  capabilities: z.array(CapabilityRecordSchema).min(1),
  scenarios: z.array(ScenarioRecordSchema).optional(),
  suites: z.array(SuiteRecordSchema).optional(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
}).strict();
export type HarnessCatalog = z.infer<typeof HarnessCatalogSchema>;

// ============================================================
// CATALOG OPERATIONS (ports - no framework deps)
// ============================================================

export interface ICatalogReader {
  getCapability(id: string): CapabilityRecord | null;
  getCapabilitiesByElement(elementId: string): CapabilityRecord[];
  getCapabilitiesByCategory(category: CapabilityCategory): CapabilityRecord[];
  getCapabilitiesByStatus(status: CapabilityStatus): CapabilityRecord[];
  getScenario(scenarioId: string): ScenarioRecord | null;
  getSuitesByCapability(capabilityId: string): SuiteRecord[];
}

export interface ICatalogWriter {
  registerCapability(capability: CapabilityRecord): void;
  updateCapability(id: string, updates: Partial<CapabilityRecord>): void;
  registerScenario(scenario: ScenarioRecord): void;
  registerSuite(suite: SuiteRecord): void;
  retireScenario(scenarioId: string): void;
}

export class InMemoryCatalogReader implements ICatalogReader {
  constructor(
    private readonly capabilities: Map<string, CapabilityRecord> = new Map(),
    private readonly scenarios: Map<string, ScenarioRecord> = new Map(),
    private readonly suites: Map<string, SuiteRecord> = new Map(),
  ) {}

  getCapability(id: string): CapabilityRecord | null {
    return this.capabilities.get(id) ?? null;
  }

  getCapabilitiesByElement(elementId: string): CapabilityRecord[] {
    return [...this.capabilities.values()].filter((c) => c.elementId === elementId);
  }

  getCapabilitiesByCategory(category: CapabilityCategory): CapabilityRecord[] {
    return [...this.capabilities.values()].filter((c) => c.category === category);
  }

  getCapabilitiesByStatus(status: CapabilityStatus): CapabilityRecord[] {
    return [...this.capabilities.values()].filter((c) => c.baselineStatus === status);
  }

  getScenario(scenarioId: string): ScenarioRecord | null {
    return this.scenarios.get(scenarioId) ?? null;
  }

  getSuitesByCapability(capabilityId: string): SuiteRecord[] {
    return [...this.suites.values()].filter((s) => s.capabilityIds.includes(capabilityId));
  }
}

export class InMemoryCatalogWriter implements ICatalogWriter {
  constructor(
    private readonly capabilities: Map<string, CapabilityRecord>,
    private readonly scenarios: Map<string, ScenarioRecord>,
    private readonly suites: Map<string, SuiteRecord>,
  ) {}

  registerCapability(capability: CapabilityRecord): void {
    const parsed = CapabilityRecordSchema.parse(capability);
    this.capabilities.set(parsed.id, parsed);
  }

  updateCapability(id: string, updates: Partial<CapabilityRecord>): void {
    const existing = this.capabilities.get(id);
    if (!existing) throw new Error(`Capability ${id} not found`);
    const updated = CapabilityRecordSchema.parse({ ...existing, ...updates });
    this.capabilities.set(id, updated);
  }

  registerScenario(scenario: ScenarioRecord): void {
    const parsed = ScenarioRecordSchema.parse(scenario);
    this.scenarios.set(parsed.scenarioId, parsed);
  }

  registerSuite(suite: SuiteRecord): void {
    const parsed = SuiteRecordSchema.parse(suite);
    this.suites.set(parsed.suiteId, parsed);
  }

  retireScenario(scenarioId: string): void {
    const existing = this.scenarios.get(scenarioId);
    if (!existing) throw new Error(`Scenario ${scenarioId} not found`);
    this.scenarios.set(scenarioId, {
      ...existing,
      status: 'RETIRED',
    } as ScenarioRecord);
  }
}

// ============================================================
// COMBINED CATALOG (reader + writer)
// ============================================================

export class InMemoryCatalog implements ICatalogReader, ICatalogWriter {
  private readonly capabilities = new Map<string, CapabilityRecord>();
  private readonly scenarios = new Map<string, ScenarioRecord>();
  private readonly suites = new Map<string, SuiteRecord>();

  getCapability(id: string): CapabilityRecord | null {
    return this.capabilities.get(id) ?? null;
  }

  getCapabilitiesByElement(elementId: string): CapabilityRecord[] {
    return [...this.capabilities.values()].filter((c) => c.elementId === elementId);
  }

  getCapabilitiesByCategory(category: CapabilityCategory): CapabilityRecord[] {
    return [...this.capabilities.values()].filter((c) => c.category === category);
  }

  getCapabilitiesByStatus(status: CapabilityStatus): CapabilityRecord[] {
    return [...this.capabilities.values()].filter((c) => c.baselineStatus === status);
  }

  getScenario(scenarioId: string): ScenarioRecord | null {
    return this.scenarios.get(scenarioId) ?? null;
  }

  getSuitesByCapability(capabilityId: string): SuiteRecord[] {
    return [...this.suites.values()].filter((s) => s.capabilityIds.includes(capabilityId));
  }

  registerCapability(capability: CapabilityRecord): void {
    const parsed = CapabilityRecordSchema.parse(capability);
    this.capabilities.set(parsed.id, parsed);
  }

  updateCapability(id: string, updates: Partial<CapabilityRecord>): void {
    const existing = this.capabilities.get(id);
    if (!existing) throw new Error(`Capability ${id} not found`);
    const updated = CapabilityRecordSchema.parse({ ...existing, ...updates });
    this.capabilities.set(id, updated);
  }

  registerScenario(scenario: ScenarioRecord): void {
    const parsed = ScenarioRecordSchema.parse(scenario);
    this.scenarios.set(parsed.scenarioId, parsed);
  }

  registerSuite(suite: SuiteRecord): void {
    const parsed = SuiteRecordSchema.parse(suite);
    this.suites.set(parsed.suiteId, parsed);
  }

  retireScenario(scenarioId: string): void {
    const existing = this.scenarios.get(scenarioId);
    if (!existing) throw new Error(`Scenario ${scenarioId} not found`);
    this.scenarios.set(scenarioId, {
      ...existing,
      status: 'RETIRED',
    } as ScenarioRecord);
  }
}

// ============================================================
// CAPABILITY RESOLVER
// ============================================================

export class CapabilityResolver {
  constructor(private readonly reader: ICatalogReader) {}

  capabilitiesForSuite(suiteId: string, suites: SuiteRecord[]): CapabilityRecord[] {
    const suite = suites.find((s) => s.suiteId === suiteId);
    if (!suite) return [];
    return suite.capabilityIds
      .map((id) => this.reader.getCapability(id))
      .filter((c): c is CapabilityRecord => c !== null);
  }

  coverageStatus(capabilityId: string, suites: SuiteRecord[]): {
    total: number;
    covered: number;
    missing: RequiredSuite[];
  } {
    const capability = this.reader.getCapability(capabilityId);
    if (!capability) return { total: 0, covered: 0, missing: [] };

    const coveredSuites = suites.filter((s) => s.capabilityIds.includes(capabilityId) && s.status === 'ACTIVE');
    const coveredTypes = new Set(coveredSuites.flatMap((s) => s.type));

    const missing = capability.requiredSuites.filter(
      (req) => !coveredTypes.has(req as SuiteType)
    ) as RequiredSuite[];

    return {
      total: capability.requiredSuites.length,
      covered: capability.requiredSuites.length - missing.length,
      missing,
    };
  }
}

// ============================================================
// VERSION
// ============================================================

export const CATALOG_VERSION = '1.0.0';
export const CATALOG_SCHEMA_VERSION = '1.0.0';
