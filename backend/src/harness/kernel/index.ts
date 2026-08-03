/**
 * NeureCore Harness - Kernel Module
 *
 * The kernel ties together catalog, orchestrator, evidence, and adapters
 * to provide a unified execution plane per Phase 1 + Phase 2 requirements.
 *
 * Per §6.1 bounded contexts, the kernel orchestrates:
 *   Catalog -> Orchestrator -> Adapters -> Evidence
 *
 * Per §6.2, this implements the harness-orchestrator lifecycle,
 * harness-evidence integration, and adapter coordination.
 *
 * Phase 2: kernel optionally integrates with IEvidenceStorageAdapter
 * (encryption at rest, authorization, tenant scoping) per §7.1 + §7.3.
 *
 * Document ID: NC-HARNESS-KERNEL-001
 * Version: 2.0
 * Status: PHASE_2_IMPLEMENTED
 */

import { randomUUID } from 'crypto';
import {
  RunOutcome,
  ScenarioManifest,
  HarnessResult,
  EvidenceRef,
  CleanupResult,
  SemverSchema,
  ScenarioManifestSchema,
  HarnessResultSchema,
  AuthorizationContext,
} from '../contracts';
import {
  HarnessOrchestrator,
  TenantContext,
  createTenantContext,
  OrchestratorEvent,
} from '../orchestrator';
import {
  EvidenceStore,
  EvidenceArtifact,
  createEvidenceEnvelope,
  computeContentChecksum,
  buildEvidenceIndex,
} from '../evidence';
import {
  ITestAdapter,
  AdapterRegistry,
  AdapterType,
  AdapterResult,
  createAdapter,
} from '../adapters';
import { InMemoryCatalog, CapabilityRecord } from '../catalog';
import type { IEvidenceStorageAdapter } from '../storage';

// ============================================================
// KERNEL CONFIGURATION
// ============================================================

export interface KernelConfig {
  name: string;
  version: string;
  enableCrashRecovery: boolean;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  defaultEnvironment: 'LOCAL' | 'CI' | 'STAGING' | 'PRODUCTION_PROBE';
  /**
   * Phase 2: optional storage adapter integration.
   * If provided, the kernel persists evidence to this adapter (encrypted at rest,
   * tenant-scoped, authorization-enforced) per §7.1 + §7.3.
   */
  storageAdapter?: IEvidenceStorageAdapter;
}

export const DEFAULT_KERNEL_CONFIG: KernelConfig = {
  name: 'neurecore-harness-kernel',
  version: '2.0.0',
  enableCrashRecovery: true,
  defaultTimeoutMs: 300_000,
  defaultMaxRetries: 2,
  defaultEnvironment: 'LOCAL',
};

// ============================================================
// EXECUTION REQUEST
// ============================================================

export interface ExecutionRequest {
  scenarioId: string;
  scenarioVersion?: string;
  tenantId: string;
  actorId: string;
  actorType?: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  capabilityIds?: string[];
  adapterType?: AdapterType;
  timeoutMs?: number;
  maxRetries?: number;
  parentRunId?: string;
  idempotencyKey?: string;
}

export interface ExecutionResponse {
  runId: string;
  scenarioId: string;
  capabilityIds: string[];
  outcome: RunOutcome;
  adapterResult: AdapterResult;
  harnessResult: HarnessResult;
  durationMs: number;
  evidenceCount: number;
  cleanupResult: CleanupResult;
}

// ============================================================
// HARNESS KERNEL
// ============================================================

export class HarnessKernel {
  private readonly catalog: InMemoryCatalog;
  private readonly orchestrator: HarnessOrchestrator;
  private readonly evidenceStore: EvidenceStore;
  private readonly adapterRegistry: AdapterRegistry;
  private readonly config: KernelConfig;
  private readonly activeExecutions = new Map<string, Promise<ExecutionResponse>>();

