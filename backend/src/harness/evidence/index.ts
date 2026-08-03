/**
 * NeureCore Harness - Evidence Module
 *
 * This module defines the append-only evidence plane per Phase 1 requirements:
 * - Append-only event and artifact metadata
 * - Content-addressed checksums
 * - Evidence envelope with required scenarioId/capabilityId
 * - Correlation ID propagation
 * - Immutable raw evidence with append-only annotations
 *
 * Document ID: NC-HARNESS-EVIDENCE-001
 * Version: 1.0
 * Status: PHASE_1_IMPLEMENTED
 */

import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import type {
  EvidenceEnvelope,
} from '../contracts';
import {
  EvidenceEnvelopeSchema,
  EvidenceClassification,
  EvidenceClassificationSchema,
  RetentionClass,
  RetentionClassSchema,
  RedactionStatus,
  RedactionStatusSchema,
  UuidSchema,
} from '../contracts';

// ============================================================
// CHECKSUM UTILITIES
// ============================================================

export function computeSha256(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export function computeContentChecksum(content: unknown): string {
  const serialized = typeof content === 'string' ? content : JSON.stringify(content);
  return computeSha256(serialized);
}

export function verifyChecksum(content: string, expectedChecksum: string): boolean {
  const actual = computeSha256(content);
  return actual === expectedChecksum;
}

// ============================================================
// EVIDENCE ENVELOPE FACTORY
// ============================================================

export interface CreateEvidenceEnvelopeParams {
  runId: string;
  scenarioId: string;
  capabilityId: string;
  tenantId: string;
  producer: string;
  mediaType: string;
  classification: EvidenceClassification;
  retentionClass: RetentionClass;
  redactionStatus: RedactionStatus;
  correlationIds: string[];
  content?: unknown;
  storageRef?: string;
}

export function createEvidenceEnvelope(
  params: CreateEvidenceEnvelopeParams,
): EvidenceEnvelope {
  const evidenceId = randomUUID();
  const timestamp = new Date().toISOString();
  const storageRef = params.storageRef ?? `evidence://${params.runId}/${evidenceId}`;

  const content = params.content ?? {};
  const checksum = computeContentChecksum(content);

  const envelope = EvidenceEnvelopeSchema.parse({
    schemaVersion: '1.0.0',
    evidenceId,
    runId: params.runId,
    scenarioId: params.scenarioId,
    capabilityId: params.capabilityId,
    tenantId: params.tenantId,
    timestamp,
    producer: params.producer,
    mediaType: params.mediaType,
    classification: params.classification,
    checksum,
    storageRef,
    retentionClass: params.retentionClass,
    redactionStatus: params.redactionStatus,
    correlationIds: params.correlationIds,
  });

  return envelope;
}

// ============================================================
// EVIDENCE STORE (append-only)
// ============================================================

export enum EvidenceEventType {
  CREATED = 'evidence:created',
  REDACTED = 'evidence:redacted',
  ANNOTATED = 'evidence:annotated',
  ARCHIVED = 'evidence:archived',
  EXPIRED = 'evidence:expired',
  REVOKED = 'evidence:revoked',
}

export interface EvidenceEvent {
  eventId: string;
  evidenceId: string;
  eventType: EvidenceEventType;
  timestamp: string;
  actorId: string;
  reason?: string;
  annotation?: string;
}

export interface EvidenceArtifact {
  envelope: EvidenceEnvelope;
  rawContent: unknown;
  redactedContent?: unknown;
  events: EvidenceEvent[];
}

export class EvidenceStore {
  private readonly artifacts = new Map<string, EvidenceArtifact>();
  private readonly events = new Map<string, EvidenceEvent[]>();

  append(envelope: EvidenceEnvelope, rawContent: unknown): EvidenceArtifact {
    if (this.artifacts.has(envelope.evidenceId)) {
      throw new Error(`Evidence ${envelope.evidenceId} already exists`);
    }

    const artifact: EvidenceArtifact = {
      envelope,
      rawContent,
      redactedContent: undefined,
      events: [],
    };

    this.artifacts.set(envelope.evidenceId, artifact);
    this.events.set(envelope.evidenceId, []);

    const event: EvidenceEvent = {
      eventId: randomUUID(),
      evidenceId: envelope.evidenceId,
      eventType: EvidenceEventType.CREATED,
      timestamp: new Date().toISOString(),
      actorId: envelope.producer,
    };

    this.addEvent(envelope.evidenceId, event);
    return artifact;
  }

  get(evidenceId: string): EvidenceArtifact | null {
    return this.artifacts.get(evidenceId) ?? null;
  }

  getByRunId(runId: string): EvidenceArtifact[] {
    return [...this.artifacts.values()].filter(
      (a) => a.envelope.runId === runId,
    );
  }

  getByScenarioId(scenarioId: string): EvidenceArtifact[] {
    return [...this.artifacts.values()].filter(
      (a) => a.envelope.scenarioId === scenarioId,
    );
  }

  getByCapabilityId(capabilityId: string): EvidenceArtifact[] {
    return [...this.artifacts.values()].filter(
      (a) => a.envelope.capabilityId === capabilityId,
    );
  }

  getByTenantId(tenantId: string): EvidenceArtifact[] {
    return [...this.artifacts.values()].filter(
      (a) => a.envelope.tenantId === tenantId,
    );
  }

  getEvents(evidenceId: string): EvidenceEvent[] {
    return this.events.get(evidenceId) ?? [];
  }

  addEvent(evidenceId: string, event: EvidenceEvent): void {
    const artifact = this.artifacts.get(evidenceId);
    if (!artifact) throw new Error(`Evidence ${evidenceId} not found`);

    artifact.events.push(event);
    const existing = this.events.get(evidenceId) ?? [];
    existing.push(event);
    this.events.set(evidenceId, existing);
  }

  redact(
    evidenceId: string,
    redactedContent: unknown,
    actorId: string,
    reason: string,
  ): EvidenceArtifact {
    const artifact = this.artifacts.get(evidenceId);
    if (!artifact) throw new Error(`Evidence ${evidenceId} not found`);

    const newChecksum = computeContentChecksum(redactedContent);

    const event: EvidenceEvent = {
      eventId: randomUUID(),
      evidenceId,
      eventType: EvidenceEventType.REDACTED,
      timestamp: new Date().toISOString(),
      actorId,
      reason,
    };

    this.addEvent(evidenceId, event);

    return {
      ...artifact,
      redactedContent,
      envelope: {
        ...artifact.envelope,
        checksum: newChecksum,
        redactionStatus: 'APPLIED' as RedactionStatus,
      },
    };
  }

  annotate(evidenceId: string, annotation: string, actorId: string): EvidenceEvent {
    const artifact = this.artifacts.get(evidenceId);
    if (!artifact) throw new Error(`Evidence ${evidenceId} not found`);

    const event: EvidenceEvent = {
      eventId: randomUUID(),
      evidenceId,
      eventType: EvidenceEventType.ANNOTATED,
      timestamp: new Date().toISOString(),
      actorId,
      annotation,
    };

    this.addEvent(evidenceId, event);
    return event;
  }

  verifyIntegrity(evidenceId: string): boolean {
    const artifact = this.artifacts.get(evidenceId);
    if (!artifact) return false;

    const content = artifact.redactedContent ?? artifact.rawContent;
    const computed = computeContentChecksum(content);
    return computed === artifact.envelope.checksum;
  }

  size(): number {
    return this.artifacts.size;
  }

  has(evidenceId: string): boolean {
    return this.artifacts.has(evidenceId);
  }

  list(): EvidenceArtifact[] {
    return [...this.artifacts.values()];
  }
}

// ============================================================
// CORRELATION PROPAGATION
// ============================================================

export interface CorrelationChain {
  rootCorrelationId: string;
  correlations: string[];
  tenantId: string;
  runId: string;
}

export function createCorrelationChain(
  tenantId: string,
  runId: string,
  initialCorrelationId: string,
): CorrelationChain {
  return {
    rootCorrelationId: initialCorrelationId,
    correlations: [initialCorrelationId],
    tenantId,
    runId,
  };
}

export function extendCorrelationChain(
  chain: CorrelationChain,
  newCorrelationId: string,
): CorrelationChain {
  return {
    ...chain,
    correlations: [...chain.correlations, newCorrelationId],
  };
}

// ============================================================
// REDACTION ENGINE
// ============================================================

export interface RedactionRule {
  fieldPattern: RegExp;
  replacement: string;
}

export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  { fieldPattern: /password/i, replacement: '[REDACTED-PASSWORD]' },
  { fieldPattern: /token|secret|key|credential/i, replacement: '[REDACTED-SECRET]' },
  { fieldPattern: /ssn|social.?security/i, replacement: '[REDACTED-SSN]' },
  { fieldPattern: /credit.?card|card.?number/i, replacement: '[REDACTED-CARD]' },
  { fieldPattern: /email/i, replacement: '[REDACTED-EMAIL]' },
  { fieldPattern: /phone/i, replacement: '[REDACTED-PHONE]' },
  { fieldPattern: /address/i, replacement: '[REDACTED-ADDRESS]' },
];

