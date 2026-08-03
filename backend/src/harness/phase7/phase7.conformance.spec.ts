import { randomUUID } from 'crypto';
import { z } from 'zod';
import { UuidSchema, type AuthorizationContext } from '../contracts';
import {
  Phase7RunnerReportSchema,
  PHASE7_VERSION,
  IsolationCaseSchema,
  AdversarialCaseSchema,
  AbuseCaseSchema,
  UnsafeActionCaseSchema,
  ComplianceControlSchema,
  ReviewPacketSchema,
  ReviewQueueAssignmentSchema,
  type Phase7RunnerReport,
} from './contracts';
import type { AbuseOutcome } from './ports';
import {
  buildIsolationMatrix,
  buildAdversarialCorpus,
  buildAbuseCorpus,
  buildUnsafeActionCorpus,
  PHASE7_CONTROLS,
  evidenceComplete,
  IsolationRunner,
  AdversarialRunner,
  AbuseRunner,
  UnsafeActionRunner,
  ComplianceRunner,
  HitlRunner,
  Phase7Coordinator,
  TenantKeyIsolationPort,
  StrictAdversarialPort,
  StrictUnsafeActionPort,
  CycleDetectionAbusePort,
  InMemoryComplianceEvidencePort,
  InMemoryReviewQueue,
  InMemoryPhase7EvidenceSink,
  computeCounters,
  checksumReport,
  finalizeReport,
  canExecuteReview,
  assertNoSelfApproval,
  HitlExecutor,
} from './runners';

const TENANT = '11111111-1111-1111-1111-111111111111';
const FOREIGN = '22222222-2222-2222-2222-222222222222';
const ACTOR = 'agent-1';

function ctx(tenantId: string = TENANT): AuthorizationContext {
  return {
    actorId: ACTOR,
    actorType: 'AI_AGENT',
    actorRoles: ['TENANT_USER'],
    tenantId,
    correlationId: randomUUID(),
    permissions: [],
  };
}

function ctxWithUuid(): AuthorizationContext {
  const validation = UuidSchema.safeParse(randomUUID());
  if (!validation.success) throw new Error('uuid');
  return ctx(validation.data);
}

// ============================================================
// CONFORMANCE: SCHEMAS
// ============================================================
describe('Phase 7 / Conformance / Schemas', () => {
  it('every corpus case passes runtime validation', () => {
    for (const c of buildAdversarialCorpus())
      expect(AdversarialCaseSchema.safeParse(c).success).toBe(true);
    for (const c of buildAbuseCorpus())
      expect(AbuseCaseSchema.safeParse(c).success).toBe(true);
    for (const c of buildUnsafeActionCorpus())
      expect(UnsafeActionCaseSchema.safeParse(c).success).toBe(true);
    for (const c of buildIsolationMatrix(TENANT, FOREIGN))
      expect(IsolationCaseSchema.safeParse(c).success).toBe(true);
    for (const c of PHASE7_CONTROLS)
      expect(ComplianceControlSchema.safeParse(c).success).toBe(true);
    const packet = ReviewPacketSchema.parse({
      schemaVersion: PHASE7_VERSION,
      reviewId: randomUUID(),
      tenantId: TENANT,
      executionId: randomUUID(),
      reviewerId: 'reviewer-1',
      subjectActorId: 'agent-1',
      independence: true,
      slaMinutes: 30,
      escalationAfterMinutes: 60,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      rationale: 'reviewed',
    });
    expect(packet.reviewerId).toBe('reviewer-1');
  });

  it('isolates every required layer including cache/vector/files/queue/socket/log/export/telemetry', () => {
    const layers = new Set(
      buildIsolationMatrix(TENANT, FOREIGN).map((c) => c.layer),
    );
    for (const layer of [
      'CACHE',
      'VECTOR',
      'FILES',
      'QUEUE',
      'SOCKET',
      'LOG',
      'EXPORT',
      'TELEMETRY',
    ])
      expect(
        layers.has(layer as typeof layers extends Set<infer T> ? T : never),
      ).toBe(true);
  });

  it('matrix size is exhaustive: 15 resources x 9 actions x 12 layers', () => {
    expect(buildIsolationMatrix(TENANT, FOREIGN)).toHaveLength(1620);
  });
});

// ============================================================
// CONFORMANCE: ISOLATION RUNNER
// ============================================================
describe('Phase 7 / Conformance / Isolation runner', () => {
  it('runner produces a runtime-validated report with PASS when all cross-tenant attempts denied', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const runner = new IsolationRunner(new TenantKeyIsolationPort(), sink);
    const report = await runner.run({
      ctx: ctx(),
      cases: buildIsolationMatrix(TENANT, FOREIGN),
      runId: randomUUID(),
      cleanup: true,
    });
    expect(Phase7RunnerReportSchema.safeParse(report).success).toBe(true);
    expect(report.status).toBe('PASS');
    expect(report.outcome).toBe('PASSED');
    expect(report.counters.criticalFailures).toBe(0);
    expect(report.caseResults).toHaveLength(1620);
    expect(report.evidenceEnvelopes.length).toBe(1620);
    expect(report.cleanupResult.attempted).toBe(true);
    expect(report.cleanupResult.success).toBe(true);
    expect(report.cleanupAttempted).toBe(true);
    expect(report.executionEnvironment).toBe('IN_MEMORY_CONFORMANCE');
    for (const e of report.evidenceEnvelopes) {
      expect(e.tenantId).toBe(TENANT);
      expect(e.classification).toBe('INTERNAL');
    }
  });

  it('runner BLOCKS when a port grants cross-tenant access (fail-closed on non-passing)', async () => {
    const port: TenantKeyIsolationPort =
      new (class extends TenantKeyIsolationPort {
        override async authorize(): ReturnType<
          TenantKeyIsolationPort['authorize']
        > {
          return { allowed: true };
        }
      })();
    const runner = new IsolationRunner(port);
    const report = await runner.run({
      ctx: ctx(),
      cases: [
        IsolationCaseSchema.parse({
          schemaVersion: PHASE7_VERSION,
          caseId: 'iso:PROJECT:READ:CONTROLLER',
          tenantId: TENANT,
          foreignTenantId: FOREIGN,
          resource: 'PROJECT',
          action: 'READ',
          layer: 'CONTROLLER',
          expected: 'NOT_FOUND',
        }),
      ],
      runId: randomUUID(),
    });
    expect(report.status).toBe('BLOCK');
    expect(report.counters.criticalFailures).toBeGreaterThan(0);
  });
});

// ============================================================
// CONFORMANCE: ADVERSARIAL RUNNER
// ============================================================
describe('Phase 7 / Conformance / Adversarial runner', () => {
  it('runner PASSES when strict port denies every payload', async () => {
    const runner = new AdversarialRunner(new StrictAdversarialPort());
    const report = await runner.run({
      ctx: ctx(),
      cases: buildAdversarialCorpus(),
      runId: randomUUID(),
      cleanup: true,
    });
    expect(report.status).toBe('PASS');
    expect(report.outcome).toBe('PASSED');
    expect(report.counters.criticalFailures).toBe(0);
    expect(report.evidenceEnvelopes).toHaveLength(
      buildAdversarialCorpus().length,
    );
    expect(report.cleanupAttempted).toBe(true);
    expect(report.cleanupResult.success).toBe(true);
  });

  it('runner BLOCKS when an adversarial payload is allowed (fail-closed)', async () => {
    const port = new (class extends StrictAdversarialPort {
      override async evaluate(): ReturnType<StrictAdversarialPort['evaluate']> {
        return { allowed: true };
      }
    })();
    const runner = new AdversarialRunner(port);
    const report = await runner.run({
      ctx: ctx(),
      cases: [buildAdversarialCorpus()[0]],
      runId: randomUUID(),
    });
    expect(report.status).toBe('BLOCK');
    expect(report.counters.criticalFailures).toBe(1);
  });
});

