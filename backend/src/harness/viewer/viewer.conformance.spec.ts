/**
 * Harness Viewer - Conformance Tests
 * Phase 2 v2.0: Verifies evidence viewer API with tenant scoping,
 * authorization, tamper detection, and redaction display.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createHash } from 'crypto';
import {
  EvidenceViewer,
  CorrelationViewer,
} from './index';
import { InMemoryEvidenceStorageAdapter } from '../storage';
import type {
  AuthorizationContext,
  EvidenceEnvelope,
} from '../contracts';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

function sha256Of(content: Buffer | string): string {
  const buf = typeof content === 'string' ? Buffer.from(content) : content;
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

function buildAuth(
  tenantId: string,
  permissions: string[] = ['evidence:read', 'evidence:create', 'evidence:annotate', 'retention:admin'],
  isSuperAdmin = false,
): AuthorizationContext {
  return {
    actorId: 'user-001',
    actorType: 'HUMAN',
    actorRoles: isSuperAdmin ? ['SUPER_ADMIN'] : ['TENANT_USER'],
    tenantId,
    correlationId: 'corr-001',
    permissions: permissions as AuthorizationContext['permissions'],
    isSuperAdmin,
  };
}

function buildEnvelope(overrides: Partial<EvidenceEnvelope> = {}): EvidenceEnvelope {
  return {
    schemaVersion: '1.0.0',
    evidenceId: '550e8400-e29b-41d4-a716-446655440001',
    runId: 'run-001',
    scenarioId: 'scenario-001',
    capabilityId: 'cap-001',
    tenantId: VALID_UUID,
    timestamp: new Date().toISOString(),
    producer: 'test-producer',
    mediaType: 'application/json',
    classification: 'INTERNAL',
    checksum: `sha256:${'a'.repeat(64)}`,
    storageRef: 'memory://550e8400-e29b-41d4-a716-446655440001',
    retentionClass: 'MEDIUM_TERM',
    redactionStatus: 'NOT_REQUIRED',
    correlationIds: ['corr-001'],
    ...overrides,
  };
}

describe('EvidenceViewer (Phase 2 v2.0)', () => {
  let storage: InMemoryEvidenceStorageAdapter;
  let viewer: EvidenceViewer;

  beforeEach(async () => {
    storage = new InMemoryEvidenceStorageAdapter();
    viewer = new EvidenceViewer(storage);
  });

  describe('getEvidence', () => {
    it('retrieves evidence by ID', async () => {
      const content = Buffer.from('test content');
      const envelope = buildEnvelope({ checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      const result = await viewer.getEvidence(envelope.evidenceId, buildAuth(VALID_UUID));

      expect(result.evidenceId).toBe(envelope.evidenceId);
      expect(result.runId).toBe('run-001');
      expect(result.integrityStatus).toBe('VALID');
    });

    it('denies cross-tenant access', async () => {
      const envelope = buildEnvelope();
      await storage.create(envelope, Buffer.from('test content'), buildAuth(VALID_UUID));

      await expect(viewer.getEvidence(envelope.evidenceId, buildAuth(VALID_UUID_2)))
        .rejects.toThrow('cannot access evidence of tenant');
    });

    it('throws for unknown evidence', async () => {
      await expect(viewer.getEvidence('00000000-0000-0000-0000-000000000000', buildAuth(VALID_UUID)))
        .rejects.toThrow();
    });

    it('detects tampered evidence', async () => {
      const content = Buffer.from('content');
      const envelope = buildEnvelope({ checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      (storage as any).content.set(envelope.evidenceId, Buffer.from('tampered'));

      const result = await viewer.getEvidence(envelope.evidenceId, buildAuth(VALID_UUID));
      expect(result.integrityStatus).toBe('INVALID');
    });
  });

  describe('getRedactedContent (§7.3)', () => {
    it('returns redacted content for display', async () => {
      const envelope = buildEnvelope();
      const sensitive = { password: 'secret', tenantId: VALID_UUID, data: 'visible' };
      await storage.create(envelope, Buffer.from(JSON.stringify(sensitive)), buildAuth(VALID_UUID));

      const result = await viewer.getRedactedContent(envelope.evidenceId, buildAuth(VALID_UUID));
      expect((result.redactedContent as any).password).toBe('[REDACTED]');
      expect((result.redactedContent as any).tenantId).toBe(VALID_UUID);
    });
  });

  describe('listEvidence with tenant scoping', () => {
    it('filters by tenantId automatically', async () => {
      const envelope1 = buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440010', tenantId: VALID_UUID });
      const envelope2 = buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440011', tenantId: VALID_UUID_2 });
      await storage.create(envelope1, Buffer.from('c1'), buildAuth(VALID_UUID));
      await storage.create(envelope2, Buffer.from('c2'), buildAuth(VALID_UUID_2));

      const result = await viewer.listEvidence({}, buildAuth(VALID_UUID));

      expect(result.total).toBe(1);
      expect(result.evidence.every(e => e.tenantId === VALID_UUID)).toBe(true);
    });

    it('super-admin can see all tenants', async () => {
      const envelope1 = buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440010', tenantId: VALID_UUID });
      const envelope2 = buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440011', tenantId: VALID_UUID_2 });
      await storage.create(envelope1, Buffer.from('c1'), buildAuth(VALID_UUID));
      await storage.create(envelope2, Buffer.from('c2'), buildAuth(VALID_UUID_2));

      const result = await viewer.listEvidence({}, buildAuth(VALID_UUID, [], true));
      expect(result.total).toBe(2);
    });
  });

  describe('getRunTrace', () => {
    it('returns trace for run with all evidence', async () => {
      for (let i = 0; i < 3; i++) {
        const content = Buffer.from(`content ${i}`);
        const envelope = buildEnvelope({
          evidenceId: `550e8400-e29b-41d4-a716-4466554401${i.toString().padStart(2, '0')}`,
          runId: 'run-001',
          checksum: sha256Of(content),
        });
        await storage.create(envelope, content, buildAuth(VALID_UUID));
      }

      const trace = await viewer.getRunTrace('run-001', buildAuth(VALID_UUID));

      expect(trace.runId).toBe('run-001');
      expect(trace.evidenceCount).toBe(3);
      expect(trace.hasIntegrityIssues).toBe(false);
    });

    it('detects integrity issues', async () => {
      const content = Buffer.from('content');
      const envelope = buildEnvelope({ checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      (storage as any).content.set(envelope.evidenceId, Buffer.from('tampered'));

      const trace = await viewer.getRunTrace('run-001', buildAuth(VALID_UUID));
      expect(trace.hasIntegrityIssues).toBe(true);
    });

    it('denies getRunTrace without evidence:read permission', async () => {
      const auth = buildAuth(VALID_UUID, []);
      await expect(viewer.getRunTrace('run-001', auth))
        .rejects.toThrow('lacks permission evidence:read');
    });
  });

  describe('getTenantEvidence', () => {
    it('returns tenant evidence summary', async () => {
      for (let i = 0; i < 3; i++) {
        const envelope = buildEnvelope({
          evidenceId: `550e8400-e29b-41d4-a716-4466554402${i.toString().padStart(2, '0')}`,
          tenantId: VALID_UUID,
          classification: 'INTERNAL',
        });
        await storage.create(envelope, Buffer.from(`content ${i}`), buildAuth(VALID_UUID));
      }

      const result = await viewer.getTenantEvidence(VALID_UUID, buildAuth(VALID_UUID));

      expect(result.tenantId).toBe(VALID_UUID);
      expect(result.totalEvidence).toBe(3);
      expect(result.byClassification['INTERNAL']).toBe(3);
    });

    it('denies cross-tenant view', async () => {
      await expect(
        viewer.getTenantEvidence(VALID_UUID_2, buildAuth(VALID_UUID))
      ).rejects.toThrow('cannot view tenant');
    });
  });

  describe('verifyEvidence', () => {
    it('returns verification result', async () => {
      const content = Buffer.from('content');
      const envelope = buildEnvelope({ checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      const result = await viewer.verifyEvidence(envelope.evidenceId, buildAuth(VALID_UUID));
      expect(result.valid).toBe(true);
    });
  });

  describe('getStats with auth', () => {
    it('requires retention:admin permission', async () => {
      const auth = buildAuth(VALID_UUID, ['evidence:read']);
      await expect(viewer.getStats(auth)).rejects.toThrow('lacks permission retention:admin');
    });

    it('returns stats with retention:admin permission', async () => {
      const auth = buildAuth(VALID_UUID, ['retention:admin', 'evidence:read']);
      const envelope = buildEnvelope();
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      const stats = await viewer.getStats(auth);
      expect(stats.totalEvidenceCount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('CorrelationViewer', () => {
  let storage: InMemoryEvidenceStorageAdapter;
  let viewer: CorrelationViewer;

  beforeEach(async () => {
    storage = new InMemoryEvidenceStorageAdapter();
    viewer = new CorrelationViewer(storage);
  });

  it('requires authorization', async () => {
    const auth = buildAuth(VALID_UUID, []);
    await expect(viewer.getCorrelationChain('corr-001', auth))
      .rejects.toThrow('lacks permission evidence:read');
  });

  it('returns null for unknown correlation ID', async () => {
    const result = await viewer.getCorrelationChain('unknown', buildAuth(VALID_UUID));
    expect(result).toBeNull();
  });

  it('returns chain for existing correlation ID', async () => {
    const envelope = buildEnvelope({ correlationIds: ['corr-001'] });
    await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

    const result = await viewer.getCorrelationChain('corr-001', buildAuth(VALID_UUID));

    expect(result).not.toBeNull();
    expect(result?.rootCorrelationId).toBe('corr-001');
    expect(result?.nodes).toHaveLength(1);
  });
});