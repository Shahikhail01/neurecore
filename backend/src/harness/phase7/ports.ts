import { randomUUID } from 'crypto';
import { type AuthorizationContext, type EvidenceEnvelope } from '../contracts';
import { createEvidenceEnvelope, EvidenceStore } from '../evidence';
import type { OperationalAlertResult } from './contracts';
import type {
  AdversarialCase,
  AbuseCase,
  UnsafeActionCase,
  ComplianceControl,
  ReviewPacket,
  ReviewQueueAssignment,
  EscalationEvent,
  IsolationResource,
  IsolationAction,
  IsolationLayer,
} from './contracts';

export interface AuthDecision {
  allowed: boolean;
  redaction?: boolean;
  reason?: string;
}

export interface IsolationPort {
  authorize(
    ctx: AuthorizationContext,
    targetTenantId: string,
    resource: IsolationResource,
    action: IsolationAction,
    layer: IsolationLayer,
    payload?: unknown,
  ): Promise<AuthDecision>;
}

export interface AdversarialPort {
  evaluate(
    ctx: AuthorizationContext,
    caseRef: AdversarialCase,
  ): Promise<AuthDecision>;
}

export type AbuseOutcome = AbuseCase['expectedTerminal'] | 'ALLOWED';

export interface AbusePort {
  execute(
    ctx: AuthorizationContext,
    caseRef: AbuseCase,
  ): Promise<{
    outcome: AbuseOutcome;
    finalDecision?: AuthDecision;
  }>;
}

export interface UnsafeActionPort {
  request(
    ctx: AuthorizationContext,
    caseRef: UnsafeActionCase,
  ): Promise<AuthDecision & { requiresApproval: boolean }>;
}

export interface ComplianceEvidencePort {
  record(
    ctx: AuthorizationContext,
    control: ComplianceControl,
    payload: Record<string, unknown>,
  ): Promise<EvidenceEnvelope>;
  verify(
    envelope: EvidenceEnvelope,
    control: ComplianceControl,
  ): Promise<boolean>;
}

export interface ReviewPort {
  enqueue(
    ctx: AuthorizationContext,
    executionId: string,
    reviewerId: string,
  ): Promise<ReviewQueueAssignment>;
  reassign(
    ctx: AuthorizationContext,
    assignment: ReviewQueueAssignment,
    newReviewerId: string,
  ): Promise<ReviewQueueAssignment>;
  decide(
    ctx: AuthorizationContext,
    packet: ReviewPacket,
  ): Promise<ReviewPacket>;
}

export interface Phase7EvidenceSink {
  append(envelope: EvidenceEnvelope, content: unknown): void;
  list(): EvidenceEnvelope[];
  safeRetrieve(
    evidenceId: string,
  ): { envelope: EvidenceEnvelope; content: unknown } | null;
  buildIndex(): {
    evidenceCount: number;
    checksum: string;
    tenantIds: string[];
  };
  buildEnvelope(input: {
    runId: string;
    scenarioId: string;
    capabilityId: string;
    tenantId: string;
    producer: string;
    correlationIds: string[];
    classification:
      | 'PUBLIC'
      | 'INTERNAL'
      | 'CONFIDENTIAL'
      | 'RESTRICTED'
      | 'REGULATED';
    retentionClass: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'PERMANENT';
    redactionStatus: 'PENDING' | 'APPLIED' | 'NOT_REQUIRED';
    content: unknown;
  }): EvidenceEnvelope;
}

export class InMemoryPhase7EvidenceSink implements Phase7EvidenceSink {
  private readonly store = new EvidenceStore();
  private readonly envelopes: EvidenceEnvelope[] = [];

  append(envelope: EvidenceEnvelope, content: unknown): void {
    this.store.append(envelope, content);
    this.envelopes.push(envelope);
  }

  list(): EvidenceEnvelope[] {
    return [...this.envelopes];
  }

  safeRetrieve(
    evidenceId: string,
  ): { envelope: EvidenceEnvelope; content: unknown } | null {
    const artifact = this.store.get(evidenceId);
    if (!artifact) return null;
    return { envelope: artifact.envelope, content: artifact.rawContent };
  }

  buildIndex(): {
    evidenceCount: number;
    checksum: string;
    tenantIds: string[];
  } {
    const tenantIds = [
      ...new Set(this.envelopes.map((e) => e.tenantId)),
    ].sort();
    return {
      evidenceCount: this.envelopes.length,
      checksum: this.store
        .getByRunId(this.envelopes[0]?.runId ?? '')
        .map((a) => a.envelope.checksum)
        .join('|'),
      tenantIds,
    };
  }