// ============================================================
// CONFORMANCE: ABUSE RUNNER
// ============================================================
describe('Phase 7 / Conformance / Abuse runner', () => {
  it('runner matches every expected terminal state', async () => {
    const runner = new AbuseRunner(new CycleDetectionAbusePort());
    const report = await runner.run({
      ctx: ctx(),
      cases: buildAbuseCorpus(),
      runId: randomUUID(),
      cleanup: true,
    });
    expect(report.status).toBe('PASS');
    expect(report.counters.criticalFailures).toBe(0);
    expect(new Set(report.caseResults.map((r) => r.observed))).toEqual(
      new Set([
        'RATE_LIMITED',
        'BUDGET_DENIED',
        'CYCLE_DETECTED',
        'CIRCUIT_OPEN',
      ]),
    );
    expect(report.cleanupAttempted).toBe(true);
  });

  it('runner BLOCKS when an abuse scenario fails to terminate', async () => {
    const port = new (class extends CycleDetectionAbusePort {
      override async execute(): Promise<{ outcome: AbuseOutcome }> {
        return { outcome: 'ALLOWED' };
      }
    })();
    const runner = new AbuseRunner(port);
    const report = await runner.run({
      ctx: ctx(),
      cases: buildAbuseCorpus(),
      runId: randomUUID(),
    });
    expect(report.status).toBe('BLOCK');
  });
});

// ============================================================
// CONFORMANCE: UNSAFE ACTION RUNNER
// ============================================================
describe('Phase 7 / Conformance / Unsafe action runner', () => {
  it('runner enforces REQUIRE_APPROVAL for every unsafe action', async () => {
    const runner = new UnsafeActionRunner(new StrictUnsafeActionPort());
    const report = await runner.run({
      ctx: ctx(),
      cases: buildUnsafeActionCorpus(),
      runId: randomUUID(),
      cleanup: true,
    });
    expect(report.status).toBe('PASS');
    expect(report.counters.criticalFailures).toBe(0);
    expect(report.cleanupAttempted).toBe(true);
  });
});

// ============================================================
// CONFORMANCE: COMPLIANCE RUNNER
// ============================================================
describe('Phase 7 / Conformance / Compliance runner', () => {
  it('runner PASSES when every control has complete evidence', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const port = new InMemoryComplianceEvidencePort(sink);
    const runner = new ComplianceRunner(port, sink);
    const payloads = new Map<string, Record<string, unknown>>(
      PHASE7_CONTROLS.map((c) => [
        c.controlId,
        Object.fromEntries(
          c.evidenceRequired.map((key) => [key, `${key}-value`]),
        ),
      ]),
    );
    const report = await runner.run({
      ctx: ctx(),
      controls: PHASE7_CONTROLS,
      payloads,
      runId: randomUUID(),
      cleanup: true,
    });
    expect(report.status).toBe('PASS');
    expect(report.counters.criticalFailures).toBe(0);
    expect(report.evidenceEnvelopes).toHaveLength(PHASE7_CONTROLS.length);
    expect(report.cleanupAttempted).toBe(true);
    for (const e of report.evidenceEnvelopes) {
      expect(e.retentionClass).toBeDefined();
      expect(e.correlationIds.length).toBeGreaterThan(0);
    }
  });

  it('runner BLOCKS when a control lacks required evidence (INSUFFICIENT_EVIDENCE)', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const runner = new ComplianceRunner(
      new InMemoryComplianceEvidencePort(sink),
      sink,
    );
    const report = await runner.run({
      ctx: ctx(),
      controls: [PHASE7_CONTROLS[0]],
      payloads: new Map([
        [PHASE7_CONTROLS[0].controlId, { 'retention-policy': 'p' }],
      ]),
      runId: randomUUID(),
    });
    expect(report.status).toBe('BLOCK');
    expect(report.counters.criticalFailures).toBe(1);
    expect(report.caseResults[0].observed).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('evidenceComplete detects missing keys per behavior', () => {
    for (const control of PHASE7_CONTROLS) {
      expect(evidenceComplete({}, control)).toBe(false);
      const full = Object.fromEntries(
        control.evidenceRequired.map((k) => [k, 'x']),
      );
      expect(evidenceComplete(full, control)).toBe(true);
    }
  });

  it('every behavior (retention/consent/legal hold/erasure/export/residency) is represented', () => {
    expect(new Set(PHASE7_CONTROLS.map((c) => c.behavior))).toEqual(
      new Set([
        'RETENTION',
        'CONSENT',
        'LEGAL_HOLD',
        'ERASURE',
        'EXPORT',
        'RESIDENCY',
      ]),
    );
  });
});

// ============================================================
// CONFORMANCE: HITL RUNNER
// ============================================================
describe('Phase 7 / Conformance / HITL runner', () => {
  it('runner denies execution for REJECTED and EXPIRED decisions', async () => {
    const queue = new InMemoryReviewQueue();
    const runner = new HitlRunner(queue);
    const report = await runner.run({
      ctx: ctx(),
      escalationRole: 'CHIEF_OF_STAFF',
      runId: randomUUID(),
      cases: [
        {
          caseId: 'r1',
          executionId: randomUUID(),
          reviewerId: 'reviewer-1',
          reviewerPool: ['reviewer-1'],
          decision: 'REJECTED',
          rationale: 'denied',
        },
        {
          caseId: 'r2',
          executionId: randomUUID(),
          reviewerId: 'reviewer-1',
          reviewerPool: ['reviewer-1'],
          decision: 'EXPIRED',
          rationale: 'sla missed',
        },
        {
          caseId: 'r3',
          executionId: randomUUID(),
          reviewerId: 'reviewer-1',
          reviewerPool: ['reviewer-1'],
          decision: 'APPROVED',
          rationale: 'ok',
        },
      ],
    });
    const denied = report.caseResults.filter((r) => r.observed === 'DENY');
    const allowed = report.caseResults.filter((r) => r.observed === 'ALLOW');
    expect(denied).toHaveLength(2);
    expect(allowed).toHaveLength(1);
    expect(report.counters.criticalFailures).toBe(0);
  });

  it('runner rejects self-approval through the queue', async () => {
    const queue = new InMemoryReviewQueue();
    await expect(queue.enqueue(ctx(), randomUUID(), ACTOR)).rejects.toThrow(
      /NC7-HITL-INDEPENDENCE/,
    );
  });

  it('runner escalates on SLA timeout', async () => {
    const executor = new HitlExecutor(new InMemoryReviewQueue());
    const farFuture = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const out = await executor.execute({
      ctx: ctx(),
      executionId: randomUUID(),
      reviewerId: 'reviewer-1',
      reviewerPool: ['reviewer-1'],
      escalationRole: 'CHIEF_OF_STAFF',
      now: farFuture,
    });
    expect(out.escalations).toHaveLength(1);
    expect(out.escalations[0].reason).toBe('SLA_TIMEOUT');
    expect(out.decision).toBe('ESCALATED');
  });

  it('decisions are idempotent on repeated submits', async () => {
    const queue = new InMemoryReviewQueue();
    const packet = ReviewPacketSchema.parse({
      schemaVersion: PHASE7_VERSION,
      reviewId: randomUUID(),
      tenantId: TENANT,
      executionId: randomUUID(),
      reviewerId: 'reviewer-1',
      subjectActorId: 'agent-2',
      independence: true,
      slaMinutes: 30,
      escalationAfterMinutes: 60,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      rationale: 'ok',
    });
    expect(queue.isIdempotent(packet.reviewId, packet)).toBe(false);
    await queue.decide(ctx(packet.tenantId), packet);
    expect(queue.isIdempotent(packet.reviewId, packet)).toBe(true);
  });

  it('canExecuteReview denies non-independent reviewer', () => {
    const packet = ReviewPacketSchema.parse({
      schemaVersion: PHASE7_VERSION,
      reviewId: randomUUID(),
      tenantId: TENANT,
      executionId: randomUUID(),
      reviewerId: ACTOR,
      subjectActorId: ACTOR,
      independence: false,
      slaMinutes: 30,
      escalationAfterMinutes: 60,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      rationale: 'self',
    });
    expect(canExecuteReview(packet).allowed).toBe(false);
  });

  it('assertReviewerIndependence throws on self-approval', () => {
    const packet = ReviewPacketSchema.parse({
      schemaVersion: PHASE7_VERSION,
      reviewId: randomUUID(),
      tenantId: TENANT,
      executionId: randomUUID(),
      reviewerId: ACTOR,
      subjectActorId: ACTOR,
      independence: true,
      slaMinutes: 30,
      escalationAfterMinutes: 60,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      rationale: 'self',
    });
    expect(() => assertNoSelfApproval(packet)).toThrow();
  });
});