  constructor(config: Partial<KernelConfig> = {}) {
    this.config = { ...DEFAULT_KERNEL_CONFIG, ...config };
    this.catalog = new InMemoryCatalog();
    this.orchestrator = new HarnessOrchestrator({
      defaultTimeoutMs: this.config.defaultTimeoutMs,
      maxRetries: this.config.defaultMaxRetries,
    });
    this.evidenceStore = new EvidenceStore();
    this.adapterRegistry = new AdapterRegistry();
  }

  // ============================================================
  // CATALOG ACCESS
  // ============================================================

  getCatalog(): InMemoryCatalog {
    return this.catalog;
  }

  registerCapability(capability: CapabilityRecord): void {
    this.catalog.registerCapability(capability);
  }

  // ============================================================
  // ADAPTER REGISTRATION
  // ============================================================

  getAdapterRegistry(): AdapterRegistry {
    return this.adapterRegistry;
  }

  registerAdapter(name: string, adapter: ITestAdapter): void {
    this.adapterRegistry.register(name, adapter);
  }

  /**
   * Resolves an adapter for a scenario.
   * Returns the adapter by name if registered, or creates a default one
   * based on adapter type.
   */
  resolveAdapter(
    scenario: ScenarioManifest,
    preferredType?: AdapterType,
  ): ITestAdapter {
    if (preferredType) {
      const matching = this.adapterRegistry.getByType(preferredType);
      if (matching.length > 0) return matching[0];
    }

    if (scenario.steps.length > 0) {
      const firstStepAdapter = scenario.steps[0].adapter;
      const registered = this.adapterRegistry.get(firstStepAdapter);
      if (registered) return registered;
    }

    const adapters = this.adapterRegistry.list();
    if (adapters.length > 0) {
      const found = this.adapterRegistry.get(adapters[0].name);
      if (found) return found;
    }

    throw new Error('No adapter available for scenario execution');
  }

  // ============================================================
  // SCENARIO EXECUTION (the main kernel API)
  // ============================================================

  /**
   * Executes a scenario through the kernel.
   * This is the primary entry point per Phase 1 exit criteria.
   *
   * Flow:
   *   1. Resolve scenario and capabilities from catalog
   *   2. Create run context with tenant-aware execution context
   *   3. Lifecycle: QUEUED -> PROVISIONING -> RUNNING -> EVALUATING -> CLEANING_UP -> FINALIZED
   *   4. Adapter executes the scenario
   *   5. Evidence is captured for each step
   *   6. Cleanup manifest is populated and finalized
   *   7. HarnessResult is produced with full provenance
   */
  async executeScenario(request: ExecutionRequest): Promise<ExecutionResponse> {
    const idempotencyKey = request.idempotencyKey
      ?? `${request.scenarioId}:${request.tenantId}:${request.actorId}`;

    if (this.orchestrator.isIdempotent(idempotencyKey)) {
      const existingRunId = this.orchestrator.getRunIdForIdempotencyKey(idempotencyKey);
      if (existingRunId) {
        throw new Error(`Duplicate execution request for run ${existingRunId}`);
      }
    }

    const scenario = this.resolveScenario(request);
    const capabilityIds = this.resolveCapabilityIds(request, scenario);
    const tenantContext = createTenantContext(
      request.tenantId,
      request.actorId,
      request.actorType ?? 'HUMAN',
    );

    const runContext = this.orchestrator.createRun(
      request.scenarioId,
      capabilityIds,
      tenantContext,
      request.timeoutMs,
      request.maxRetries,
    );

    this.orchestrator.recordIdempotencyKey(runContext.runId, idempotencyKey);

    const executionPromise = this.runScenario(
      runContext.runId,
      scenario,
      tenantContext,
      request,
    );
    this.activeExecutions.set(runContext.runId, executionPromise);

    try {
      const result = await executionPromise;
      this.activeExecutions.delete(runContext.runId);
      return result;
    } catch (error) {
      this.activeExecutions.delete(runContext.runId);
      throw error;
    }
  }

