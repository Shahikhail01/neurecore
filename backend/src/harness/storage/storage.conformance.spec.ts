/**
 * Harness Storage - Conformance Tests
 * Phase 2 v2.0: Verifies storage adapter meets append-only, encryption,
 * authorization, tenant scoping, redaction, and erasure contracts.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createHash } from 'crypto';
import {
  InMemoryEvidenceStorageAdapter,
  encryptContent,
  decryptContent,
} from './index';
import type {
  AuthorizationContext,
  EvidenceEnvelope,
} from '../contracts';

function sha256Of(content: Buffer | string): string {
  const buf = typeof content === 'string' ? Buffer.from(content) : content;
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

function buildAuth(
  tenantId: string,
  permissions: string[] = ['evidence:read', 'evidence:create', 'evidence:annotate'],
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

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '550e8400-e29b-41d4-a716-446655440002';

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

describe('In-Memory Storage Adapter (Phase 2 v2.0)', () => {
  let storage: InMemoryEvidenceStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryEvidenceStorageAdapter();
  });

  describe('create', () => {
    it('creates evidence with envelope and content', async () => {
      const envelope = buildEnvelope();
      const content = Buffer.from('test content');

      const ref = await storage.create(envelope, content, buildAuth(VALID_UUID));

      expect(ref.evidenceId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(ref.checksum).toBe(envelope.checksum);
    });

    it('rejects creation by unauthorized actor', async () => {
      const envelope = buildEnvelope();
      const content = Buffer.from('test');

      const auth = buildAuth(VALID_UUID, []); // no permissions

      await expect(storage.create(envelope, content, auth))
        .rejects.toThrow('Authorization denied');
    });

    it('rejects cross-tenant creation', async () => {
      const envelope = buildEnvelope({ tenantId: VALID_UUID });
      const auth = buildAuth(VALID_UUID_2);

      await expect(storage.create(envelope, Buffer.from('test'), auth))
        .rejects.toThrow('cannot access evidence of tenant');
    });

    it('throws on duplicate evidenceId (append-only)', async () => {
      const envelope = buildEnvelope();
      const content = Buffer.from('test');

      await storage.create(envelope, content, buildAuth(VALID_UUID));
      await expect(storage.create(envelope, content, buildAuth(VALID_UUID)))
        .rejects.toThrow('already exists');
    });

    it('rejects content with model hidden reasoning (§7.3)', async () => {
      const envelope = buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440099' });
      const content = Buffer.from(JSON.stringify({
        chainOfThought: 'I am thinking about...',
      }));

      await expect(
        storage.create(envelope, content, buildAuth(VALID_UUID))
      ).rejects.toThrow('model hidden reasoning');
    });
  });

  describe('read', () => {
    it('reads evidence by ID', async () => {
      const envelope = buildEnvelope();
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      const result = await storage.read('550e8400-e29b-41d4-a716-446655440001', buildAuth(VALID_UUID));
      expect(result.envelope.evidenceId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

it('denies cross-tenant read (§5.2)', async () => {
      const envelope = buildEnvelope({ tenantId: VALID_UUID });
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      await expect(storage.read('550e8400-e29b-41d4-a716-446655440001', buildAuth(VALID_UUID_2)))
        .rejects.toThrow('cannot access evidence of tenant');
    });

    it('allows super-admin cross-tenant read', async () => {
      const envelope = buildEnvelope({ tenantId: VALID_UUID });
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      const result = await storage.read('550e8400-e29b-41d4-a716-446655440001', buildAuth(VALID_UUID_2, [], true));
      expect(result.envelope.evidenceId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('throws for unknown evidenceId', async () => {
      await expect(storage.read('unknown', buildAuth(VALID_UUID)))
        .rejects.toThrow('not found');
    });
  });

  describe('readRedacted', () => {
    it('returns redacted content for display (§7.3)', async () => {
      const envelope = buildEnvelope();
      const sensitive = { password: 'secret', tenantId: VALID_UUID, data: 'visible' };
      await storage.create(envelope, Buffer.from(JSON.stringify(sensitive)), buildAuth(VALID_UUID));

      const result = await storage.readRedacted('550e8400-e29b-41d4-a716-446655440001', buildAuth(VALID_UUID));
      const parsed = JSON.parse(result.redactedContent.toString('utf-8'));

      expect(parsed.password).toBe('[REDACTED]');
      expect(parsed.tenantId).toBe(VALID_UUID); // preserved
      expect(parsed.data).toBe('visible');
    });
  });

  describe('list with tenant scoping (§5.2)', () => {
    it('enforces tenant filter automatically for non-super-admin', async () => {
      await storage.create(buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440010', tenantId: VALID_UUID }),
        Buffer.from('c1'), buildAuth(VALID_UUID));
      await storage.create(buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440011', tenantId: VALID_UUID_2 }),
        Buffer.from('c2'), buildAuth(VALID_UUID_2));

      const auth1 = buildAuth(VALID_UUID);
      const results = await storage.list({}, auth1);

      expect(results.every(e => e.tenantId === VALID_UUID)).toBe(true);
    });

    it('allows super-admin to view all tenants', async () => {
      await storage.create(buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440010', tenantId: VALID_UUID }),
        Buffer.from('c1'), buildAuth(VALID_UUID));
      await storage.create(buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440011', tenantId: VALID_UUID_2 }),
        Buffer.from('c2'), buildAuth(VALID_UUID_2));

      const results = await storage.list({}, buildAuth(VALID_UUID, [], true));
      expect(results.length).toBe(2);
    });
  });

  describe('verify - tamper detection', () => {
    it('returns VALID for unmodified evidence', async () => {
      const content = Buffer.from('content');
      const envelope = buildEnvelope({ checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      const result = await storage.verify('550e8400-e29b-41d4-a716-446655440001');
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('VALID');
    });

    it('returns NOT_FOUND for unknown evidence', async () => {
      const result = await storage.verify('00000000-0000-0000-0000-000000000000');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('returns CHECKSUM_MISMATCH on tampered evidence', async () => {
      const content = Buffer.from('content');
      const envelope = buildEnvelope({ checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      // Tamper content directly
      (storage as any).content.set('550e8400-e29b-41d4-a716-446655440001', Buffer.from('tampered'));

      const result = await storage.verify('550e8400-e29b-41d4-a716-446655440001');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('CHECKSUM_MISMATCH');
    });
  });

  describe('erase (§7.3)', () => {
    it('erases evidence and records tombstone', async () => {
      const envelope = buildEnvelope();
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      const result = await storage.erase('550e8400-e29b-41d4-a716-446655440001', 'GDPR request', buildAuth(VALID_UUID, ['evidence:erase']));

      expect(result.success).toBe(true);
      expect(result.tombstoneRecorded).toBe(true);
      expect(result.fieldsErased).toContain('content');

      const annotations = await storage.getAnnotations('550e8400-e29b-41d4-a716-446655440001');
      expect(annotations.some(a => a.annotationType === 'ERASURE')).toBe(true);
    });

    it('denies erase without evidence:erase permission', async () => {
      const envelope = buildEnvelope();
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      await expect(storage.erase('550e8400-e29b-41d4-a716-446655440001', 'request', buildAuth(VALID_UUID)))
        .rejects.toThrow('lacks permission evidence:erase');
    });
  });

  describe('tenantOffboarding (§7.3)', () => {
    it('erases all evidence for a tenant', async () => {
      await storage.create(buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440010', tenantId: VALID_UUID_3 }),
        Buffer.from('c1'), buildAuth(VALID_UUID_3, ['evidence:create', 'evidence:erase', 'evidence:read']));
      await storage.create(buildEnvelope({ evidenceId: '550e8400-e29b-41d4-a716-446655440011', tenantId: VALID_UUID_3 }),
        Buffer.from('c2'), buildAuth(VALID_UUID_3, ['evidence:create', 'evidence:erase', 'evidence:read']));

      const result = await storage.tenantOffboarding(VALID_UUID_3, 'GDPR', buildAuth(VALID_UUID_3, ['evidence:erase', 'evidence:read']));

      expect(result.totalEvidenceFound).toBe(2);
      expect(result.totalErased).toBe(2);
    });
  });

  describe('Encryption (§7.1)', () => {
    it('encrypts and decrypts content correctly', () => {
      const key = Buffer.alloc(32, 1);
      const plaintext = Buffer.from('secret data');
      const ciphertext = encryptContent(plaintext, key);
      const decrypted = decryptContent(ciphertext, key);

      expect(ciphertext).not.toEqual(plaintext);
      expect(decrypted).toEqual(plaintext);
    });

    it('throws on wrong key', () => {
      const key = Buffer.alloc(32, 1);
      const ciphertext = encryptContent(Buffer.from('data'), key);
      const wrongKey = Buffer.alloc(32, 2);

      expect(() => decryptContent(ciphertext, wrongKey)).toThrow();
    });
  });

  describe('scanForModelHiddenReasoning (§7.3)', () => {
    it('detects chainOfThought key', () => {
      const scan = storage.scanForModelHiddenReasoning({ chainOfThought: 'thinking...' });
      expect(scan.found).toBe(true);
    });

    it('detects hidden reasoning string pattern', () => {
      const scan = storage.scanForModelHiddenReasoning('I am doing chain of thought reasoning');
      expect(scan.found).toBe(true);
    });

    it('returns found=false for clean content', () => {
      const scan = storage.scanForModelHiddenReasoning({ data: 'normal content', tenantId: VALID_UUID });
      expect(scan.found).toBe(false);
    });
  });
});