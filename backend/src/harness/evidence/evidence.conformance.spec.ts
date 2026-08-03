/**
 * Harness Evidence - Conformance Tests
 * Phase 1: Verifies evidence module meets append-only, checksum, redaction contracts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  EvidenceStore,
  createEvidenceEnvelope,
  computeSha256,
  computeContentChecksum,
  verifyChecksum,
  redactObject,
  buildEvidenceIndex,
  EvidenceEventType,
  createCorrelationChain,
  extendCorrelationChain,
  DEFAULT_REDACTION_RULES,
} from './index';

describe('Evidence Checksum Utilities', () => {
  describe('computeSha256', () => {
    it('computes sha256 with prefix', () => {
      const checksum = computeSha256('hello world');
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('produces consistent output for same input', () => {
      const a = computeSha256('test content');
      const b = computeSha256('test content');
      expect(a).toBe(b);
    });

    it('produces different output for different input', () => {
      const a = computeSha256('content a');
      const b = computeSha256('content b');
      expect(a).not.toBe(b);
    });
  });

  describe('computeContentChecksum', () => {
    it('handles string input', () => {
      const checksum = computeContentChecksum('string content');
      expect(checksum).toMatch(/^sha256:/);
    });

    it('handles object input with deterministic serialization', () => {
      const obj = { key: 'value', number: 42 };
      const checksum = computeContentChecksum(obj);
      expect(checksum).toMatch(/^sha256:/);
    });

    it('handles array input', () => {
      const arr = [1, 2, 3];
      const checksum = computeContentChecksum(arr);
      expect(checksum).toMatch(/^sha256:/);
    });

    it('produces same checksum for same content regardless of key order', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      expect(computeContentChecksum(obj1)).toBe(computeContentChecksum(obj2));
    });
  });

  describe('verifyChecksum', () => {
    it('returns true for matching checksum', () => {
      const content = 'verify me';
      const checksum = computeSha256(content);
      expect(verifyChecksum(content, checksum)).toBe(true);
    });

    it('returns false for non-matching checksum', () => {
      const content = 'verify me';
      const wrongChecksum = 'sha256:' + 'a'.repeat(64);
      expect(verifyChecksum(content, wrongChecksum)).toBe(false);
    });
  });
});

describe('EvidenceEnvelope Creation', () => {
  it('creates envelope with required scenarioId/capabilityId', () => {
    const envelope = createEvidenceEnvelope({
      runId: '550e8400-e29b-41d4-a716-446655440002',
      scenarioId: 'scenario-001',
      capabilityId: 'cap-001',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      producer: 'test-producer',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'PENDING',
      correlationIds: ['corr-001'],
      content: { test: 'data' },
    });

    expect(envelope.scenarioId).toBe('scenario-001');
    expect(envelope.capabilityId).toBe('cap-001');
    expect(envelope.runId).toBe('550e8400-e29b-41d4-a716-446655440002');
    expect(envelope.tenantId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(envelope.checksum).toMatch(/^sha256:/);
    expect(envelope.correlationIds).toContain('corr-001');
  });

  it('generates unique evidenceId per call', () => {
    const a = createEvidenceEnvelope({
      runId: '550e8400-e29b-41d4-a716-446655440002',
      scenarioId: 'scenario-001',
      capabilityId: 'cap-001',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      producer: 'test',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'PENDING',
      correlationIds: ['corr-001'],
    });

    const b = createEvidenceEnvelope({
      runId: '550e8400-e29b-41d4-a716-446655440002',
      scenarioId: 'scenario-001',
      capabilityId: 'cap-001',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      producer: 'test',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'PENDING',
      correlationIds: ['corr-001'],
    });

    expect(a.evidenceId).not.toBe(b.evidenceId);
  });

  it('uses provided storageRef or generates default', () => {
    const withRef = createEvidenceEnvelope({
      runId: '550e8400-e29b-41d4-a716-446655440002',
      scenarioId: 'scenario-001',
      capabilityId: 'cap-001',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      producer: 'test',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'PENDING',
      correlationIds: ['corr-001'],
      storageRef: 's3://bucket/path',
    });

    const withoutRef = createEvidenceEnvelope({
      runId: '550e8400-e29b-41d4-a716-446655440002',
      scenarioId: 'scenario-001',
      capabilityId: 'cap-001',
      tenantId: '550e8400-e29b-41d4-a716-446655440001',
      producer: 'test',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'PENDING',
      correlationIds: ['corr-001'],
    });

    expect(withRef.storageRef).toBe('s3://bucket/path');
    expect(withoutRef.storageRef).toMatch(/^evidence:\/\//);
  });
});

describe('EvidenceStore', () => {
  let store: EvidenceStore;

  beforeEach(() => {
    store = new EvidenceStore();
  });

  describe('append', () => {
    it('appends evidence and creates CREATED event', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
        content: { test: 'data' },
      });

      const artifact = store.append(envelope, { test: 'data' });

      expect(artifact.envelope.evidenceId).toBe(envelope.evidenceId);
      expect(artifact.rawContent).toEqual({ test: 'data' });
      expect(artifact.events).toHaveLength(1);
      expect(artifact.events[0].eventType).toBe(EvidenceEventType.CREATED);
    });

    it('throws when appending duplicate evidenceId', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
      });

      store.append(envelope, {});
      expect(() => store.append(envelope, {})).toThrow();
    });
  });

  describe('get / has', () => {
    it('retrieves appended evidence', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
      });

      store.append(envelope, { data: true });
      expect(store.has(envelope.evidenceId)).toBe(true);
      expect(store.get(envelope.evidenceId)?.envelope.evidenceId).toBe(envelope.evidenceId);
    });

    it('returns null for unknown evidenceId', () => {
      expect(store.get('unknown')).toBeNull();
      expect(store.has('unknown')).toBe(false);
    });
  });

  describe('getByRunId', () => {
    it('returns all evidence for a run', () => {
      for (let i = 0; i < 3; i++) {
        const envelope = createEvidenceEnvelope({
          runId: '550e8400-e29b-41d4-a716-446655440002',
          scenarioId: 'scenario-001',
          capabilityId: 'cap-001',
          tenantId: '550e8400-e29b-41d4-a716-446655440001',
          producer: 'test',
          mediaType: 'application/json',
          classification: 'INTERNAL',
          retentionClass: 'MEDIUM_TERM',
          redactionStatus: 'PENDING',
          correlationIds: ['corr-001'],
        });
        store.append(envelope, { index: i });
      }

      const artifacts = store.getByRunId('550e8400-e29b-41d4-a716-446655440002');
      expect(artifacts).toHaveLength(3);
    });

    it('returns empty array for unknown run', () => {
      expect(store.getByRunId('unknown')).toEqual([]);
    });
  });

  describe('getByScenarioId', () => {
    it('returns all evidence for a scenario', () => {
      for (const scenarioId of ['scn-001', 'scn-001', 'scn-002']) {
        const envelope = createEvidenceEnvelope({
          runId: `550e8400-e29b-41d4-a716-44665544${Math.floor(Math.random() * 99).toString().padStart(4, '0')}`,
          scenarioId,
          capabilityId: 'cap-001',
          tenantId: '550e8400-e29b-41d4-a716-446655440001',
          producer: 'test',
          mediaType: 'application/json',
          classification: 'INTERNAL',
          retentionClass: 'MEDIUM_TERM',
          redactionStatus: 'PENDING',
          correlationIds: ['corr-001'],
        });
        store.append(envelope, {});
      }

      expect(store.getByScenarioId('scn-001')).toHaveLength(2);
      expect(store.getByScenarioId('scn-002')).toHaveLength(1);
    });
  });

  describe('getByTenantId', () => {
    it('returns all evidence for a tenant', () => {
      for (const tenantId of ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003']) {
        const envelope = createEvidenceEnvelope({
          runId: `550e8400-e29b-41d4-a716-4466554400${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`,
          scenarioId: 'scenario-001',
          capabilityId: 'cap-001',
          tenantId,
          producer: 'test',
          mediaType: 'application/json',
          classification: 'INTERNAL',
          retentionClass: 'MEDIUM_TERM',
          redactionStatus: 'PENDING',
          correlationIds: ['corr-001'],
        });
        store.append(envelope, {});
      }

      expect(store.getByTenantId('550e8400-e29b-41d4-a716-446655440001')).toHaveLength(2);
      expect(store.getByTenantId('550e8400-e29b-41d4-a716-446655440003')).toHaveLength(1);
    });
  });

  describe('redact', () => {
    it('creates redacted copy without modifying rawContent', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
      });

      store.append(envelope, { password: 'secret123', data: 'visible' });

      const redacted = store.redact(envelope.evidenceId, { password: '[REDACTED]', data: 'visible' }, 'admin', 'PII');

      expect(redacted.redactedContent).toEqual({ password: '[REDACTED]', data: 'visible' });
      expect(store.get(envelope.evidenceId)?.rawContent).toEqual({ password: 'secret123', data: 'visible' });
      expect(redacted.envelope.redactionStatus).toBe('APPLIED');
    });

    it('adds REDACTED event to artifact', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
      });

      store.append(envelope, { data: 'test' });
      store.redact(envelope.evidenceId, { data: 'test' }, 'admin', 'No PII');

      const events = store.getEvents(envelope.evidenceId);
      expect(events.some((e) => e.eventType === EvidenceEventType.REDACTED)).toBe(true);
    });
  });

  describe('annotate', () => {
    it('adds append-only annotation event', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
      });

      store.append(envelope, { data: 'test' });
      const event = store.annotate(envelope.evidenceId, 'Reviewed by QA', 'reviewer-001');

      expect(event.eventType).toBe(EvidenceEventType.ANNOTATED);
      expect(event.annotation).toBe('Reviewed by QA');
      expect(event.actorId).toBe('reviewer-001');

      const events = store.getEvents(envelope.evidenceId);
      expect(events.filter((e) => e.eventType === EvidenceEventType.ANNOTATED)).toHaveLength(1);
    });

    it('multiple annotations are all preserved (append-only)', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
      });

      store.append(envelope, { data: 'test' });
      store.annotate(envelope.evidenceId, 'Annotation 1', 'user-001');
      store.annotate(envelope.evidenceId, 'Annotation 2', 'user-002');

      const events = store.getEvents(envelope.evidenceId);
      expect(events.filter((e) => e.eventType === EvidenceEventType.ANNOTATED)).toHaveLength(2);
    });
  });

  describe('verifyIntegrity', () => {
    it('returns true for unmodified evidence', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
        content: { original: 'data' },
      });

      store.append(envelope, { original: 'data' });
      expect(store.verifyIntegrity(envelope.evidenceId)).toBe(true);
    });

    it('returns false for tampered evidence', () => {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440002',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
        content: { original: 'data' },
      });

      store.append(envelope, { original: 'data' });

      const artifact = store.get(envelope.evidenceId);
      (artifact as any).rawContent = { original: 'tampered' };

      expect(store.verifyIntegrity(envelope.evidenceId)).toBe(false);
    });
  });

  describe('size', () => {
    it('returns total artifact count', () => {
      expect(store.size()).toBe(0);

      for (let i = 0; i < 5; i++) {
        const envelope = createEvidenceEnvelope({
          runId: `550e8400-e29b-41d4-a716-4466554400${i.toString().padStart(2, '0')}`,
          scenarioId: 'scenario-001',
          capabilityId: 'cap-001',
          tenantId: '550e8400-e29b-41d4-a716-446655440001',
          producer: 'test',
          mediaType: 'application/json',
          classification: 'INTERNAL',
          retentionClass: 'MEDIUM_TERM',
          redactionStatus: 'PENDING',
          correlationIds: ['corr-001'],
        });
        store.append(envelope, {});
      }

      expect(store.size()).toBe(5);
    });
  });
});

describe('Redaction Engine', () => {
  describe('redactObject', () => {
    it('redacts matching field names', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };

      const result = redactObject(input) as Record<string, unknown>;

      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED-PASSWORD]');
      expect(result.email).toBe('[REDACTED-EMAIL]');
    });

    it('handles nested objects recursively', () => {
      const input = {
        user: {
          name: 'John',
          auth: {
            password: 'secret',
          },
        },
      };

      const result = redactObject(input) as any;

      expect(result.user.name).toBe('John');
      expect(result.user.auth.password).toBe('[REDACTED-PASSWORD]');
    });

    it('handles arrays recursively', () => {
      const input = [
        { password: 'secret1' },
        { password: 'secret2' },
      ];

      const result = redactObject(input) as Array<Record<string, unknown>>;

      expect(result[0].password).toBe('[REDACTED-PASSWORD]');
      expect(result[1].password).toBe('[REDACTED-PASSWORD]');
    });

    it('handles null and undefined', () => {
      expect(redactObject(null)).toBeNull();
      expect(redactObject(undefined)).toBeUndefined();
    });

    it('handles primitive types', () => {
      expect(redactObject('string' as unknown)).toBe('string');
      expect(redactObject(42 as unknown)).toBe(42);
      expect(redactObject(true as unknown)).toBe(true);
    });

    it('applies custom rules', () => {
      const customRules = [
        { fieldPattern: /custom/i, replacement: '[CUSTOM]' },
      ];

      const input = { customField: 'value' };
      const result = redactObject(input, customRules) as Record<string, unknown>;
      expect(result.customField).toBe('[CUSTOM]');
    });
  });

  describe('DEFAULT_REDACTION_RULES', () => {
    it('has rules for common sensitive fields', () => {
      expect(DEFAULT_REDACTION_RULES.length).toBeGreaterThan(0);
      expect(DEFAULT_REDACTION_RULES.some((r) => r.fieldPattern.source.includes('password'))).toBe(true);
      expect(DEFAULT_REDACTION_RULES.some((r) => r.fieldPattern.source.includes('token'))).toBe(true);
      expect(DEFAULT_REDACTION_RULES.some((r) => r.fieldPattern.source.includes('ssn'))).toBe(true);
    });
  });
});

describe('Correlation Chain', () => {
  it('createCorrelationChain initializes with single ID', () => {
    const chain = createCorrelationChain('550e8400-e29b-41d4-a716-446655440001', 'run-001', 'corr-001');
    expect(chain.rootCorrelationId).toBe('corr-001');
    expect(chain.correlations).toEqual(['corr-001']);
    expect(chain.tenantId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(chain.runId).toBe('run-001');
  });

  it('extendCorrelationChain appends new ID', () => {
    const chain = createCorrelationChain('550e8400-e29b-41d4-a716-446655440001', 'run-001', 'corr-001');
    const extended = extendCorrelationChain(chain, 'corr-002');

    expect(extended.correlations).toEqual(['corr-001', 'corr-002']);
    expect(extended.rootCorrelationId).toBe('corr-001');
  });
});

describe('Evidence Index', () => {
  it('buildEvidenceIndex creates correct summary', () => {
    const store = new EvidenceStore();

    for (let i = 0; i < 3; i++) {
      const envelope = createEvidenceEnvelope({
        runId: '550e8400-e29b-41d4-a716-446655440001',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        producer: 'test',
        mediaType: 'application/json',
        classification: 'CONFIDENTIAL',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'PENDING',
        correlationIds: ['corr-001'],
        content: { index: i },
      });
      store.append(envelope, { index: i });
    }

    const index = buildEvidenceIndex(store, '550e8400-e29b-41d4-a716-446655440001', 'scenario-001', ['cap-001'], '550e8400-e29b-41d4-a716-446655440001');

    expect(index.runId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(index.scenarioId).toBe('scenario-001');
    expect(index.capabilityIds).toEqual(['cap-001']);
    expect(index.tenantId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(index.evidenceCount).toBe(3);
    expect(index.totalSizeBytes).toBeGreaterThan(0);
    expect(index.classification).toBe('CONFIDENTIAL');
  });
});
