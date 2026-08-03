/**
 * NeureCore Harness - Orchestrator Module
 *
 * This module defines the harness orchestrator responsible for:
 * - Lifecycle management (QUEUED → FINALIZED per §6.3)
 * - Cancellation and timeouts
 * - Retry and concurrency control
 * - Cleanup manifests
 * - Tenant-aware execution context
 *
 * Document ID: NC-HARNESS-ORCHESTRATOR-001
 * Version: 1.0
 * Status: PHASE_1_IMPLEMENTED
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import type { RunStatus, RunOutcome } from '../contracts';
import {
  RunStatusSchema,
  RunOutcomeSchema,
  validateTransition,
  isFinalized,
  isTerminal,
  VALID_TRANSITIONS,
} from '../contracts';

// ============================================================
// TENANT-AWARE EXECUTION CONTEXT
// ============================================================

export interface TenantContext {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
}

export function createTenantContext(
  tenantId: string,
  actorId: string,
  actorType: TenantContext['actorType'] = 'HUMAN',
  parentCorrelationId: string | null = null,
): TenantContext {
  const correlationId = randomUUID();
  return {
    tenantId,
    actorId,
    actorType,
    correlationId,
    causationId: parentCorrelationId,
    idempotencyKey: `${correlationId}:${randomUUID()}`,
  };
}

// ============================================================
// RUN CONTEXT
// ============================================================

export interface RunContext {
  runId: string;
  scenarioId: string;
  capabilityIds: string[];
  tenantContext: TenantContext;
  status: RunStatus;
  startedAt: Date;
  completedAt: Date | null;
  timeoutMs: number;
  retryCount: number;
  maxRetries: number;
  cancellationRequested: boolean;
  error: string | null;
}

export function createRunContext(
  scenarioId: string,
  capabilityIds: string[],
  tenantContext: TenantContext,
  timeoutMs: number = 300_000,
  maxRetries: number = 0,
): RunContext {
  return {
    runId: `run-${Date.now()}-${randomUUID().slice(0, 8)}`,
    scenarioId,
    capabilityIds,
    tenantContext,
    status: 'QUEUED',
    startedAt: new Date(),
    completedAt: null,
    timeoutMs,
    retryCount: 0,
    maxRetries,
    cancellationRequested: false,
    error: null,
  };
}

// ============================================================
// CLEANUP MANIFEST
// ============================================================

export interface CleanupResource {
  resourceId: string;
  resourceType: string;
  tenantId: string;
  runId: string;
  cleanupStrategy: 'IMMEDIATE' | 'ON_SUCCESS' | 'MANUAL' | 'NEVER';
  cleaned: boolean;
  cleanedAt: Date | null;
  error: string | null;
}

export interface CleanupManifest {
  runId: string;
  resources: CleanupResource[];
  startedAt: Date;
  completedAt: Date | null;
  success: boolean;
  orphanedResources: string[];
}

export function createCleanupManifest(runId: string): CleanupManifest {
  return {
    runId,
    resources: [],
    startedAt: new Date(),
    completedAt: null,
    success: true,
    orphanedResources: [],
  };
}

export function addResourceToManifest(
  manifest: CleanupManifest,
  resource: Omit<CleanupResource, 'cleaned' | 'cleanedAt' | 'error'>,
): void {
  manifest.resources.push({
    ...resource,
    cleaned: false,
    cleanedAt: null,
    error: null,
  });
}

export function markResourceCleaned(
  manifest: CleanupManifest,
  resourceId: string,
): void {
  const resource = manifest.resources.find((r) => r.resourceId === resourceId);
  if (resource) {
    resource.cleaned = true;
    resource.cleanedAt = new Date();
  }
}

export function markResourceFailed(
  manifest: CleanupManifest,
  resourceId: string,
  error: string,
): void {
  const resource = manifest.resources.find((r) => r.resourceId === resourceId);
  if (resource) {
    resource.cleaned = false;
    resource.error = error;
    manifest.success = false;
  }
}

export function finalizeCleanupManifest(manifest: CleanupManifest): CleanupManifest {
  manifest.completedAt = new Date();
  manifest.orphanedResources = manifest.resources
    .filter((r) => !r.cleaned)
    .map((r) => r.resourceId);
  return manifest;
}

// ============================================================
// ORCHESTRATOR EVENTS
// ============================================================

export enum OrchestratorEvent {
  QUEUED = 'queued',
  PROVISIONING = 'provisioning',
  RUNNING = 'running',
  EVALUATING = 'evaluating',
  CLEANING_UP = 'cleaning_up',
  FINALIZED = 'finalized',
  CANCELLED = 'cancelled',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  RETRY = 'retry',
}

export interface OrchestratorEventPayload {
  runId: string;
  scenarioId: string;
  capabilityIds: string[];
  status: RunStatus;
  timestamp: Date;
  error?: string;
  retryCount?: number;
}

// ============================================================
// ORCHESTRATOR
// ============================================================

export interface OrchestratorConfig {
  defaultTimeoutMs: number;
  maxRetries: number;
  cleanupTimeoutMs: number;
  enableCancellation: boolean;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  defaultTimeoutMs: 300_000,
  maxRetries: 0,
  cleanupTimeoutMs: 60_000,
  enableCancellation: true,
};

export class HarnessOrchestrator extends EventEmitter {
  private readonly runs = new Map<string, RunContext>();
  private readonly cleanups = new Map<string, CleanupManifest>();
  private readonly config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================

  /**
   * Creates a new run and transitions to QUEUED.
   */
  createRun(
    scenarioId: string,
    capabilityIds: string[],
    tenantContext: TenantContext,
    timeoutMs?: number,
    maxRetries?: number,
  ): RunContext {
    const context = createRunContext(
      scenarioId,
      capabilityIds,
      tenantContext,
      timeoutMs ?? this.config.defaultTimeoutMs,
      maxRetries ?? this.config.maxRetries,
    );

    this.runs.set(context.runId, context);
    this.cleanups.set(context.runId, createCleanupManifest(context.runId));

    // Run already starts in QUEUED - just emit the event
    this.emitEvent(OrchestratorEvent.QUEUED, context);

    return context;
  }

  /**
   * Transitions a run to a new status, validating the state machine.
   */
  transitionTo(runId: string, newStatus: RunStatus): RunContext {
    const context = this.runs.get(runId);
    if (!context) throw new Error(`Run ${runId} not found`);

    if (!validateTransition(context.status, newStatus)) {
      throw new Error(
        `Invalid transition ${context.status} → ${newStatus} for run ${runId}`,
      );
    }

    context.status = newStatus;

    if (newStatus === 'FINALIZED' || newStatus === 'CLEANING_UP') {
      context.completedAt = new Date();
    }

    const eventMap: Record<RunStatus, OrchestratorEvent> = {
      QUEUED: OrchestratorEvent.QUEUED,
      PROVISIONING: OrchestratorEvent.PROVISIONING,
      RUNNING: OrchestratorEvent.RUNNING,
      EVALUATING: OrchestratorEvent.EVALUATING,
      CLEANING_UP: OrchestratorEvent.CLEANING_UP,
      FINALIZED: OrchestratorEvent.FINALIZED,
    };

    this.emitEvent(eventMap[newStatus], context);

    return context;
  }

  /**
   * Gets the current context for a run.
   */
  getRun(runId: string): RunContext | null {
    return this.runs.get(runId) ?? null;
  }

  /**
   * Gets all runs for a tenant.
   */
  getRunsForTenant(tenantId: string): RunContext[] {
    return [...this.runs.values()].filter(
      (r) => r.tenantContext.tenantId === tenantId,
    );
  }

  /**
   * Checks if a run is in a terminal state.
   */
  isRunTerminal(runId: string): boolean {
    const context = this.runs.get(runId);
    if (!context) return false;
    return isTerminal(context.status);
  }

  /**
   * Checks if a run is finalized.
   */
  isRunFinalized(runId: string): boolean {
    const context = this.runs.get(runId);
    if (!context) return false;
    return isFinalized(context.status);
  }

  // ============================================================
  // CANCELLATION
  // ============================================================

  /**
   * Requests cancellation for a run.
   * The run will transition through CLEANING_UP before finalizing.
   */
  requestCancellation(runId: string, reason?: string): boolean {
    if (!this.config.enableCancellation) return false;

    const context = this.runs.get(runId);
    if (!context) return false;
    if (isTerminal(context.status)) return false;

    context.cancellationRequested = true;
    if (context.error === null) {
      context.error = reason ?? 'Cancellation requested';
    }

    this.emitEvent(OrchestratorEvent.CANCELLED, context);
    return true;
  }

  /**
   * Checks if cancellation has been requested for a run.
   */
  isCancellationRequested(runId: string): boolean {
    const context = this.runs.get(runId);
    return context?.cancellationRequested ?? false;
  }

  // ============================================================
  // TIMEOUT MANAGEMENT
  // ============================================================

  private readonly timeoutTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Starts the timeout timer for a run.
   */
  startTimeout(runId: string): void {
    const context = this.runs.get(runId);
    if (!context) return;

    const timer = setTimeout(() => {
      this.handleTimeout(runId);
    }, context.timeoutMs);

    this.timeoutTimers.set(runId, timer);
  }

  /**
   * Cancels the timeout timer for a run.
   */
  cancelTimeout(runId: string): void {
    const timer = this.timeoutTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(runId);
    }
  }

  /**
   * Handles a timeout event.
   */
  private handleTimeout(runId: string): void {
    const context = this.runs.get(runId);
    if (!context) return;
    if (isTerminal(context.status)) return;

    context.error = `Run timed out after ${context.timeoutMs}ms`;
    this.emitEvent(OrchestratorEvent.TIMEOUT, context);

    if (!validateTransition(context.status, 'CLEANING_UP')) {
      return;
    }
    this.transitionTo(runId, 'CLEANING_UP');
  }

  // ============================================================
  // RETRY MANAGEMENT
  // ============================================================

  /**
   * Schedules a retry for a failed run.
   */
  scheduleRetry(runId: string): boolean {
    const context = this.runs.get(runId);
    if (!context) return false;
    if (context.retryCount >= context.maxRetries) return false;
    if (isTerminal(context.status)) return false;

    context.retryCount++;
    context.cancellationRequested = false;
    context.error = null;
    context.status = 'QUEUED';
    context.startedAt = new Date();

    this.emitEvent(OrchestratorEvent.RETRY, context);
    return true;
  }

  /**
   * Checks if a run can be retried.
   */
  canRetry(runId: string): boolean {
    const context = this.runs.get(runId);
    if (!context) return false;
    if (context.retryCount >= context.maxRetries) return false;
    if (isTerminal(context.status)) return false;
    return true;
  }

  // ============================================================
  // CLEANUP MANAGEMENT
  // ============================================================

  /**
   * Gets the cleanup manifest for a run.
   */
  getCleanupManifest(runId: string): CleanupManifest | null {
    return this.cleanups.get(runId) ?? null;
  }

  /**
   * Adds a resource to the cleanup manifest for a run.
   */
  addCleanupResource(
    runId: string,
    resource: Omit<CleanupResource, 'cleaned' | 'cleanedAt' | 'error'>,
  ): void {
    const manifest = this.cleanups.get(runId);
    if (!manifest) throw new Error(`Cleanup manifest for run ${runId} not found`);
    addResourceToManifest(manifest, resource);
  }

  /**
   * Marks a resource as cleaned in the manifest.
   */
  markResourceCleaned(runId: string, resourceId: string): void {
    const manifest = this.cleanups.get(runId);
    if (!manifest) return;
    markResourceCleaned(manifest, resourceId);
  }

  /**
   * Marks a resource as failed in the manifest.
   */
  markResourceCleanupFailed(runId: string, resourceId: string, error: string): void {
    const manifest = this.cleanups.get(runId);
    if (!manifest) return;
    markResourceFailed(manifest, resourceId, error);
  }

  /**
   * Finalizes the cleanup manifest for a run.
   */
  finalizeCleanup(runId: string): CleanupManifest | null {
    const manifest = this.cleanups.get(runId);
    if (!manifest) return null;
    return finalizeCleanupManifest(manifest);
  }

  // ============================================================
  // RUN COMPLETION
  // ============================================================

  /**
   * Completes a run with an outcome and transitions to CLEANING_UP.
   */
  completeRun(runId: string, outcome: RunOutcome, error?: string): RunContext {
    const context = this.runs.get(runId);
    if (!context) throw new Error(`Run ${runId} not found`);
    if (isTerminal(context.status)) throw new Error(`Run ${runId} is already terminal`);

    if (error) context.error = error;

    if (outcome === 'CANCELLED') {
      this.transitionTo(runId, 'CLEANING_UP');
      return context;
    }

    if (!validateTransition(context.status, 'CLEANING_UP')) {
      throw new Error(`Cannot complete run ${runId} from status ${context.status}`);
    }

    this.transitionTo(runId, 'CLEANING_UP');
    return context;
  }

  /**
   * Finalizes a run after cleanup is complete.
   */
  finalizeRun(runId: string, outcome: RunOutcome): RunContext {
    const context = this.runs.get(runId);
    if (!context) throw new Error(`Run ${runId} not found`);

    if (context.status !== 'CLEANING_UP') {
      throw new Error(`Run ${runId} must be in CLEANING_UP to finalize, got ${context.status}`);
    }

    this.cancelTimeout(runId);
    this.finalizeCleanup(runId);

    if (context.error && outcome === 'PASSED') {
      context.error = null;
    }

    this.transitionTo(runId, 'FINALIZED');
    return context;
  }

  // ============================================================
  // CRASH RECOVERY
  // ============================================================

  /**
   * Recovers runs that were in non-terminal states at shutdown.
   * Returns runs that need to be cleaned up.
   */
  recoverRuns(): RunContext[] {
    const crashedRuns: RunContext[] = [];

    for (const [runId, context] of this.runs) {
      if (!isTerminal(context.status)) {
        context.error = 'Run recovered after orchestrator restart';
        crashedRuns.push(context);
      }
    }

    return crashedRuns;
  }

  /**
   * Cleans up crashed runs by transitioning them through CLEANING_UP.
   */
  async cleanupCrashedRuns(
    runId: string,
    cleanupFn: (manifest: CleanupManifest) => Promise<void>,
  ): Promise<void> {
    const context = this.runs.get(runId);
    if (!context) return;
    if (isTerminal(context.status)) return;

    this.transitionTo(runId, 'CLEANING_UP');

    const manifest = this.cleanups.get(runId);
    if (manifest) {
      try {
        await cleanupFn(manifest);
      } catch (err) {
        context.error = `Cleanup failed: ${err}`;
      }
    }

    this.finalizeCleanup(runId);
    this.transitionTo(runId, 'FINALIZED');
  }

  // ============================================================
  // IDEMPOTENCY
  // ============================================================

  private readonly idempotencyKeys = new Map<string, string>();

  /**
   * Checks if an idempotency key has already been used.
   */
  isIdempotent(idempotencyKey: string): boolean {
    return this.idempotencyKeys.has(idempotencyKey);
  }

  /**
   * Records an idempotency key for a run.
   */
  recordIdempotencyKey(runId: string, idempotencyKey: string): void {
    this.idempotencyKeys.set(idempotencyKey, runId);
  }

  /**
   * Gets the run ID associated with an idempotency key.
   */
  getRunIdForIdempotencyKey(idempotencyKey: string): string | null {
    return this.idempotencyKeys.get(idempotencyKey) ?? null;
  }

  // ============================================================
  // EVENT EMISSION
  // ============================================================

  private emitEvent(event: OrchestratorEvent, context: RunContext): void {
    const payload: OrchestratorEventPayload = {
      runId: context.runId,
      scenarioId: context.scenarioId,
      capabilityIds: context.capabilityIds,
      status: context.status,
      timestamp: new Date(),
      error: context.error ?? undefined,
      retryCount: context.retryCount,
    };
    this.emit(event, payload);
  }

  // ============================================================
  // STATUS
  // ============================================================

  getActiveRunCount(): number {
    let count = 0;
    for (const context of this.runs.values()) {
      if (!isTerminal(context.status)) count++;
    }
    return count;
  }

  getTotalRunCount(): number {
    return this.runs.size;
  }
}