  buildEnvelope(input: {
    runId: string;
    scenarioId: string;
    capabilityId: string;
    tenantId: string;
    producer: string;
    correlationIds: string[];
    classification:
      | 'PUBLIC'
      | 'INTERNAL'
      | 'CONFIDENTIAL'
      | 'RESTRICTED'
      | 'REGULATED';
    retentionClass: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' | 'PERMANENT';
    redactionStatus: 'PENDING' | 'APPLIED' | 'NOT_REQUIRED';
    content: unknown;
  }): EvidenceEnvelope {
    const envelope = createEvidenceEnvelope({
      runId: input.runId,
      scenarioId: input.scenarioId,
      capabilityId: input.capabilityId,
      tenantId: input.tenantId,
      producer: input.producer,
      mediaType: 'application/json',
      classification: input.classification,
      retentionClass: input.retentionClass,
      redactionStatus: input.redactionStatus,
      correlationIds: input.correlationIds,
      content: input.content,
    });
    this.append(envelope, input.content);
    return envelope;
  }
}

export const _testingIds = {
  evidenceSinkId: (): string => `phase7-evidence-${randomUUID()}`,
};

export function defaultEscalationEvent(
  reviewId: string,
  reason: EscalationEvent['reason'],
  toRole: string,
): EscalationEvent {
  return {
    escalationId: randomUUID(),
    reviewId,
    triggeredAt: new Date().toISOString(),
    reason,
    toRole,
  };
}

export function assertNoSelfApproval(packet: ReviewPacket): void {
  if (packet.reviewerId === packet.subjectActorId) {
    throw new Error(
      `self-approval denied (NC7-HITL-INDEPENDENCE): ${packet.reviewId}`,
    );
  }
  if (!packet.independence) {
    throw new Error(
      `reviewer independence flag required (NC7-HITL-INDEPENDENCE): ${packet.reviewId}`,
    );
  }
}

export function canExecuteReview(
  packet: ReviewPacket,
  now: Date = new Date(),
): { allowed: boolean; reason?: string } {
  if (packet.decision === 'REJECTED')
    return { allowed: false, reason: 'rejected' };
  if (packet.decision === 'EXPIRED')
    return { allowed: false, reason: 'expired' };
  if (packet.decision !== 'APPROVED')
    return {
      allowed: false,
      reason: `non-approvable state: ${packet.decision}`,
    };
  if (!packet.decidedAt)
    return { allowed: false, reason: 'no decision timestamp' };
  if (new Date(packet.decidedAt).getTime() > now.getTime())
    return { allowed: false, reason: 'decision in the future' };
  if (!packet.independence)
    return { allowed: false, reason: 'non-independent reviewer' };
  return { allowed: true };
}

// ============================================================
// DURABLE REVIEW-QUEUE STORE PORT
// ============================================================

export interface DurableReviewQueueStore {
  load(
    tenantId: string,
    assignmentId: string,
  ): Promise<ReviewQueueAssignment | null>;
  save(assignment: ReviewQueueAssignment): Promise<void>;
  delete(tenantId: string, assignmentId: string): Promise<void>;
  list(tenantId: string): Promise<ReviewQueueAssignment[]>;
  saveDecision(
    tenantId: string,
    reviewId: string,
    packet: ReviewPacket,
  ): Promise<void>;
  loadDecision(
    tenantId: string,
    reviewId: string,
  ): Promise<ReviewPacket | null>;
  saveEscalation(tenantId: string, event: EscalationEvent): Promise<void>;
  listEscalations(tenantId: string): Promise<EscalationEvent[]>;
}

export const DURABLE_STORE_UNSUPPORTED_REASON =
  'PHASE7_DURABLE_STORE_UNSUPPORTED';

export class UnsupportedDurableStore implements DurableReviewQueueStore {
  readonly status = 'UNSUPPORTED' as const;
  readonly reason =
    'No production durable-store adapter is registered for Phase 7 HITL queues. In-memory queue is used for conformance only.';
  load(): Promise<ReviewQueueAssignment | null> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  save(): Promise<void> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  delete(): Promise<void> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  list(): Promise<ReviewQueueAssignment[]> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  saveDecision(): Promise<void> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  loadDecision(): Promise<ReviewPacket | null> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  saveEscalation(): Promise<void> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
  listEscalations(): Promise<EscalationEvent[]> {
    return Promise.reject(
      new Error(`PHASE7_DURABLE_STORE_UNSUPPORTED: ${this.reason}`),
    );
  }
}