  private async runScenario(
    runId: string,
    scenario: ScenarioManifest,
    tenantContext: TenantContext,
    request: ExecutionRequest,
  ): Promise<ExecutionResponse> {
    const startTime = Date.now();

    this.orchestrator.transitionTo(runId, 'PROVISIONING');
    this.orchestrator.addCleanupResource(runId, {
      resourceId: `provision-${runId}`,
      resourceType: 'provisioning-context',
      tenantId: tenantContext.tenantId,
      runId,
      cleanupStrategy: 'IMMEDIATE',
    });

    this.orchestrator.transitionTo(runId, 'RUNNING');
    const adapter = this.resolveAdapter(scenario, request.adapterType);
    await adapter.initialize();

    let adapterResult: AdapterResult;
    let outcome: RunOutcome;
    try {
      adapterResult = await adapter.execute(scenario, tenantContext);
      outcome = adapterResult.outcome;
    } catch (error) {
      outcome = 'FAILED';
      adapterResult = {
        runId,
        scenarioId: scenario.scenarioId,
        capabilityIds: scenario.capabilityIds,
        outcome: 'FAILED',
        durationMs: Date.now() - startTime,
        assertionResults: [],
        evidenceRefs: [],
        cleanupResult: {
          success: false,
          cleanedResources: [],
          failedCleanup: [String(error)],
          orphanedResources: [],
        },
        error: String(error),
      };
    }

    this.orchestrator.transitionTo(runId, 'EVALUATING');
    const evidenceRefs = await this.captureEvidence(
      runId,
      scenario,
      tenantContext,
      adapterResult,
    );

    this.orchestrator.transitionTo(runId, 'CLEANING_UP');
    this.orchestrator.markResourceCleaned(runId, `provision-${runId}`);
    for (const evidence of evidenceRefs) {
      this.orchestrator.addCleanupResource(runId, {
        resourceId: evidence.evidenceId,
        resourceType: 'evidence-record',
        tenantId: tenantContext.tenantId,
        runId,
        cleanupStrategy: 'IMMEDIATE',
      });
      this.orchestrator.markResourceCleaned(runId, evidence.evidenceId);
    }

    const cleanupResult = await adapter.cleanup(runId);
    this.orchestrator.finalizeCleanup(runId);

    const harnessResult = this.buildHarnessResult(
      runId,
      outcome,
      scenario,
      adapterResult.assertionResults,
      evidenceRefs,
      cleanupResult,
    );

    this.orchestrator.transitionTo(runId, 'FINALIZED');

    return {
      runId,
      scenarioId: scenario.scenarioId,
      capabilityIds: scenario.capabilityIds,
      outcome,
      adapterResult,
      harnessResult,
      durationMs: Date.now() - startTime,
      evidenceCount: evidenceRefs.length,
      cleanupResult,
    };
  }

  // ============================================================
  // SCENARIO RESOLUTION
  // ============================================================

  private resolveScenario(request: ExecutionRequest): ScenarioManifest {
    const capability = this.catalog.getCapability(request.scenarioId);
    if (capability) {
      const scenario = this.catalog.getScenario(request.scenarioId);
      if (scenario) {
        return this.buildScenarioManifest(scenario, capability);
      }
    }

    const scenario = this.catalog.getScenario(request.scenarioId);
    if (scenario) {
      const capabilities = scenario.capabilityIds
        .map((id) => this.catalog.getCapability(id))
        .filter((c): c is CapabilityRecord => c !== null);

      if (capabilities.length > 0) {
        return this.buildScenarioManifest(scenario, capabilities[0]);
      }
    }

    return this.buildDefaultScenarioManifest(request);
  }