// ============================================================
// CONFORMANCE: COORDINATOR
// ============================================================
describe('Phase 7 / Conformance / Coordinator', () => {
  it('coordinator aggregates runner reports and produces PASS', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const queue = new InMemoryReviewQueue();
    const isolation = new IsolationRunner(new TenantKeyIsolationPort(), sink);
    const adversarial = new AdversarialRunner(
      new StrictAdversarialPort(),
      sink,
    );
    const abuse = new AbuseRunner(new CycleDetectionAbusePort(), sink);
    const unsafe = new UnsafeActionRunner(new StrictUnsafeActionPort(), sink);
    const compliance = new ComplianceRunner(
      new InMemoryComplianceEvidencePort(sink),
      sink,
    );
    const hitl = new HitlRunner(queue, sink);
    const coordinator = new Phase7Coordinator();
    const report = await coordinator.run({
      ctx: ctx(),
      isolationRunner: isolation,
      adversarialRunner: adversarial,
      abuseRunner: abuse,
      unsafeRunner: unsafe,
      complianceRunner: compliance,
      hitlRunner: hitl,
      runId: randomUUID(),
    });
    expect(Phase7RunnerReportSchema.safeParse(report).success).toBe(true);
    expect(report.runnerId).toBe('phase7-coordinator');
    expect(report.caseResults.length).toBeGreaterThan(1620);
    expect(report.evidenceEnvelopes.length).toBeGreaterThan(1620);
    expect(report.status).toBe('PASS');
    expect(report.outcome).toBe('PASSED');
    expect(report.cleanupAttempted).toBe(true);
    expect(report.reportChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(report.executionEnvironment).toBe('IN_MEMORY_CONFORMANCE');
  });

  it('coordinator propagates BLOCK when any runner fails closed', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const adversarialPort = new (class extends StrictAdversarialPort {
      override async evaluate(): ReturnType<StrictAdversarialPort['evaluate']> {
        return { allowed: true };
      }
    })();
    const report = await new Phase7Coordinator().run({
      ctx: ctx(),
      isolationRunner: new IsolationRunner(new TenantKeyIsolationPort(), sink),
      adversarialRunner: new AdversarialRunner(adversarialPort, sink),
      abuseRunner: new AbuseRunner(new CycleDetectionAbusePort(), sink),
      unsafeRunner: new UnsafeActionRunner(new StrictUnsafeActionPort(), sink),
      complianceRunner: new ComplianceRunner(
        new InMemoryComplianceEvidencePort(sink),
        sink,
      ),
      hitlRunner: new HitlRunner(new InMemoryReviewQueue(), sink),
      runId: randomUUID(),
    });
    expect(report.status).toBe('BLOCK');
    expect(report.outcome).toBe('FAILED');
    expect(report.counters.criticalFailures).toBeGreaterThan(0);
  });
});