export function redactObject(
  obj: unknown,
  rules: RedactionRule[] = DEFAULT_REDACTION_RULES,
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    let result = obj;
    for (const rule of rules) {
      result = result.replace(rule.fieldPattern, rule.replacement);
    }
    return result;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, rules));
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      let shouldRedact = false;
      let replacement = '[REDACTED]';

      for (const rule of rules) {
        if (rule.fieldPattern.test(key)) {
          shouldRedact = true;
          replacement = rule.replacement;
          break;
        }
      }

      redacted[key] = shouldRedact ? replacement : redactObject(value, rules);
    }
    return redacted;
  }

  return obj;
}

// ============================================================
// EVIDENCE INDEX
// ============================================================

export interface EvidenceIndex {
  runId: string;
  scenarioId: string;
  capabilityIds: string[];
  tenantId: string;
  evidenceCount: number;
  totalSizeBytes: number;
  classification: EvidenceClassification;
  createdAt: string;
}

export function buildEvidenceIndex(
  store: EvidenceStore,
  runId: string,
  scenarioId: string,
  capabilityIds: string[],
  tenantId: string,
): EvidenceIndex {
  const artifacts = store.getByRunId(runId);

  return {
    runId,
    scenarioId,
    capabilityIds,
    tenantId,
    evidenceCount: artifacts.length,
    totalSizeBytes: artifacts.reduce((sum, a) => {
      const content = JSON.stringify(a.rawContent);
      return sum + content.length;
    }, 0),
    classification: artifacts[0]?.envelope.classification ?? 'INTERNAL',
    createdAt: new Date().toISOString(),
  };
}
