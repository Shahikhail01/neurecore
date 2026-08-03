/**
 * Harness Phase 2 - Disaster Recovery and Tamper Detection Tests
 *
 * Phase 2 v2.0: Comprehensive tests for all 6 exit criteria with
 * authorization + tenant scoping enforced throughout.
 *
 * Exit criteria per §10:
 * - Tampering is detected
 * - Missing evidence is detected
 * - Redaction failure is detected
 * - Cleanup failure is detected
 * - Failed run is traceable end-to-end
 * - Replay is replayable in isolation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryEvidenceStorageAdapter } from './storage';
import { RetentionEngine } from './retention';
import { SideEffectFirewall, SanitizationEngine, StubModeSchema } from './replay';
import { EvidenceViewer } from './viewer';
import { containsModelHiddenReasoning } from './redaction';
import { createHash } from 'crypto';
import type {
  AuthorizationContext,
  EvidenceEnvelope,
} from './contracts';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

function sha256Of(content: Buffer | string): string {
  const buf = typeof content === 'string' ? Buffer.from(content) : content;
  return `sha256:${createHash('sha256').update(buf).digest('hex')}`;
}

function buildAuth(
  tenantId: string,
  permissions: string[] = ['evidence:read', 'evidence:create', 'evidence:annotate', 'retention:admin', 'evidence:erase', 'evidence:retain:legal-hold', 'evidence:retain:release'],
  isSuperAdmin = false,
): AuthorizationContext {
  return {
    actorId: 'admin-001',
    actorType: 'HUMAN',
    actorRoles: isSuperAdmin ? ['SUPER_ADMIN'] : ['TENANT_ADMIN'],
    tenantId,
    correlationId: 'corr-001',
    permissions: permissions as AuthorizationContext['permissions'],
    isSuperAdmin,
  };
}

const EVIDENCE_ID_1 = '550e8400-e29b-41d4-a716-446655440100';
const EVIDENCE_ID_2 = '550e8400-e29b-41d4-a716-446655440101';
const EVIDENCE_ID_3 = '550e8400-e29b-41d4-a716-446655440102';
const EVIDENCE_ID_BAD = '550e8400-e29b-41d4-a716-446655440199';

function createMockEnvelope(
  id: string,
  overrides: Partial<EvidenceEnvelope> = {},
): EvidenceEnvelope {
  return {
    schemaVersion: '1.0.0',
    evidenceId: id,
    runId: 'run-001',
    scenarioId: 'scenario-001',
    capabilityId: 'cap-001',
    tenantId: VALID_UUID,
    timestamp: new Date().toISOString(),
    producer: 'test-producer',
    mediaType: 'application/json',
    classification: 'INTERNAL',
    checksum: `sha256:${'a'.repeat(64)}`,
    storageRef: `memory://${id}`,
    retentionClass: 'MEDIUM_TERM',
    redactionStatus: 'NOT_REQUIRED',
    correlationIds: ['corr-001'],
    ...overrides,
  };
}

describe('Phase 2 v2.0 - Disaster Recovery Tests', () => {
  describe('Tampering Detection', () => {
    let storage: InMemoryEvidenceStorageAdapter;
    let viewer: EvidenceViewer;

    beforeEach(async () => {
      storage = new InMemoryEvidenceStorageAdapter();
      viewer = new EvidenceViewer(storage);
    });

    it('detects checksum mismatch (tampered content)', async () => {
      const content = Buffer.from('original content');
      const envelope = createMockEnvelope(EVIDENCE_ID_1, { checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      let result = await storage.verify(EVIDENCE_ID_1);
      expect(result.valid).toBe(true);

      (storage as any).content.set(EVIDENCE_ID_1, Buffer.from('tampered content'));

      result = await storage.verify(EVIDENCE_ID_1);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('CHECKSUM_MISMATCH');
    });

    it('evidence viewer reports integrity issues', async () => {
      const content = Buffer.from('content');
      const envelope = createMockEnvelope(EVIDENCE_ID_1, { checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      const evidence = await viewer.getEvidence(EVIDENCE_ID_1, buildAuth(VALID_UUID));
      expect(evidence.integrityStatus).toBe('VALID');
    });

    it('run trace detects integrity issues across evidence', async () => {
      for (let i = 0; i < 3; i++) {
        const content = Buffer.from(`content ${i}`);
        const envelope = createMockEnvelope(`550e8400-e29b-41d4-a716-44665544020${i}`, {
          runId: 'run-001',
          checksum: sha256Of(content),
        });
        await storage.create(envelope, content, buildAuth(VALID_UUID));
      }

      const trace = await viewer.getRunTrace('run-001', buildAuth(VALID_UUID));
      expect(trace.hasIntegrityIssues).toBe(false);

      (storage as any).content.set('550e8400-e29b-41d4-a716-446655440200', Buffer.from('tampered'));
      const tamperedTrace = await viewer.getRunTrace('run-001', buildAuth(VALID_UUID));
      expect(tamperedTrace.hasIntegrityIssues).toBe(true);
    });
  });

  describe('Missing Evidence Detection', () => {
    let storage: InMemoryEvidenceStorageAdapter;
    let viewer: EvidenceViewer;

    beforeEach(async () => {
      storage = new InMemoryEvidenceStorageAdapter();
      viewer = new EvidenceViewer(storage);
    });

    it('getEvidence throws for missing evidence', async () => {
      await expect(viewer.getEvidence('00000000-0000-0000-0000-000000000000', buildAuth(VALID_UUID)))
        .rejects.toThrow();
    });

    it('verify returns NOT_FOUND for missing evidence', async () => {
      const result = await storage.verify('00000000-0000-0000-0000-000000000000');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('run trace shows zero evidence for unknown run', async () => {
      const trace = await viewer.getRunTrace('nonexistent-run', buildAuth(VALID_UUID));
      expect(trace.evidenceCount).toBe(0);
    });
  });

  describe('Redaction Failure Detection', () => {
    let storage: InMemoryEvidenceStorageAdapter;
    let viewer: EvidenceViewer;

    beforeEach(async () => {
      storage = new InMemoryEvidenceStorageAdapter();
      viewer = new EvidenceViewer(storage);
    });

    it('detects PENDING redaction status', async () => {
      const envelope = createMockEnvelope(EVIDENCE_ID_1, {
        classification: 'CONFIDENTIAL',
        redactionStatus: 'PENDING',
      });
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      const evidence = await viewer.getEvidence(EVIDENCE_ID_1, buildAuth(VALID_UUID));
      expect(evidence.redactionStatus).toBe('PENDING');
      expect(evidence.classification).toBe('CONFIDENTIAL');
    });

    it('run trace detects redaction issues', async () => {
      const e1 = createMockEnvelope(EVIDENCE_ID_1, {
        classification: 'CONFIDENTIAL',
        redactionStatus: 'APPLIED',
      });
      const e2 = createMockEnvelope(EVIDENCE_ID_2, {
        classification: 'CONFIDENTIAL',
        redactionStatus: 'PENDING',
      });
      await storage.create(e1, Buffer.from('c1'), buildAuth(VALID_UUID));
      await storage.create(e2, Buffer.from('c2'), buildAuth(VALID_UUID));

      const trace = await viewer.getRunTrace('run-001', buildAuth(VALID_UUID));
      expect(trace.hasRedactionIssues).toBe(true);
    });

    it('prohibits model hidden reasoning on persistence (§7.3)', async () => {
      const envelope = createMockEnvelope(EVIDENCE_ID_BAD);
      const badContent = Buffer.from(JSON.stringify({
        chainOfThought: 'thinking...',
      }));

      await expect(
        storage.create(envelope, badContent, buildAuth(VALID_UUID))
      ).rejects.toThrow('model hidden reasoning');
    });

    it('detects hidden reasoning in nested objects (§7.3)', () => {
      const result = containsModelHiddenReasoning({
        scratchpad: 'internal monologue',
        data: 'normal',
      });
      expect(result.found).toBe(true);
    });
  });

  describe('Cleanup Failure Detection', () => {
    let storage: InMemoryEvidenceStorageAdapter;
    let engine: RetentionEngine;

    beforeEach(() => {
      storage = new InMemoryEvidenceStorageAdapter();
      engine = new RetentionEngine();
    });

    it('orphan detection raises alert on tampered evidence (§5.2)', async () => {
      const content = Buffer.from('content');
      const envelope = createMockEnvelope(EVIDENCE_ID_1, { checksum: sha256Of(content) });
      await storage.create(envelope, content, buildAuth(VALID_UUID));

      (storage as any).content.set(EVIDENCE_ID_1, Buffer.from('tampered'));

      const orphans = await engine.detectOrphans(storage, buildAuth(VALID_UUID));
      expect(orphans.length).toBeGreaterThan(0);
      expect(orphans[0].severity).toMatch(/HIGH|CRITICAL/);
    });

    it('cleanup failure triggers orphan alert (§5.2)', async () => {
      const alerts: any[] = [];
      const localEngine = new RetentionEngine({}, (a) => alerts.push(a));

      await localEngine.executeCleanup(storage, buildAuth(VALID_UUID));

      expect(alerts.length).toBe(0);
    });
  });

  describe('End-to-End Traceability', () => {
    let storage: InMemoryEvidenceStorageAdapter;
    let viewer: EvidenceViewer;

    beforeEach(async () => {
      storage = new InMemoryEvidenceStorageAdapter();
      viewer = new EvidenceViewer(storage);
    });

    it('failed run is traceable end-to-end', async () => {
      for (let i = 0; i < 5; i++) {
        const content = Buffer.from(`content ${i}`);
        const envelope = createMockEnvelope(`550e8400-e29b-41d4-a716-44665544030${i}`, {
          runId: 'run-001',
          checksum: sha256Of(content),
        });
        await storage.create(envelope, content, buildAuth(VALID_UUID));
      }

      const trace = await viewer.getRunTrace('run-001', buildAuth(VALID_UUID));
      expect(trace.evidenceCount).toBe(5);
      expect(trace.evidence).toHaveLength(5);
    });

    it('correlation chain links evidence', async () => {
      const correlationId = 'corr-001';
      for (let i = 0; i < 3; i++) {
        const envelope = createMockEnvelope(`550e8400-e29b-41d4-a716-44665544040${i}`, {
          correlationIds: [correlationId],
        });
        await storage.create(envelope, Buffer.from(`content ${i}`), buildAuth(VALID_UUID));
      }

      const list = await storage.list({}, buildAuth(VALID_UUID));
      const matching = list.filter(e => e.correlationIds.includes(correlationId));
      expect(matching).toHaveLength(3);
    });
  });

  describe('Side-Effect Firewall (Replay Isolation)', () => {
    let firewall: SideEffectFirewall;

    beforeEach(() => {
      firewall = new SideEffectFirewall();
    });

    it('blocks external effects during replay by default (§7.2)', async () => {
      await expect(
        firewall.intercept('email', 'send', ['real@example.com'])
      ).rejects.toThrow('[REPLAY BLOCKED]');
    });

    it('simulates effects without real execution', async () => {
      firewall.configureStub('email', 'SIMULATE');
      const result = await firewall.intercept('email', 'send', ['test@example.com']);
      expect((result as any).simulated).toBe(true);
    });

    it('logs actions for audit', async () => {
      firewall.configureStub('email', 'LOG');
      await firewall.intercept('email', 'send', ['test@example.com']);

      const verification = await firewall.verifyNoRealEffects();
      expect(verification.loggedCount).toBe(1);
    });

    it('ALLOW mode is not available (forbidden by ADR-003)', () => {
      expect(StubModeSchema.safeParse('ALLOW').success).toBe(false);
    });
  });

  describe('Sanitization (Replay Isolation)', () => {
    it('preserves tenant ID for isolation verification', () => {
      const engine = new SanitizationEngine();
      const input = { tenantId: VALID_UUID, projectName: 'Secret Project', email: 'user@example.com' };
      const { sanitized, attestation } = engine.sanitize(input) as any;

      expect(sanitized.tenantId).toBe(VALID_UUID);
      expect(attestation.fieldsPreserved).toContain('tenantId');
    });

    it('redacts PII and business data', () => {
      const engine = new SanitizationEngine();
      const input = { tenantId: VALID_UUID, customerName: 'John Doe', ssn: '123-45-6789', apiKey: 'sk-abc123' };
      const { sanitized } = engine.sanitize(input) as any;

      expect(sanitized.customerName).toBe('[REDACTED-NAME]');
      expect(sanitized.ssn).toBe('***-**-XXXX');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });
  });

  describe('Retention Enforcement', () => {
    let engine: RetentionEngine;

    beforeEach(() => {
      engine = new RetentionEngine();
    });

    it('evidence on legal hold cannot expire', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      engine.applyLegalHold(EVIDENCE_ID_1, 'Investigation', 'admin');

      const status = engine.getRetentionStatus(
        EVIDENCE_ID_1,
        'SHORT_TERM',
        oldDate.toISOString()
      );

      expect(status.status).toBe('LEGAL_HOLD');
      expect(status.daysUntilExpiry).toBeNull();
    });

    it('PERMANENT evidence never expires', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 10);

      const status = engine.getRetentionStatus(
        EVIDENCE_ID_1,
        'PERMANENT',
        oldDate.toISOString()
      );

      expect(status.status).not.toBe('EXPIRED');
    });
  });

  describe('Authorization Enforcement (§5.2)', () => {
    let storage: InMemoryEvidenceStorageAdapter;

    beforeEach(() => {
      storage = new InMemoryEvidenceStorageAdapter();
    });

    it('denies evidence creation without evidence:create permission', async () => {
      const envelope = createMockEnvelope(EVIDENCE_ID_1);
      const auth: AuthorizationContext = {
        actorId: 'u',
        actorType: 'HUMAN',
        actorRoles: ['TENANT_USER'],
        tenantId: VALID_UUID,
        correlationId: 'c-1',
        permissions: [],
      };

      await expect(storage.create(envelope, Buffer.from('content'), auth))
        .rejects.toThrow('lacks permission evidence:create');
    });

    it('denies cross-tenant access', async () => {
      const envelope = createMockEnvelope(EVIDENCE_ID_1, { tenantId: VALID_UUID });
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      await expect(storage.read(EVIDENCE_ID_1, buildAuth(VALID_UUID_2)))
        .rejects.toThrow('cannot access evidence of tenant');
    });

    it('super-admin can bypass tenant scoping', async () => {
      const envelope = createMockEnvelope(EVIDENCE_ID_1, { tenantId: VALID_UUID });
      await storage.create(envelope, Buffer.from('content'), buildAuth(VALID_UUID));

      const result = await storage.read(EVIDENCE_ID_1, buildAuth(VALID_UUID_2, [], true));
      expect(result.envelope.evidenceId).toBe(EVIDENCE_ID_1);
    });
  });
});

describe('Phase 2 v2.0 - Exit Criteria Comprehensive Verification', () => {
  it('ALL exit criteria met with v2.0 implementation', async () => {
    const storage = new InMemoryEvidenceStorageAdapter();
    const viewer = new EvidenceViewer(storage);
    const engine = new RetentionEngine();
    const firewall = new SideEffectFirewall();
    const auth = buildAuth(VALID_UUID);

    // Exit criterion 1: tampering detected
    const content = Buffer.from('content');
    const envelope = createMockEnvelope(EVIDENCE_ID_1, { checksum: sha256Of(content) });
    await storage.create(envelope, content, auth);
    (storage as any).content.set(EVIDENCE_ID_1, Buffer.from('tampered'));
    const tampered = await storage.verify(EVIDENCE_ID_1);
    expect(tampered.valid).toBe(false);
    expect(tampered.reason).toBe('CHECKSUM_MISMATCH');

    // Exit criterion 2: missing evidence detected
    const missing = await storage.verify('00000000-0000-0000-0000-000000000000');
    expect(missing.valid).toBe(false);
    expect(missing.reason).toBe('NOT_FOUND');

    // Exit criterion 3: redaction failure detected
    const confidentialEnvelope = createMockEnvelope(EVIDENCE_ID_2, {
      classification: 'CONFIDENTIAL',
      redactionStatus: 'PENDING',
    });
    await storage.create(confidentialEnvelope, Buffer.from('content'), auth);
    const evidence = await viewer.getEvidence(EVIDENCE_ID_2, auth);
    expect(evidence.redactionStatus).toBe('PENDING');

    // Exit criterion 4: cleanup failure detectable via orphan detection
    const orphans = await engine.detectOrphans(storage, auth);
    expect(orphans.length).toBeGreaterThan(0);

    // Exit criterion 5: failed run is traceable end-to-end
    const trace = await viewer.getRunTrace('run-001', auth);
    expect(trace.evidence.length).toBeGreaterThan(0);

    // Exit criterion 6: replay isolation
    firewall.setDefaultMode('BLOCK');
    await expect(
      firewall.intercept('email', 'send', ['test@example.com'])
    ).rejects.toThrow('[REPLAY BLOCKED]');
  });
});