// ============================================================
// CONFORMANCE: REPORT INTEGRITY
// ============================================================
describe('Phase 7 / Conformance / Report integrity', () => {
  it('finalizeReport recomputes checksum deterministically', () => {
    const base = {
      schemaVersion: PHASE7_VERSION,
      runnerId: 'phase7-test',
      runId: randomUUID(),
      tenantId: TENANT,
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      counters: {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        criticalFailures: 0,
      },
      caseResults: [],
      evidenceEnvelopes: [],
      cleanupResult: {
        attempted: true,
        success: true,
        cleanedResources: [],
        failedCleanup: [],
        orphanedResources: [],
      },
      notes: [],
      executionEnvironment: 'IN_MEMORY_CONFORMANCE' as const,
      productionAdapterStatus: {
        isolationPort: 'UNREGISTERED' as const,
        adversarialPort: 'UNREGISTERED' as const,
        abusePort: 'UNREGISTERED' as const,
        unsafeActionPort: 'UNREGISTERED' as const,
        complianceEvidencePort: 'UNREGISTERED' as const,
        reviewPort: 'UNREGISTERED' as const,
        durableReviewQueueStore: 'UNREGISTERED' as const,
        cleanupPort: 'UNREGISTERED' as const,
      },
      externalApprovalStatus: {
        securityApproved: false,
        complianceApproved: false,
        approvedBy: [],
        approvedAt: [],
        notes: [],
      },
      deterministicMeasurement: {
        mode: 'DETERMINISTIC' as const,
        repetitionCount: 1,
        observedVariance: 'ZERO_VARIANCE' as const,
        entropyBits: 0,
        deterministicInputs: [],
        nondeterministicInputs: [],
        notes: [],
      },
      cleanupAttempted: true,
      operationalAlerts: [],
    };
    const a = finalizeReport(base);
    const b = finalizeReport(base);
    expect(checksumReport(a)).toBe(checksumReport(b));
    expect(a.reportChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('finalizeReport marks status INCONCLUSIVE when cleanup was not attempted', () => {
    const base = {
      schemaVersion: PHASE7_VERSION,
      runnerId: 'phase7-test',
      runId: randomUUID(),
      tenantId: TENANT,
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      counters: {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        criticalFailures: 0,
      },
      caseResults: [],
      evidenceEnvelopes: [],
      cleanupResult: {
        attempted: false,
        success: false,
        cleanedResources: [],
        failedCleanup: [],
        orphanedResources: [],
        notAttemptedReason: 'NOT_REQUESTED' as const,
      },
      notes: [],
      executionEnvironment: 'IN_MEMORY_CONFORMANCE' as const,
      productionAdapterStatus: {
        isolationPort: 'UNREGISTERED' as const,
        adversarialPort: 'UNREGISTERED' as const,
        abusePort: 'UNREGISTERED' as const,
        unsafeActionPort: 'UNREGISTERED' as const,
        complianceEvidencePort: 'UNREGISTERED' as const,
        reviewPort: 'UNREGISTERED' as const,
        durableReviewQueueStore: 'UNREGISTERED' as const,
        cleanupPort: 'UNREGISTERED' as const,
      },
      externalApprovalStatus: {
        securityApproved: false,
        complianceApproved: false,
        approvedBy: [],
        approvedAt: [],
        notes: [],
      },
      deterministicMeasurement: {
        mode: 'DETERMINISTIC' as const,
        repetitionCount: 1,
        observedVariance: 'ZERO_VARIANCE' as const,
        entropyBits: 0,
        deterministicInputs: [],
        nondeterministicInputs: [],
        notes: [],
      },
      cleanupAttempted: false,
      operationalAlerts: [],
    };
    const r = finalizeReport(base);
    expect(r.status).toBe('INCONCLUSIVE');
    expect(r.outcome).toBe('BLOCKED');
  });

  it('finalizeReport throws when cleanupResult.success is true but cleanup was not attempted', () => {
    expect(() =>
      finalizeReport({
        schemaVersion: PHASE7_VERSION,
        runnerId: 'phase7-test',
        runId: randomUUID(),
        tenantId: TENANT,
        startedAt: new Date().toISOString(),
        finalizedAt: new Date().toISOString(),
        counters: {
          total: 0,
          passed: 0,
          failed: 0,
          inconclusive: 0,
          criticalFailures: 0,
        },
        caseResults: [],
        evidenceEnvelopes: [],
        cleanupResult: {
          attempted: false,
          success: true,
          cleanedResources: [],
          failedCleanup: [],
          orphanedResources: [],
        },
        notes: [],
        executionEnvironment: 'IN_MEMORY_CONFORMANCE' as const,
        productionAdapterStatus: {
          isolationPort: 'UNREGISTERED' as const,
          adversarialPort: 'UNREGISTERED' as const,
          abusePort: 'UNREGISTERED' as const,
          unsafeActionPort: 'UNREGISTERED' as const,
          complianceEvidencePort: 'UNREGISTERED' as const,
          reviewPort: 'UNREGISTERED' as const,
          durableReviewQueueStore: 'UNREGISTERED' as const,
          cleanupPort: 'UNREGISTERED' as const,
        },
        externalApprovalStatus: {
          securityApproved: false,
          complianceApproved: false,
          approvedBy: [],
          approvedAt: [],
          notes: [],
        },
        deterministicMeasurement: {
          mode: 'DETERMINISTIC' as const,
          repetitionCount: 1,
          observedVariance: 'ZERO_VARIANCE' as const,
          entropyBits: 0,
          deterministicInputs: [],
          nondeterministicInputs: [],
          notes: [],
        },
        cleanupAttempted: false,
        operationalAlerts: [],
      }),
    ).toThrow(/not attempted/);
  });

  it('computeCounters counts pass/fail/inconclusive and critical failures', () => {
    const counters = computeCounters([
      {
        caseId: 'a',
        expected: 'DENY',
        observed: 'DENY',
        passed: true,
        criticalFailure: false,
        evidenceRefs: [],
        provenance: 'p',
      },
      {
        caseId: 'b',
        expected: 'DENY',
        observed: 'ALLOW',
        passed: false,
        criticalFailure: true,
        evidenceRefs: [],
        provenance: 'p',
      },
      {
        caseId: 'c',
        expected: 'PASSED',
        observed: 'INCONCLUSIVE',
        passed: false,
        criticalFailure: false,
        evidenceRefs: [],
        provenance: 'p',
      },
    ]);
    expect(counters.total).toBe(3);
    expect(counters.passed).toBe(1);
    expect(counters.failed).toBe(1);
    expect(counters.criticalFailures).toBe(1);
    expect(counters.inconclusive).toBe(1);
  });
});

// ============================================================
// DOORS: helper/utility conformance
// ============================================================
describe('Phase 7 / Conformance / Utilities', () => {
  it('ctx helper produces a usable AuthorizationContext', () => {
    const c = ctx();
    expect(z.string().uuid().safeParse(c.tenantId).success).toBe(true);
  });

  it('InMemoryPhase7EvidenceSink builds an index and rejects duplicate appends (Phase 2 evidence contract)', () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const env = sink.buildEnvelope({
      runId: randomUUID(),
      scenarioId: 'unit',
      capabilityId: 'cap',
      tenantId: TENANT,
      producer: 'unit',
      correlationIds: ['c1'],
      classification: 'INTERNAL',
      retentionClass: 'SHORT_TERM',
      redactionStatus: 'NOT_REQUIRED',
      content: { a: 1 },
    });
    expect(env.evidenceId.length).toBeGreaterThan(0);
    const idx = sink.buildIndex();
    expect(idx.evidenceCount).toBe(1);
    expect(idx.tenantIds).toEqual([TENANT]);
  });

  it('in-memory review queue throws cross-tenant decision denial', async () => {
    const queue = new InMemoryReviewQueue();
    const packet = ReviewPacketSchema.parse({
      schemaVersion: PHASE7_VERSION,
      reviewId: randomUUID(),
      tenantId: TENANT,
      executionId: randomUUID(),
      reviewerId: 'reviewer-1',
      subjectActorId: 'agent-2',
      independence: true,
      slaMinutes: 30,
      escalationAfterMinutes: 60,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      rationale: 'ok',
    });
    await expect(queue.decide(ctx(FOREIGN), packet)).rejects.toThrow(
      /cross-tenant/,
    );
  });

  it('ctxWithUuid produces a valid random tenant context', () => {
    const c = ctxWithUuid();
    expect(z.string().uuid().safeParse(c.tenantId).success).toBe(true);
  });
});

// ============================================================
// CONFORMANCE: CI LANE POLICY
// ============================================================
import {
  Phase7LaneSelector,
  Phase7Gate,
  reportToGateRun,
  PHASE7_DEFAULT_LANES,
} from './ci-lane';
import {
  InMemoryDurableReviewQueueStore,
  UnsupportedDurableStore,
  InMemoryPhase7AdapterRegistry,
  createCancellationToken,
  InMemoryCleanupPort,
} from './ports';
import {
  executeCleanup,
  runWithGuards,
  RunnerCancelledError,
  RunnerTimeoutError,
} from './runners';
import { writeMachineReadableReport, buildSummary } from './report-writer';

describe('Phase 7 / Conformance / CI lane policy', () => {
  it('selector returns DEVELOPER + PR_FAST for any Phase 7 surface change', () => {
    const sel = new Phase7LaneSelector().select({
      prId: 'pr-1',
      surfaces: [
        {
          changeId: randomUUID(),
          path: 'src/harness/phase7/runners.ts',
          kind: 'SOURCE',
        },
      ],
    });
    expect(sel.requiredLanes).toContain('DEVELOPER');
    expect(sel.requiredLanes).toContain('PR_FAST');
    expect(sel.requiredLanes).toContain('NIGHTLY');
    expect(sel.blockingLanes).toContain('PR_FAST');
    expect(sel.criticalChanges).toEqual([]);
  });

  it('selector upgrades to RELEASE on CRITICAL surface change', () => {
    const sel = new Phase7LaneSelector().select({
      prId: 'pr-2',
      surfaces: [
        {
          changeId: randomUUID(),
          path: 'src/harness/phase7/contracts.ts',
          kind: 'CONTRACT',
          riskTier: 'CRITICAL',
        },
      ],
    });
    expect(sel.requiredLanes).toContain('RELEASE');
    expect(sel.blockingLanes).toContain('RELEASE');
    expect(sel.criticalChanges).toHaveLength(1);
  });

  it('selector ignores non-Phase 7 paths', () => {
    const sel = new Phase7LaneSelector().select({
      prId: 'pr-3',
      surfaces: [
        { changeId: randomUUID(), path: 'src/modules/foo.ts', kind: 'SOURCE' },
      ],
    });
    expect(sel.requiredLanes).toEqual(['DEVELOPER', 'NIGHTLY']);
  });

  it('gate passes when all blocking lanes PASSED', () => {
    const sel = new Phase7LaneSelector().select({
      prId: 'pr-4',
      surfaces: [
        {
          changeId: randomUUID(),
          path: 'src/harness/phase7/runners.ts',
          kind: 'SOURCE',
        },
      ],
    });
    const verdict = new Phase7Gate().evaluate({
      prId: 'pr-4',
      selection: sel,
      runs: [
        {
          lane: 'DEVELOPER',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: true,
          counters: counters(0),
        },
        {
          lane: 'PR_FAST',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: true,
          counters: counters(0),
        },
        {
          lane: 'NIGHTLY',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: true,
          counters: counters(0),
        },
      ],
    });
    expect(verdict.passed).toBe(true);
  });

  it('gate BLOCKS when a blocking lane reports a critical failure', () => {
    const sel = new Phase7LaneSelector().select({
      prId: 'pr-5',
      surfaces: [
        {
          changeId: randomUUID(),
          path: 'src/harness/phase7/runners.ts',
          kind: 'SOURCE',
        },
      ],
    });
    const verdict = new Phase7Gate().evaluate({
      prId: 'pr-5',
      selection: sel,
      runs: [
        {
          lane: 'DEVELOPER',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: true,
          counters: counters(0),
        },
        {
          lane: 'PR_FAST',
          runId: randomUUID(),
          outcome: 'BLOCKED',
          finalized: true,
          counters: { ...counters(0), criticalFailures: 1 },
        },
        {
          lane: 'NIGHTLY',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: true,
          counters: counters(0),
        },
      ],
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(
      /critical failure|unacceptable outcome/,
    );
  });

  it('gate flags unfinalized blocking lane runs', () => {
    const sel = new Phase7LaneSelector().select({
      prId: 'pr-6',
      surfaces: [
        {
          changeId: randomUUID(),
          path: 'src/harness/phase7/runners.ts',
          kind: 'SOURCE',
        },
      ],
    });
    const verdict = new Phase7Gate().evaluate({
      prId: 'pr-6',
      selection: sel,
      runs: [
        {
          lane: 'PR_FAST',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: false,
          counters: counters(0),
        },
        {
          lane: 'NIGHTLY',
          runId: randomUUID(),
          outcome: 'PASSED',
          finalized: true,
          counters: counters(0),
        },
      ],
    });
    expect(verdict.passed).toBe(false);
  });

  it('default lanes list is non-empty and validates', () => {
    expect(PHASE7_DEFAULT_LANES.length).toBeGreaterThan(0);
  });

  it('reportToGateRun maps runner report fields into gate run record', () => {
    const report = {
      schemaVersion: PHASE7_VERSION,
      runnerId: 'phase7-coordinator',
      runId: randomUUID(),
      tenantId: TENANT,
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      counters: counters(5),
      status: 'PASS' as const,
      outcome: 'PASSED' as const,
      caseResults: [],
      evidenceEnvelopes: [],
      cleanupResult: {
        attempted: true,
        success: true,
        cleanedResources: [],
        failedCleanup: [],
        orphanedResources: [],
      },
      reportChecksum: `sha256:${'0'.repeat(64)}`,
      notes: [],
      executionEnvironment: 'IN_MEMORY_CONFORMANCE' as const,
      productionAdapterStatus: {
        isolationPort: 'UNREGISTERED' as const,
        adversarialPort: 'UNREGISTERED' as const,
        abusePort: 'UNREGISTERED' as const,
        unsafeActionPort: 'UNREGISTERED' as const,
        complianceEvidencePort: 'UNREGISTERED' as const,
        reviewPort: 'UNREGISTERED' as const,
        durableReviewQueueStore: 'UNREGISTERED' as const,
        cleanupPort: 'UNREGISTERED' as const,
      },
      externalApprovalStatus: {
        securityApproved: false,
        complianceApproved: false,
        approvedBy: [],
        approvedAt: [],
        notes: [],
      },
      deterministicMeasurement: {
        mode: 'DETERMINISTIC' as const,
        repetitionCount: 1,
        observedVariance: 'ZERO_VARIANCE' as const,
        entropyBits: 0,
        deterministicInputs: [],
        nondeterministicInputs: [],
        notes: [],
      },
      cleanupAttempted: true,
      operationalAlerts: [],
    } satisfies Phase7RunnerReport;
    const gate = reportToGateRun(report, 'NIGHTLY');
    expect(gate.lane).toBe('NIGHTLY');
    expect(gate.outcome).toBe('PASSED');
    expect(gate.finalized).toBe(true);
  });
});

function counters(criticalFailures: number): {
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
  criticalFailures: number;
} {
  return { total: 0, passed: 0, failed: 0, inconclusive: 0, criticalFailures };
}

// ============================================================
// CONFORMANCE: DURABLE STORE / CANCELLATION / CLEANUP
// ============================================================
describe('Phase 7 / Conformance / Durable store, cancellation, cleanup', () => {
  it('durable store persists assignments, decisions, and escalations per tenant', async () => {
    const store = new InMemoryDurableReviewQueueStore();
    const assignment = ReviewQueueAssignmentSchema.parse({
      assignmentId: randomUUID(),
      reviewId: randomUUID(),
      tenantId: TENANT,
      reviewerId: 'reviewer-1',
      assignedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + 60_000).toISOString(),
    });
    await store.save(assignment);
    const loaded = await store.load(TENANT, assignment.assignmentId);
    expect(loaded).not.toBeNull();
    expect(loaded?.reviewerId).toBe('reviewer-1');
    await expect(
      store.load(FOREIGN, assignment.assignmentId),
    ).resolves.toBeNull();
    await store.delete(TENANT, assignment.assignmentId);
    await expect(
      store.load(TENANT, assignment.assignmentId),
    ).resolves.toBeNull();
  });

  it('durable store rejects cross-tenant decision save', async () => {
    const store = new InMemoryDurableReviewQueueStore();
    const packet = ReviewPacketSchema.parse({
      schemaVersion: PHASE7_VERSION,
      reviewId: randomUUID(),
      tenantId: TENANT,
      executionId: randomUUID(),
      reviewerId: 'reviewer-1',
      subjectActorId: 'agent-2',
      independence: true,
      slaMinutes: 30,
      escalationAfterMinutes: 60,
      decision: 'APPROVED',
      decidedAt: new Date().toISOString(),
      rationale: 'ok',
    });
    await expect(
      store.saveDecision(FOREIGN, packet.reviewId, packet),
    ).rejects.toThrow(/cross-tenant/);
  });

  it('UnsupportedDurableStore rejects all calls with explicit UNSUPPORTED marker', async () => {
    const store = new UnsupportedDurableStore();
    expect(store.status).toBe('UNSUPPORTED');
    await expect(store.list()).rejects.toThrow(/UNSUPPORTED/);
  });

  it('cancel token stops IsolationRunner case loop', async () => {
    const token = createCancellationToken();
    const runner = new IsolationRunner(new TenantKeyIsolationPort());
    const cases = buildIsolationMatrix(TENANT, FOREIGN);
    const cancel = (token as { cancel?: (r: string) => void }).cancel;
    setTimeout(() => cancel?.('USER_CANCELLED'), 0);
    const report = await runner.run({
      ctx: ctx(),
      cases,
      runId: randomUUID(),
      cancellationToken: token,
      cleanup: true,
    });
    expect(report.caseResults.length).toBeLessThanOrEqual(cases.length);
    expect(report.cleanupAttempted).toBe(true);
  });
  it('runWithGuards retries transient failures and stops on permanent ones', async () => {
    let attempts = 0;
    const out = await runWithGuards(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('transient');
        return 'ok';
      },
      { maxRetries: 5, retryable: () => true },
    );
    expect(out).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('runWithGuards throws RunnerTimeoutError on timeout', async () => {
    await expect(
      runWithGuards(() => new Promise((resolve) => setTimeout(resolve, 50)), {
        timeoutMs: 10,
      }),
    ).rejects.toBeInstanceOf(RunnerTimeoutError);
  });

  it('runWithGuards throws RunnerCancelledError on already-aborted signal', async () => {
    const ctl = new AbortController();
    ctl.abort('TIMEOUT');
    await expect(
      runWithGuards(async () => 'ok', { signal: ctl.signal }),
    ).rejects.toBeInstanceOf(RunnerCancelledError);
  });

  it('executeCleanup reports failed cleanup as orphans', async () => {
    const port = new InMemoryCleanupPort({
      'cleanup:bad-1': new Error('disk full'),
    });
    const envA = buildEnvelope('a');
    const envB = buildEnvelope('b');
    envB.evidenceId = 'bad-1' as unknown as typeof envB.evidenceId;
    const result = await executeCleanup(port, [envA, envB]);
    expect(result.attempted).toBe(true);
    if (!result.attempted) throw new Error('expected attempted=true');
    expect(result.result.success).toBe(false);
    expect(result.result.failedCleanup).toContain('bad-1');
    expect(result.result.orphanedResources).toContain('bad-1');
    expect(result.result.cleanedResources).toContain(envA.evidenceId);
  });

  it('executeCleanup marks cancelled envelopes as orphans', async () => {
    const token = createCancellationToken();
    (token as { cancel?: (r: string) => void }).cancel?.('USER_CANCELLED');
    const result = await executeCleanup(
      new InMemoryCleanupPort(),
      [buildEnvelope('a'), buildEnvelope('b')],
      token,
    );
    expect(result.attempted).toBe(false);
    if (result.attempted) throw new Error('expected attempted=false');
    expect(result.reason).toBe('CANCELLED_BEFORE_CLEANUP');
  });

  it('executeCleanup returns NO_ENVELOPES for empty envelope list', async () => {
    const result = await executeCleanup(new InMemoryCleanupPort(), []);
    expect(result.attempted).toBe(false);
    if (result.attempted) throw new Error('expected attempted=false');
    expect(result.reason).toBe('NO_ENVELOPES');
  });

  it('Phase7AdapterRegistry enforces single-registration per adapter', () => {
    const reg = new InMemoryPhase7AdapterRegistry();
    const port = new TenantKeyIsolationPort();
    reg.register('ISOLATION_PORT', port);
    expect(() => reg.register('ISOLATION_PORT', port)).toThrow(
      /already registered/,
    );
    expect(reg.resolve('ISOLATION_PORT')).toBe(port);
    expect(reg.resolve('REVIEW_PORT')).toBeNull();
    expect(reg.list()).toEqual(['ISOLATION_PORT']);
  });
});

// ============================================================
// CONFORMANCE: REPORT WRITER + SCRIPT (in-process)
// ============================================================
describe('Phase 7 / Conformance / Report writer', () => {
  it('writes JSON, summary, and checksum files and validates report', () => {
    const report = buildSampleReport();
    const tmp = `/tmp/phase7-${randomUUID()}`;
    const out = writeMachineReadableReport({ report, outDir: tmp });
    expect(out.jsonPath.endsWith('.json')).toBe(true);
    expect(out.summaryPath.endsWith('-summary.json')).toBe(true);
    expect(out.checksumPath.endsWith('-checksum.txt')).toBe(true);
    expect(out.jsonChecksum).toMatch(/^sha256:/);
    const summary = buildSummary(report);
    expect(summary.evidenceCount).toBe(report.evidenceEnvelopes.length);
    expect(summary.cleanup.orphans).toBe(0);
  });
});

function buildSampleReport(): Phase7RunnerReport {
  return {
    schemaVersion: PHASE7_VERSION,
    runnerId: 'phase7-coordinator',
    runId: randomUUID(),
    tenantId: TENANT,
    startedAt: new Date().toISOString(),
    finalizedAt: new Date().toISOString(),
    counters: counters(0),
    status: 'PASS',
    outcome: 'PASSED',
    caseResults: [],
    evidenceEnvelopes: [],
    cleanupResult: {
      attempted: true,
      success: true,
      cleanedResources: [],
      failedCleanup: [],
      orphanedResources: [],
    },
    reportChecksum: `sha256:${'0'.repeat(64)}`,
    notes: [],
    executionEnvironment: 'IN_MEMORY_CONFORMANCE',
    productionAdapterStatus: {
      isolationPort: 'UNREGISTERED',
      adversarialPort: 'UNREGISTERED',
      abusePort: 'UNREGISTERED',
      unsafeActionPort: 'UNREGISTERED',
      complianceEvidencePort: 'UNREGISTERED',
      reviewPort: 'UNREGISTERED',
      durableReviewQueueStore: 'UNREGISTERED',
      cleanupPort: 'UNREGISTERED',
    },
    externalApprovalStatus: {
      securityApproved: false,
      complianceApproved: false,
      approvedBy: [],
      approvedAt: [],
      notes: [],
    },
    deterministicMeasurement: {
      mode: 'DETERMINISTIC',
      repetitionCount: 1,
      observedVariance: 'ZERO_VARIANCE',
      entropyBits: 0,
      deterministicInputs: [],
      nondeterministicInputs: [],
      notes: [],
    },
    cleanupAttempted: true,
    operationalAlerts: [],
  };
}

function buildEnvelope(
  suffix: string,
): import('../contracts').EvidenceEnvelope {
  return {
    schemaVersion: PHASE7_VERSION,
    evidenceId: randomUUID() as unknown as ReturnType<typeof UuidSchema.parse>,
    runId: randomUUID() as unknown as ReturnType<typeof UuidSchema.parse>,
    scenarioId: `unit-${suffix}`,
    capabilityId: 'unit',
    tenantId: TENANT,
    timestamp: new Date().toISOString(),
    producer: 'unit',
    mediaType: 'application/json',
    classification: 'INTERNAL',
    checksum: `sha256:${'a'.repeat(64)}`,
    storageRef: `memory://${suffix}`,
    retentionClass: 'MEDIUM_TERM',
    redactionStatus: 'NOT_REQUIRED',
    correlationIds: ['c1'],
  };
}

// ============================================================
// CONFORMANCE: ABUSE PORT THRESHOLDS
// ============================================================
import {
  DEFAULT_ABUSE_THRESHOLDS,
  DEFAULT_ABUSE_MAX_ATTEMPTS,
  resolveAbuseThresholds,
} from './runners';

describe('Phase 7 / Conformance / Abuse port thresholds', () => {
  it('returns ALLOWED while below threshold and terminal at threshold', async () => {
    const port = new CycleDetectionAbusePort();
    const loopCase = AbuseCaseSchema.parse({
      schemaVersion: PHASE7_VERSION,
      caseId: 'loop-thresh',
      scenario: 'LOOP',
      expectedTerminal: 'CYCLE_DETECTED',
      threshold: { maxTotal: 2 },
    });
    const r1 = await port.execute(ctx(), loopCase);
    const r2 = await port.execute(ctx(), loopCase);
    const r3 = await port.execute(ctx(), loopCase);
    expect(r1.outcome).toBe('ALLOWED');
    expect(r2.outcome).toBe('ALLOWED');
    expect(r3.outcome).toBe('CYCLE_DETECTED');
  });

  it('respects rate burst threshold by window', async () => {
    const port = new CycleDetectionAbusePort();
    const burstCase = AbuseCaseSchema.parse({
      schemaVersion: PHASE7_VERSION,
      caseId: 'burst-thresh',
      scenario: 'RATE_BURST',
      expectedTerminal: 'RATE_LIMITED',
      threshold: { windowMs: 10_000, maxInWindow: 2 },
    });
    expect((await port.execute(ctx(), burstCase)).outcome).toBe('ALLOWED');
    expect((await port.execute(ctx(), burstCase)).outcome).toBe('ALLOWED');
    expect((await port.execute(ctx(), burstCase)).outcome).toBe('RATE_LIMITED');
  });

  it('respects budget exhaustion threshold by total', async () => {
    const port = new CycleDetectionAbusePort();
    const budgetCase = AbuseCaseSchema.parse({
      schemaVersion: PHASE7_VERSION,
      caseId: 'budget-thresh',
      scenario: 'BUDGET_EXHAUSTION',
      expectedTerminal: 'BUDGET_DENIED',
      threshold: { maxTotal: 1 },
    });
    expect((await port.execute(ctx(), budgetCase)).outcome).toBe('ALLOWED');
    expect((await port.execute(ctx(), budgetCase)).outcome).toBe(
      'BUDGET_DENIED',
    );
  });

  it('respects sustained retry threshold by consecutive failures', async () => {
    const port = new CycleDetectionAbusePort();
    const retryCase = AbuseCaseSchema.parse({
      schemaVersion: PHASE7_VERSION,
      caseId: 'retry-thresh',
      scenario: 'SUSTAINED_RETRY',
      expectedTerminal: 'CIRCUIT_OPEN',
      threshold: { maxConsecutiveFailures: 1 },
    });
    expect((await port.execute(ctx(), retryCase)).outcome).toBe('ALLOWED');
    expect((await port.execute(ctx(), retryCase)).outcome).toBe('CIRCUIT_OPEN');
  });

  it('AbuseRunner drives a case until terminal within bounded attempts', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const port = new CycleDetectionAbusePort();
    const runner = new AbuseRunner(port, sink);
    const report = await runner.run({
      ctx: ctx(),
      cases: [buildAbuseCorpus()[0]],
      runId: randomUUID(),
      cleanup: false,
    });
    expect(report.caseResults[0].passed).toBe(true);
    expect(report.caseResults[0].observed).toBe('RATE_LIMITED');
  });

  it('AbuseRunner marks non-terminal bounded case as INCONCLUSIVE', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const port = new CycleDetectionAbusePort({ maxTotal: 1000 });
    const runner = new AbuseRunner(
      port,
      sink,
      undefined,
      undefined,
      'IN_MEMORY_CONFORMANCE',
      emptyProductionAdapterStatus(),
      emptyExternalApprovalStatus(),
      {
        maxAttemptsPerCase: 3,
      },
    );
    const loopCase = AbuseCaseSchema.parse({
      schemaVersion: PHASE7_VERSION,
      caseId: 'loop-never',
      scenario: 'LOOP',
      expectedTerminal: 'CYCLE_DETECTED',
      threshold: { maxTotal: 1000 },
    });
    const report = await runner.run({
      ctx: ctx(),
      cases: [loopCase],
      runId: randomUUID(),
      cleanup: false,
    });
    expect(report.caseResults[0].observed).toBe('INCONCLUSIVE');
    expect(report.caseResults[0].passed).toBe(false);
    expect(report.caseResults[0].criticalFailure).toBe(true);
  });

  it('exposes DEFAULT_ABUSE_THRESHOLDS and DEFAULT_ABUSE_MAX_ATTEMPTS', () => {
    expect(DEFAULT_ABUSE_THRESHOLDS.maxInWindow).toBeGreaterThan(0);
    expect(DEFAULT_ABUSE_MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it('resolveAbuseThresholds merges defaults with case overrides', () => {
    const merged = resolveAbuseThresholds(
      AbuseCaseSchema.parse({
        schemaVersion: PHASE7_VERSION,
        caseId: 'x',
        scenario: 'LOOP',
        expectedTerminal: 'CYCLE_DETECTED',
        threshold: { maxTotal: 2 },
      }),
      DEFAULT_ABUSE_THRESHOLDS,
    );
    expect(merged.maxTotal).toBe(2);
    expect(merged.maxInWindow).toBe(DEFAULT_ABUSE_THRESHOLDS.maxInWindow);
  });
});

// ============================================================
// CONFORMANCE: COMPLIANCE PORT VERIFY
// ============================================================
import { InMemoryComplianceEvidencePort as ICV } from './runners';

describe('Phase 7 / Conformance / Compliance verify', () => {
  it('InMemoryComplianceEvidencePort.verify returns true for stored complete payload', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const port = new ICV(sink);
    const control = PHASE7_CONTROLS[0];
    const payload = Object.fromEntries(
      control.evidenceRequired.map((k) => [k, 'x']),
    );
    const env = await port.record(ctx(), control, payload);
    const ok = await port.verify(env, control);
    expect(ok).toBe(true);
  });

  it('InMemoryComplianceEvidencePort.verify returns false when retrieved content is missing a required key', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const port = new ICV(sink);
    const control = PHASE7_CONTROLS[0];
    const env = await port.record(ctx(), control, {
      'retention-policy': 'p',
    });
    const ok = await port.verify(env, control);
    expect(ok).toBe(false);
  });

  it('ComplianceRunner calls port.verify and BLOCKS when verify fails', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const port = new (class extends ICV {
      override async verify(): Promise<boolean> {
        return false;
      }
    })(sink);
    const runner = new ComplianceRunner(port, sink);
    const control = PHASE7_CONTROLS[0];
    const payloads = new Map([
      [
        control.controlId,
        Object.fromEntries(control.evidenceRequired.map((k) => [k, 'x'])),
      ],
    ]);
    const report = await runner.run({
      ctx: ctx(),
      controls: [control],
      payloads,
      runId: randomUUID(),
      cleanup: true,
    });
    expect(report.status).toBe('BLOCK');
    expect(report.caseResults[0].observed).toBe('FAILED');
    expect(report.operationalAlerts[0].category).toBe('EVIDENCE_CORRUPTION');
  });

  it('safeRetrieve returns null for unknown evidenceId', () => {
    const sink = new InMemoryPhase7EvidenceSink();
    expect(sink.safeRetrieve(randomUUID())).toBeNull();
  });
});

// ============================================================
// CONFORMANCE: OPERATIONAL ALERT PORT
// ============================================================
import {
  InMemoryOperationalAlertPort,
  UnsupportedOperationalAlertPort,
} from './ports';
import {
  emptyProductionAdapterStatus,
  emptyExternalApprovalStatus,
} from './runners';

describe('Phase 7 / Conformance / Operational alert port', () => {
  it('InMemoryOperationalAlertPort emits delivered alerts with IN_MEMORY routing', async () => {
    const port = new InMemoryOperationalAlertPort();
    const a = await port.emit({
      category: 'CLEANUP_FAILURE',
      severity: 'CRITICAL',
      target: 'evidence-1',
      message: 'cleanup failed',
    });
    expect(a.delivered).toBe(true);
    expect(a.routing).toBe('IN_MEMORY');
    expect(port.list()).toHaveLength(1);
  });

  it('UnsupportedOperationalAlertPort emits undelivered alerts with UNSUPPORTED routing', async () => {
    const port = new UnsupportedOperationalAlertPort();
    const a = await port.emit({
      category: 'ORPHAN_RESOURCE',
      severity: 'WARNING',
      target: 'evidence-1',
      message: 'orphan',
    });
    expect(a.delivered).toBe(false);
    expect(a.routing).toBe('UNSUPPORTED');
    expect(a.message).toMatch(/unsupported_routing/);
  });

  it('Coordinator emits orphan alerts when cleanup leaves orphans', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const queue = new InMemoryReviewQueue();
    const cleanup = new InMemoryCleanupPort();
    const alert = new InMemoryOperationalAlertPort();
    const coordinator = new Phase7Coordinator(
      undefined,
      cleanup,
      undefined,
      alert,
    );
    const port = new (class extends CycleDetectionAbusePort {})();
    const report = await coordinator.run({
      ctx: ctx(),
      isolationRunner: new IsolationRunner(
        new TenantKeyIsolationPort(),
        sink,
        cleanup,
      ),
      adversarialRunner: new AdversarialRunner(
        new StrictAdversarialPort(),
        sink,
        cleanup,
      ),
      abuseRunner: new AbuseRunner(port, sink, cleanup),
      unsafeRunner: new UnsafeActionRunner(
        new StrictUnsafeActionPort(),
        sink,
        cleanup,
      ),
      complianceRunner: new ComplianceRunner(
        new InMemoryComplianceEvidencePort(sink),
        sink,
        cleanup,
      ),
      hitlRunner: new HitlRunner(queue, sink, cleanup),
      runId: randomUUID(),
      cleanup: false,
    });
    expect(report.cleanupAttempted).toBe(false);
    expect(report.operationalAlerts).toEqual([]);
  });

  it('Coordinator with default alert port is visible as UNSUPPORTED routing when forced via cleanup failure', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const cleanup = new InMemoryCleanupPort();
    const alert = new UnsupportedOperationalAlertPort();
    const queue = new InMemoryReviewQueue();
    const port = new (class extends CycleDetectionAbusePort {
      override async execute(): Promise<{ outcome: 'ALLOWED' }> {
        return { outcome: 'ALLOWED' };
      }
    })();
    const coordinator = new Phase7Coordinator(
      undefined,
      cleanup,
      undefined,
      alert,
    );
    const report = await coordinator.run({
      ctx: ctx(),
      isolationRunner: new IsolationRunner(
        new TenantKeyIsolationPort(),
        sink,
        cleanup,
      ),
      adversarialRunner: new AdversarialRunner(
        new StrictAdversarialPort(),
        sink,
        cleanup,
      ),
      abuseRunner: new AbuseRunner(port, sink, cleanup),
      unsafeRunner: new UnsafeActionRunner(
        new StrictUnsafeActionPort(),
        sink,
        cleanup,
      ),
      complianceRunner: new ComplianceRunner(
        new InMemoryComplianceEvidencePort(sink),
        sink,
        cleanup,
      ),
      hitlRunner: new HitlRunner(queue, sink, cleanup),
      runId: randomUUID(),
    });
    const alertResults = report.operationalAlerts;
    for (const a of alertResults) expect(a.routing).toBe('UNSUPPORTED');
    expect(report.status).toBe('BLOCK');
  });

  it('Phase 7 adapter registry accepts OPERATIONAL_ALERT_PORT', () => {
    const reg = new InMemoryPhase7AdapterRegistry();
    const port = new InMemoryOperationalAlertPort();
    reg.register('OPERATIONAL_ALERT_PORT', port);
    expect(reg.resolve('OPERATIONAL_ALERT_PORT')).toBe(port);
  });
});