export class InMemoryDurableReviewQueueStore implements DurableReviewQueueStore {
  private readonly assignments = new Map<string, ReviewQueueAssignment>();
  private readonly decisions = new Map<string, ReviewPacket>();
  private readonly escalations = new Map<string, EscalationEvent[]>();
  private static key(tenantId: string, id: string): string {
    return `${tenantId}::${id}`;
  }
  load(
    tenantId: string,
    assignmentId: string,
  ): Promise<ReviewQueueAssignment | null> {
    return Promise.resolve(
      this.assignments.get(
        InMemoryDurableReviewQueueStore.key(tenantId, assignmentId),
      ) ?? null,
    );
  }
  save(assignment: ReviewQueueAssignment): Promise<void> {
    this.assignments.set(
      InMemoryDurableReviewQueueStore.key(
        assignment.tenantId,
        assignment.assignmentId,
      ),
      assignment,
    );
    return Promise.resolve();
  }
  delete(tenantId: string, assignmentId: string): Promise<void> {
    this.assignments.delete(
      InMemoryDurableReviewQueueStore.key(tenantId, assignmentId),
    );
    return Promise.resolve();
  }
  list(tenantId: string): Promise<ReviewQueueAssignment[]> {
    return Promise.resolve(
      [...this.assignments.values()].filter((a) => a.tenantId === tenantId),
    );
  }
  saveDecision(
    tenantId: string,
    reviewId: string,
    packet: ReviewPacket,
  ): Promise<void> {
    if (packet.tenantId !== tenantId)
      return Promise.reject(new Error('cross-tenant decision denied'));
    this.decisions.set(
      InMemoryDurableReviewQueueStore.key(tenantId, reviewId),
      packet,
    );
    return Promise.resolve();
  }
  loadDecision(
    tenantId: string,
    reviewId: string,
  ): Promise<ReviewPacket | null> {
    return Promise.resolve(
      this.decisions.get(
        InMemoryDurableReviewQueueStore.key(tenantId, reviewId),
      ) ?? null,
    );
  }
  saveEscalation(tenantId: string, event: EscalationEvent): Promise<void> {
    const key = InMemoryDurableReviewQueueStore.key(tenantId, event.reviewId);
    const list = this.escalations.get(key) ?? [];
    list.push(event);
    this.escalations.set(key, list);
    return Promise.resolve();
  }
  listEscalations(tenantId: string): Promise<EscalationEvent[]> {
    const out: EscalationEvent[] = [];
    for (const [key, events] of this.escalations) {
      if (key.startsWith(`${tenantId}::`)) out.push(...events);
    }
    return Promise.resolve(out);
  }
}

// ============================================================
// CANCELLATION / TIMEOUT PORT
// ============================================================

export type CancellationReason =
  | 'USER_CANCELLED'
  | 'TIMEOUT'
  | 'DEPENDENCY_FAILURE'
  | 'CIRCUIT_OPEN'
  | 'PARENT_CANCELLED';

export interface CancellationToken {
  cancelled: boolean;
  reason?: CancellationReason;
  onCancel(handler: (reason: CancellationReason) => void): void;
}

export function createCancellationToken(): CancellationToken {
  const handlers: Array<(reason: CancellationReason) => void> = [];
  const token: CancellationToken = {
    cancelled: false,
    onCancel(handler) {
      if (token.cancelled) handler(token.reason ?? 'USER_CANCELLED');
      else handlers.push(handler);
    },
  };
  (token as { cancel?(r: CancellationReason): void }).cancel = (reason) => {
    if (token.cancelled) return;
    token.cancelled = true;
    token.reason = reason;
    for (const h of handlers) h(reason);
  };
  return token;
}

// ============================================================
// CLEANUP PORT
// ============================================================

export interface CleanupTarget {
  cleanupId: string;
  kind: 'EVIDENCE' | 'ASSIGNMENT' | 'DECISION' | 'ESCALATION';
  tenantId: string;
  resourceId: string;
  classification:
    | 'PUBLIC'
    | 'INTERNAL'
    | 'CONFIDENTIAL'
    | 'RESTRICTED'
    | 'REGULATED';
}

export interface CleanupOutcome {
  cleanupId: string;
  cleaned: boolean;
  error?: string;
  orphans: string[];
}

