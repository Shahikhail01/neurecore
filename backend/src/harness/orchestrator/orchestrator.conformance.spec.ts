/**
 * Harness Orchestrator - Conformance Tests
 * Phase 1: Verifies orchestrator meets lifecycle, cancellation, cleanup contracts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from '@jest/globals';
import { HarnessOrchestrator, OrchestratorEvent, createTenantContext, createRunContext, createCleanupManifest, markResourceCleaned, markResourceFailed, finalizeCleanupManifest, TenantContext, RunContext, CleanupManifest } from './index';

describe('Harness Orchestrator', () => {
  let orchestrator: HarnessOrchestrator;

  beforeEach(() => {
    orchestrator = new HarnessOrchestrator({
      defaultTimeoutMs: 5000,
      maxRetries: 2,
      cleanupTimeoutMs: 1000,
      enableCancellation: true,
    });
  });

  afterEach(async () => {
    await orchestrator.destroyAll?.();
  });

  describe('createRun', () => {
    it('creates a run in QUEUED status', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);

      expect(run.status).toBe('QUEUED');
      expect(run.runId).toMatch(/^run-/);
      expect(run.scenarioId).toBe('scenario-001');
      expect(run.capabilityIds).toEqual(['CAP-001']);
      expect(run.tenantContext.tenantId).toBe('tenant-001');
    });

    it('emits QUEUED event on createRun', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const events: unknown[] = [];
      orchestrator.on(OrchestratorEvent.QUEUED, (e) => events.push(e));
      orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      expect(events.length).toBe(1);
    });

    it('creates cleanup manifest alongside run', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      const manifest = orchestrator.getCleanupManifest(run.runId);
      expect(manifest).not.toBeNull();
      expect(manifest?.runId).toBe(run.runId);
    });
  });

  describe('transitionTo', () => {
    it('transitions QUEUED -> PROVISIONING', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      expect(orchestrator.getRun(run.runId)?.status).toBe('PROVISIONING');
    });

    it('transitions PROVISIONING -> RUNNING', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      expect(orchestrator.getRun(run.runId)?.status).toBe('RUNNING');
    });

    it('transitions RUNNING -> EVALUATING', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      expect(orchestrator.getRun(run.runId)?.status).toBe('EVALUATING');
    });

    it('transitions EVALUATING -> CLEANING_UP', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      expect(orchestrator.getRun(run.runId)?.status).toBe('CLEANING_UP');
    });

    it('transitions CLEANING_UP -> FINALIZED', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      orchestrator.transitionTo(run.runId, 'FINALIZED');
      expect(orchestrator.getRun(run.runId)?.status).toBe('FINALIZED');
    });

    it('throws on invalid transition QUEUED -> RUNNING', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      expect(() => orchestrator.transitionTo(run.runId, 'RUNNING')).toThrow();
    });

    it('throws on invalid transition FINALIZED -> anything', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      orchestrator.transitionTo(run.runId, 'FINALIZED');
      expect(() => orchestrator.transitionTo(run.runId, 'RUNNING')).toThrow();
    });

    it('routes failure/cancel through CLEANING_UP (QUEUED -> CLEANING_UP)', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      expect(orchestrator.getRun(run.runId)?.status).toBe('CLEANING_UP');
    });

    it('routes failure/cancel through CLEANING_UP (RUNNING -> CLEANING_UP)', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      expect(orchestrator.getRun(run.runId)?.status).toBe('CLEANING_UP');
    });
  });

  describe('isRunTerminal / isRunFinalized', () => {
    it('returns false for QUEUED', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      expect(orchestrator.isRunTerminal(run.runId)).toBe(false);
      expect(orchestrator.isRunFinalized(run.runId)).toBe(false);
    });

    it('returns true for FINALIZED', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      orchestrator.transitionTo(run.runId, 'FINALIZED');
      expect(orchestrator.isRunTerminal(run.runId)).toBe(true);
      expect(orchestrator.isRunFinalized(run.runId)).toBe(true);
    });
  });

  describe('cancellation', () => {
    it('requestCancellation returns true and sets flag', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      const result = orchestrator.requestCancellation(run.runId, 'User requested');
      expect(result).toBe(true);
      expect(orchestrator.isCancellationRequested(run.runId)).toBe(true);
    });

    it('requestCancellation returns false for terminal run', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      orchestrator.transitionTo(run.runId, 'FINALIZED');
      const result = orchestrator.requestCancellation(run.runId);
      expect(result).toBe(false);
    });

    it('emits CANCELLED event on cancellation', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      const events: unknown[] = [];
      orchestrator.on(OrchestratorEvent.CANCELLED, (e) => events.push(e));
      orchestrator.requestCancellation(run.runId);
      expect(events.length).toBe(1);
    });
  });

  describe('retry', () => {
    it('scheduleRetry increments retryCount and resets to QUEUED', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.scheduleRetry(run.runId);
      const updated = orchestrator.getRun(run.runId);
      expect(updated?.retryCount).toBe(1);
      expect(updated?.status).toBe('QUEUED');
    });

    it('canRetry returns false when maxRetries exceeded', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx, 5000, 1);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.scheduleRetry(run.runId);
      expect(orchestrator.canRetry(run.runId)).toBe(false);
    });

    it('emits RETRY event on scheduleRetry', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      const events: unknown[] = [];
      orchestrator.on(OrchestratorEvent.RETRY, (e) => events.push(e));
      orchestrator.scheduleRetry(run.runId);
      expect(events.length).toBe(1);
    });
  });

  describe('cleanup management', () => {
    it('addCleanupResource adds to manifest', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.addCleanupResource(run.runId, {
        resourceId: 'res-001',
        resourceType: 'database',
        tenantId: 'tenant-001',
        runId: run.runId,
        cleanupStrategy: 'IMMEDIATE',
      });
      const manifest = orchestrator.getCleanupManifest(run.runId);
      expect(manifest?.resources.length).toBe(1);
      expect(manifest?.resources[0].resourceId).toBe('res-001');
    });

    it('markResourceCleaned updates resource status', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.addCleanupResource(run.runId, {
        resourceId: 'res-001',
        resourceType: 'database',
        tenantId: 'tenant-001',
        runId: run.runId,
        cleanupStrategy: 'IMMEDIATE',
      });
      orchestrator.markResourceCleaned(run.runId, 'res-001');
      const manifest = orchestrator.getCleanupManifest(run.runId);
      expect(manifest?.resources[0].cleaned).toBe(true);
      expect(manifest?.resources[0].cleanedAt).not.toBeNull();
    });

    it('markResourceCleanupFailed sets success to false', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.addCleanupResource(run.runId, {
        resourceId: 'res-001',
        resourceType: 'database',
        tenantId: 'tenant-001',
        runId: run.runId,
        cleanupStrategy: 'IMMEDIATE',
      });
      orchestrator.markResourceCleanupFailed(run.runId, 'res-001', 'Connection failed');
      const manifest = orchestrator.getCleanupManifest(run.runId);
      expect(manifest?.success).toBe(false);
      expect(manifest?.resources[0].error).toBe('Connection failed');
    });

    it('finalizeCleanup marks orphaned resources', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.addCleanupResource(run.runId, {
        resourceId: 'res-001',
        resourceType: 'database',
        tenantId: 'tenant-001',
        runId: run.runId,
        cleanupStrategy: 'IMMEDIATE',
      });
      orchestrator.markResourceCleanupFailed(run.runId, 'res-001', 'Failed');
      const finalized = orchestrator.finalizeCleanup(run.runId);
      expect(finalized?.orphanedResources).toContain('res-001');
      expect(finalized?.completedAt).not.toBeNull();
    });
  });

  describe('crash recovery', () => {
    it('recoverRuns returns non-terminal runs', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      const crashed = orchestrator.recoverRuns();
      expect(crashed.some((r) => r.runId === run.runId)).toBe(true);
    });

    it('recoverRuns excludes finalized runs', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.transitionTo(run.runId, 'PROVISIONING');
      orchestrator.transitionTo(run.runId, 'RUNNING');
      orchestrator.transitionTo(run.runId, 'EVALUATING');
      orchestrator.transitionTo(run.runId, 'CLEANING_UP');
      orchestrator.transitionTo(run.runId, 'FINALIZED');
      const crashed = orchestrator.recoverRuns();
      expect(crashed.some((r) => r.runId === run.runId)).toBe(false);
    });
  });

  describe('idempotency', () => {
    it('recordIdempotencyKey and isIdempotent', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.recordIdempotencyKey(run.runId, 'idem-key-001');
      expect(orchestrator.isIdempotent('idem-key-001')).toBe(true);
      expect(orchestrator.isIdempotent('unknown-key')).toBe(false);
    });

    it('getRunIdForIdempotencyKey returns correct run', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const run = orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.recordIdempotencyKey(run.runId, 'idem-key-001');
      expect(orchestrator.getRunIdForIdempotencyKey('idem-key-001')).toBe(run.runId);
      expect(orchestrator.getRunIdForIdempotencyKey('unknown')).toBeNull();
    });
  });

  describe('getRunsForTenant', () => {
    it('returns all runs for a tenant', () => {
      const ctx1 = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      const ctx2 = createTenantContext('tenant-001', 'actor-002', 'AI_AGENT');
      const ctx3 = createTenantContext('tenant-002', 'actor-003', 'HUMAN');
      orchestrator.createRun('scenario-001', ['CAP-001'], ctx1);
      orchestrator.createRun('scenario-002', ['CAP-002'], ctx2);
      orchestrator.createRun('scenario-003', ['CAP-003'], ctx3);
      const runs = orchestrator.getRunsForTenant('tenant-001');
      expect(runs.length).toBe(2);
    });
  });

  describe('status counters', () => {
    it('getActiveRunCount returns non-terminal runs', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.createRun('scenario-002', ['CAP-002'], ctx);
      expect(orchestrator.getActiveRunCount()).toBe(2);
    });

    it('getTotalRunCount returns all runs', () => {
      const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
      orchestrator.createRun('scenario-001', ['CAP-001'], ctx);
      orchestrator.createRun('scenario-002', ['CAP-002'], ctx);
      expect(orchestrator.getTotalRunCount()).toBe(2);
    });
  });
});

describe('TenantContext', () => {
  it('createTenantContext generates valid context', () => {
    const ctx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
    expect(ctx.tenantId).toBe('tenant-001');
    expect(ctx.actorId).toBe('actor-001');
    expect(ctx.actorType).toBe('HUMAN');
    expect(ctx.correlationId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(ctx.idempotencyKey).toMatch(/:/);
  });

  it('createTenantContext accepts parent correlation ID', () => {
    const parentCtx = createTenantContext('tenant-001', 'actor-001', 'HUMAN');
    const childCtx = createTenantContext('tenant-001', 'actor-002', 'AI_AGENT', parentCtx.correlationId);
    expect(childCtx.causationId).toBe(parentCtx.correlationId);
  });
});

describe('CleanupManifest', () => {
  it('createCleanupManifest initializes correctly', () => {
    const manifest = createCleanupManifest('run-001');
    expect(manifest.runId).toBe('run-001');
    expect(manifest.resources).toEqual([]);
    expect(manifest.success).toBe(true);
    expect(manifest.orphanedResources).toEqual([]);
  });
});