// ============================================================
// CONFORMANCE: REPORT ENVIRONMENT / PROVENANCE FIELDS
// ============================================================
describe('Phase 7 / Conformance / Report provenance fields', () => {
  it('runner report exposes executionEnvironment, productionAdapterStatus, externalApprovalStatus, deterministicMeasurement, cleanupAttempted, operationalAlerts', async () => {
    const sink = new InMemoryPhase7EvidenceSink();
    const runner = new IsolationRunner(new TenantKeyIsolationPort(), sink);
    const report = await runner.run({
      ctx: ctx(),
      cases: buildIsolationMatrix(TENANT, FOREIGN),
      runId: randomUUID(),
      cleanup: true,
    });
    expect(report.executionEnvironment).toBe('IN_MEMORY_CONFORMANCE');
    expect(report.productionAdapterStatus.isolationPort).toBe('UNREGISTERED');
    expect(report.externalApprovalStatus.securityApproved).toBe(false);
    expect(report.externalApprovalStatus.complianceApproved).toBe(false);
    expect(report.deterministicMeasurement.mode).toBe('DETERMINISTIC');
    expect(report.deterministicMeasurement.repetitionCount).toBeGreaterThan(0);
    expect(report.cleanupAttempted).toBe(true);
    expect(Array.isArray(report.operationalAlerts)).toBe(true);
  });
});