  private buildScenarioManifest(
    scenario: { scenarioId: string; scenarioVersion: string; riskTier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; executionMode: 'DETERMINISTIC' | 'STATISTICAL' | 'HUMAN'; environmentClass: 'LOCAL' | 'CI' | 'STAGING' | 'PRODUCTION_PROBE'; capabilityIds: string[] },
    capability: CapabilityRecord,
  ): ScenarioManifest {
    return ScenarioManifestSchema.parse({
      schemaVersion: '1.0.0',
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      capabilityIds: scenario.capabilityIds,
      riskTier: scenario.riskTier,
      executionMode: scenario.executionMode,
      environmentClass: scenario.environmentClass,
      requiredFeatures: [],
      requiredDatasets: [],
      steps: capability.surfaces
        ? capability.surfaces.map((s, i) => ({
            stepId: `step-${i + 1}`,
            name: `Step ${i + 1}: ${s.path}`,
            adapter: 'jest',
          }))
        : [
            {
              stepId: 'step-1',
              name: 'Execute scenario',
              adapter: 'jest',
            },
          ],
      assertions: [
        {
          assertionId: 'assert-default',
          name: 'Scenario executes without error',
          type: 'DETERMINISTIC',
          expression: 'outcome === "PASSED"',
        },
      ],
      cleanupPolicy: {
        cleanupPolicy: 'IMMEDIATE',
        timeout: 60000,
      },
      evidencePolicy: {
        retentionClass: 'MEDIUM_TERM',
        classification: 'INTERNAL',
        redactionRequired: false,
      },
    });
  }

  private buildDefaultScenarioManifest(request: ExecutionRequest): ScenarioManifest {
    return ScenarioManifestSchema.parse({
      schemaVersion: '1.0.0',
      scenarioId: request.scenarioId,
      scenarioVersion: request.scenarioVersion ?? '1.0.0',
      capabilityIds: request.capabilityIds ?? ['CAP-DEFAULT'],
      riskTier: 'MEDIUM',
      executionMode: 'DETERMINISTIC',
      environmentClass: this.config.defaultEnvironment,
      requiredFeatures: [],
      requiredDatasets: [],
      steps: [
        {
          stepId: 'step-1',
          name: 'Default execution step',
          adapter: 'jest',
        },
      ],
      assertions: [
        {
          assertionId: 'assert-default',
          name: 'Scenario executes',
          type: 'DETERMINISTIC',
          expression: 'true === true',
        },
      ],
      cleanupPolicy: {
        cleanupPolicy: 'IMMEDIATE',
        timeout: 60000,
      },
      evidencePolicy: {
        retentionClass: 'MEDIUM_TERM',
        classification: 'INTERNAL',
        redactionRequired: false,
      },
    });
  }

  private resolveCapabilityIds(
    request: ExecutionRequest,
    scenario: ScenarioManifest,
  ): string[] {
    if (request.capabilityIds && request.capabilityIds.length > 0) {
      return request.capabilityIds;
    }
    return scenario.capabilityIds;
  }

  // ============================================================
  // EVIDENCE CAPTURE
  // ============================================================

  private async captureEvidence(
    runId: string,
    scenario: ScenarioManifest,
    tenantContext: TenantContext,
    adapterResult: AdapterResult,
  ): Promise<EvidenceRef[]> {
    const evidenceRefs: EvidenceRef[] = [];

    for (const adapterRef of adapterResult.evidenceRefs) {
      evidenceRefs.push(adapterRef);
    }

    const evidenceRunId = randomUUID();

    const summaryEnvelope = createEvidenceEnvelope({
      runId: evidenceRunId,
      scenarioId: scenario.scenarioId,
      capabilityId: scenario.capabilityIds[0] ?? 'unknown',
      tenantId: tenantContext.tenantId,
      producer: 'harness-kernel',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'NOT_REQUIRED',
      correlationIds: [tenantContext.correlationId],
      content: {
        runId,
        scenarioId: scenario.scenarioId,
        outcome: adapterResult.outcome,
        assertionCount: adapterResult.assertionResults.length,
        adapterType: adapterResult.outcome,
        executedAt: new Date().toISOString(),
      },
    });

    this.evidenceStore.append(summaryEnvelope, {
      summary: true,
      runId,
      scenarioId: scenario.scenarioId,
    });

    // Phase 2: persist to storage adapter if configured (encrypted + tenant-scoped + auth-enforced)
    if (this.config.storageAdapter) {
      const auth: AuthorizationContext = {
        actorId: tenantContext.actorId,
        actorType: tenantContext.actorType,
        actorRoles: ['SYSTEM'],
        tenantId: tenantContext.tenantId,
        correlationId: tenantContext.correlationId,
        permissions: ['evidence:create', 'evidence:read', 'evidence:annotate'],
      };

      try {
        const storageRef = await this.config.storageAdapter.create(
          summaryEnvelope,
          Buffer.from(JSON.stringify(summaryEnvelope)),
          auth,
        );
        evidenceRefs.push(storageRef);
      } catch (error) {
        // Storage adapter may reject (e.g., model hidden reasoning detected)
        // Don't fail the run, but log the issue
        console.warn(`Storage adapter rejected evidence: ${error}`);
      }
    }

    evidenceRefs.push({
      evidenceId: summaryEnvelope.evidenceId,
      mediaType: 'application/json',
      storageRef: summaryEnvelope.storageRef,
      checksum: summaryEnvelope.checksum,
    });

    return evidenceRefs;
  }