export interface CleanupPort {
  cleanup(target: CleanupTarget): Promise<CleanupOutcome>;
}

export class InMemoryCleanupPort implements CleanupPort {
  private readonly failures = new Map<string, Error>();
  constructor(failures?: Record<string, Error>) {
    if (failures) {
      for (const [k, v] of Object.entries(failures)) this.failures.set(k, v);
    }
  }
  cleanup(target: CleanupTarget): Promise<CleanupOutcome> {
    const forced = this.failures.get(target.cleanupId);
    if (forced) {
      return Promise.resolve({
        cleanupId: target.cleanupId,
        cleaned: false,
        error: forced.message,
        orphans: [target.resourceId],
      });
    }
    return Promise.resolve({
      cleanupId: target.cleanupId,
      cleaned: true,
      orphans: [],
    });
  }
}

// ============================================================
// PRODUCTION ADAPTER REGISTRY (registration-only contracts)
// ============================================================

export type Phase7ProductionAdapter =
  | 'ISOLATION_PORT'
  | 'ADVERSARIAL_PORT'
  | 'ABUSE_PORT'
  | 'UNSAFE_ACTION_PORT'
  | 'COMPLIANCE_EVIDENCE_PORT'
  | 'REVIEW_PORT'
  | 'DURABLE_REVIEW_QUEUE_STORE'
  | 'CLEANUP_PORT'
  | 'OPERATIONAL_ALERT_PORT';

export interface Phase7AdapterRegistry {
  register(adapter: Phase7ProductionAdapter, port: object): void;
  resolve(adapter: Phase7ProductionAdapter): object | null;
  list(): Phase7ProductionAdapter[];
}

export class InMemoryPhase7AdapterRegistry implements Phase7AdapterRegistry {
  private readonly map = new Map<Phase7ProductionAdapter, object>();
  register(adapter: Phase7ProductionAdapter, port: object): void {
    if (this.map.has(adapter)) {
      throw new Error(`Phase 7 adapter ${adapter} already registered`);
    }
    this.map.set(adapter, port);
  }
  resolve(adapter: Phase7ProductionAdapter): object | null {
    return this.map.get(adapter) ?? null;
  }
  list(): Phase7ProductionAdapter[] {
    return [...this.map.keys()];
  }
}

// ============================================================
// OPERATIONAL ALERT PORT
// ============================================================

export interface OperationalAlertPort {
  readonly status: 'REGISTERED' | 'UNSUPPORTED';
  emit(input: {
    category: OperationalAlertResult['category'];
    severity: OperationalAlertResult['severity'];
    target: string;
    message: string;
  }): Promise<OperationalAlertResult>;
}

export const OPERATIONAL_ALERT_UNSUPPORTED_REASON =
  'PHASE7_OPERATIONAL_ALERT_UNSUPPORTED';

export class InMemoryOperationalAlertPort implements OperationalAlertPort {
  readonly status = 'REGISTERED' as const;
  private readonly alerts: OperationalAlertResult[] = [];
  async emit(input: {
    category: OperationalAlertResult['category'];
    severity: OperationalAlertResult['severity'];
    target: string;
    message: string;
  }): Promise<OperationalAlertResult> {
    await Promise.resolve();
    const result: OperationalAlertResult = {
      alertId: randomUUID(),
      category: input.category,
      severity: input.severity,
      target: input.target,
      message: input.message,
      emittedAt: new Date().toISOString(),
      delivered: true,
      routing: 'IN_MEMORY',
    };
    this.alerts.push(result);
    return result;
  }
  list(): OperationalAlertResult[] {
    return [...this.alerts];
  }
}

export class UnsupportedOperationalAlertPort implements OperationalAlertPort {
  readonly status = 'UNSUPPORTED' as const;
  readonly reason =
    'No production operational-alert adapter (PagerDuty / Opsgenie / Slack-oncall) is registered for Phase 7. Alerts emitted through this adapter are recorded but never delivered externally.';
  async emit(input: {
    category: OperationalAlertResult['category'];
    severity: OperationalAlertResult['severity'];
    target: string;
    message: string;
  }): Promise<OperationalAlertResult> {
    await Promise.resolve();
    return {
      alertId: randomUUID(),
      category: input.category,
      severity: input.severity,
      target: input.target,
      message: `${input.message} [unsupported_routing]`,
      emittedAt: new Date().toISOString(),
      delivered: false,
      routing: 'UNSUPPORTED',
    };
  }
}