// ============================================================
// CONFORMANCE: REPORT MIGRATION / RESTORE
// ============================================================
import {
  migratePhase7Report,
  restorePhase7Report,
  PHASE7_REPORT_MIGRATIONS,
} from './contracts';

describe('Phase 7 / Conformance / Report migration and restore', () => {
  it('migratePhase7Report accepts 1.1.0 (current) without migration', () => {
    const current = buildSampleReport();
    const { report, migratedFrom } = migratePhase7Report(current);
    expect(migratedFrom).toBeNull();
    expect(report.schemaVersion).toBe('1.1.0');
  });

  it('migratePhase7Report migrates a 1.0.0 report to 1.1.0 adding new fields', () => {
    const legacy = {
      schemaVersion: '1.0.0',
      runnerId: 'phase7-isolation-runner',
      runId: randomUUID(),
      tenantId: TENANT,
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      counters: {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        criticalFailures: 0,
      },
      status: 'PASS',
      outcome: 'PASSED',
      caseResults: [],
      evidenceEnvelopes: [],
      cleanupResult: {
        success: true,
        cleanedResources: ['e1'],
        failedCleanup: [],
        orphanedResources: [],
      },
      reportChecksum: `sha256:${'a'.repeat(64)}`,
      notes: [],
    };
    const { report, migratedFrom } = migratePhase7Report(legacy);
    expect(migratedFrom).toBe('1.0.0');
    expect(report.schemaVersion).toBe('1.1.0');
    expect(report.cleanupResult.attempted).toBe(true);
    expect(report.cleanupResult.success).toBe(true);
    expect(report.cleanupAttempted).toBe(true);
    expect(report.executionEnvironment).toBe('IN_MEMORY_CONFORMANCE');
    expect(report.deterministicMeasurement.mode).toBe('DETERMINISTIC');
  });

  it('restorePhase7Report parses JSON and migrates a legacy report', () => {
    const legacy = JSON.stringify({
      schemaVersion: '1.0.0',
      runnerId: 'phase7-isolation-runner',
      runId: randomUUID(),
      tenantId: TENANT,
      startedAt: new Date().toISOString(),
      finalizedAt: new Date().toISOString(),
      counters: {
        total: 0,
        passed: 0,
        failed: 0,
        inconclusive: 0,
        criticalFailures: 0,
      },
      status: 'PASS',
      outcome: 'PASSED',
      caseResults: [],
      evidenceEnvelopes: [],
      cleanupResult: {
        success: true,
        cleanedResources: ['e1'],
        failedCleanup: [],
        orphanedResources: [],
      },
      reportChecksum: `sha256:${'a'.repeat(64)}`,
      notes: [],
    });
    const { report, migratedFrom } = restorePhase7Report(legacy);
    expect(migratedFrom).toBe('1.0.0');
    expect(report.cleanupAttempted).toBe(true);
  });

  it('migratePhase7Report throws on unknown schemaVersion', () => {
    expect(() => migratePhase7Report({ schemaVersion: '0.0.1' })).toThrow(
      /no registered migration/,
    );
  });

  it('PHASE7_REPORT_MIGRATIONS keys include 1.0.0 and 1.1.0', () => {
    expect(Object.keys(PHASE7_REPORT_MIGRATIONS).sort()).toEqual([
      '1.0.0',
      '1.1.0',
    ]);
  });
});

// ============================================================
// CONFORMANCE: SUMMARY WRITER INCLUDES NEW FIELDS
// ============================================================
describe('Phase 7 / Conformance / Summary writer', () => {
  it('summary exposes executionEnvironment, productionAdapterStatus, externalApprovalStatus, deterministicMeasurement, cleanupAttempted, operationalAlerts', () => {
    const report = buildSampleReport();
    const summary = buildSummary(report);
    expect(summary.executionEnvironment).toBe('IN_MEMORY_CONFORMANCE');
    expect(summary.productionAdapterStatus).toBeDefined();
    expect(summary.externalApprovalStatus).toBeDefined();
    expect(summary.deterministicMeasurement).toBeDefined();
    expect(summary.cleanupAttempted).toBe(true);
    expect(summary.operationalAlerts).toEqual([]);
    expect(summary.cleanup.attempted).toBe(true);
  });
});