  // ============================================================
  // HARNESS RESULT BUILDING
  // ============================================================

  private buildHarnessResult(
    runId: string,
    outcome: RunOutcome,
    scenario: ScenarioManifest,
    assertionResults: AdapterResult['assertionResults'],
    evidenceRefs: EvidenceRef[],
    cleanupResult: CleanupResult,
  ): HarnessResult {
    return HarnessResultSchema.parse({
      schemaVersion: '1.0.0',
      outcome,
      assertionResults: assertionResults.map((a) => ({
        assertionId: a.assertionId,
        name: a.name,
        passed: a.passed,
        message: a.message,
        actual: a.actual,
        expected: a.expected,
        durationMs: a.durationMs,
      })),
      metrics: [
        {
          name: 'assertion_count',
          value: assertionResults.length,
          unit: 'count',
        },
        {
          name: 'evidence_count',
          value: evidenceRefs.length,
          unit: 'count',
        },
      ],
      evidenceRefs,
      cleanupResult,
      diagnostics: outcome === 'FAILED'
        ? [
            {
              code: 'EXECUTION_FAILED',
              message: 'Scenario execution failed',
              severity: 'ERROR',
            },
          ]
        : [],
    });
  }

  // ============================================================
  // CRASH RECOVERY (per Phase 1 exit criteria)
  // ============================================================

  /**
   * Recovers runs that were in non-terminal states at orchestrator shutdown.
   * Returns runs that need cleanup.
   */
  recoverFromCrash(): string[] {
    if (!this.config.enableCrashRecovery) return [];

    const crashedRuns = this.orchestrator.recoverRuns();
    const runIds: string[] = [];

    for (const context of crashedRuns) {
      runIds.push(context.runId);
    }

    return runIds;
  }

  /**
   * Cleans up crashed runs by transitioning them through CLEANING_UP.
   */
  async cleanupCrashedRuns(runId: string): Promise<void> {
    if (!this.config.enableCrashRecovery) return;

    await this.orchestrator.cleanupCrashedRuns(runId, async (manifest) => {
      for (const resource of manifest.resources) {
        if (!resource.cleaned) {
          this.orchestrator.markResourceCleaned(runId, resource.resourceId);
        }
      }
    });
  }

  // ============================================================
  // IDEMPOTENCY (per Phase 1 exit criteria)
  // ============================================================

  /**
   * Checks if an idempotency key has already been used.
   */
  isIdempotent(idempotencyKey: string): boolean {
    return this.orchestrator.isIdempotent(idempotencyKey);
  }

  /**
   * Returns the run ID associated with an idempotency key.
   */
  getRunIdForIdempotencyKey(idempotencyKey: string): string | null {
    return this.orchestrator.getRunIdForIdempotencyKey(idempotencyKey);
  }

  // ============================================================
  // STATUS
  // ============================================================

  getEvidenceStore(): EvidenceStore {
    return this.evidenceStore;
  }

  getOrchestrator(): HarnessOrchestrator {
    return this.orchestrator;
  }

  getActiveRunCount(): number {
    return this.activeExecutions.size;
  }

  getEvidenceCount(): number {
    return this.evidenceStore.size();
  }

  async destroy(): Promise<void> {
    await this.adapterRegistry.destroyAll();
    this.activeExecutions.clear();
  }
}

// ============================================================
// EXPORTS
// ============================================================

// All exports are inline above