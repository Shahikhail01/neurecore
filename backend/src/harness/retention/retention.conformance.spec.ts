/**
 * Harness Retention - Conformance Tests
 * Phase 2 v2.0: Verifies retention policy enforcement including
 * cleanup execution, orphan detection, tenant offboarding.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  RetentionEngine,
  RetentionQueryEngine,
  RETENTION_DURATIONS,
  DEFAULT_RETENTION_POLICIES,
} from './index';
import type {
  AuthorizationContext,
  EvidenceEnvelope,
} from '../contracts';
import { InMemoryEvidenceStorageAdapter } from '../storage';

function buildAuth(tenantId: string, permissions: string[] = ['retention:admin', 'evidence:erase', 'evidence:retain:legal-hold', 'evidence:retain:release', 'evidence:read', 'evidence:create', 'evidence:annotate']): AuthorizationContext {
  return {
    actorId: 'admin-001',
    actorType: 'HUMAN',
    actorRoles: ['TENANT_ADMIN'],
    tenantId,
    correlationId: 'corr-001',
    permissions: permissions as AuthorizationContext['permissions'],
  };
}

describe('RetentionEngine (Phase 2 v2.0)', () => {
  let engine: RetentionEngine;

  beforeEach(() => {
    engine = new RetentionEngine();
  });

  describe('getRetentionStatus', () => {
    it('returns ACTIVE for fresh evidence', () => {
      const status = engine.getRetentionStatus(
        'ev-001',
        'MEDIUM_TERM',
        new Date().toISOString()
      );

      expect(status.status).toBe('ACTIVE');
      expect(status.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('returns EXPIRED for evidence past retention', () => {
      const created = new Date();
      created.setDate(created.getDate() - 100);

      const status = engine.getRetentionStatus(
        'ev-001',
        'SHORT_TERM',
        created.toISOString()
      );

      expect(status.status).toBe('EXPIRED');
    });

    it('returns LEGAL_HOLD for held evidence regardless of expiry', () => {
      const created = new Date();
      created.setDate(created.getDate() - 200);

      engine.applyLegalHold('ev-001', 'Investigation', 'admin');

      const status = engine.getRetentionStatus(
        'ev-001',
        'SHORT_TERM',
        created.toISOString()
      );

      expect(status.status).toBe('LEGAL_HOLD');
    });

    it('returns ARCHIVED when past archive threshold', () => {
      const created = new Date();
      created.setDate(created.getDate() - 60);

      const status = engine.getRetentionStatus(
        'ev-001',
        'MEDIUM_TERM',
        created.toISOString()
      );

      expect(status.status).toBe('ARCHIVED');
    });

    it('PERMANENT evidence never expires', () => {
      const created = new Date();
      created.setFullYear(created.getFullYear() - 10);

      const status = engine.getRetentionStatus(
        'ev-001',
        'PERMANENT',
        created.toISOString()
      );

      expect(status.status).not.toBe('EXPIRED');
    });
  });

  describe('applyLegalHold with authorization', () => {
    it('creates legal hold on evidence', () => {
      const hold = engine.applyLegalHold('ev-001', 'Investigation', 'admin');

      expect(hold.evidenceId).toBe('ev-001');
      expect(hold.status).toBe('ACTIVE');
    });

    it('denies applyLegalHold without permission', () => {
      const auth = {
        actorId: 'u',
        actorType: 'HUMAN' as const,
        actorRoles: ['TENANT_USER'] as any,
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: 'c',
        permissions: [] as any,
      };
      expect(() =>
        engine.applyLegalHold('ev-001', 'Investigation', 'admin', auth)
      ).toThrow('lacks permission');
    });

    it('throws when hold already exists', () => {
      engine.applyLegalHold('ev-001', 'Investigation 1', 'admin');

      expect(() =>
        engine.applyLegalHold('ev-001', 'Investigation 2', 'admin')
      ).toThrow('already on legal hold');
    });
  });

  describe('releaseLegalHold', () => {
    it('releases existing legal hold', () => {
      engine.applyLegalHold('ev-001', 'Investigation', 'admin');
      const released = engine.releaseLegalHold('ev-001', 'admin');

      expect(released.status).toBe('RELEASED');
      expect(released.releasedAt).toBeDefined();
    });

    it('denies releaseLegalHold without permission', () => {
      engine.applyLegalHold('ev-001', 'Investigation', 'admin');
      const auth = {
        actorId: 'u',
        actorType: 'HUMAN' as const,
        actorRoles: ['TENANT_USER'] as any,
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: 'c',
        permissions: [] as any,
      };
      expect(() =>
        engine.releaseLegalHold('ev-001', 'admin', auth)
      ).toThrow('lacks permission');
    });
  });

  describe('executeCleanup (§5.2)', () => {
    let storage: InMemoryEvidenceStorageAdapter;
    let alerts: any[];

    beforeEach(async () => {
      storage = new InMemoryEvidenceStorageAdapter();
      alerts = [];
      engine = new RetentionEngine({}, (alert) => alerts.push(alert));
    });

    it('executes cleanup with auth check', async () => {
      const result = await engine.executeCleanup(storage, buildAuth('550e8400-e29b-41d4-a716-446655440000'));
      expect(result.executedBy).toBe('admin-001');
    });

    it('rejects cleanup without retention:admin permission', async () => {
      const auth = {
        actorId: 'u',
        actorType: 'HUMAN' as const,
        actorRoles: ['TENANT_USER'] as any,
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        correlationId: 'c',
        permissions: [] as any,
      };
      await expect(engine.executeCleanup(storage, auth))
        .rejects.toThrow('lacks permission retention:admin');
    });

it('detects orphans and raises alerts', async () => {
      const content = Buffer.from('original');
      const envelope: EvidenceEnvelope = {
        schemaVersion: '1.0.0',
        evidenceId: '550e8400-e29b-41d4-a716-446655440200',
        runId: 'run-001',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        checksum: 'sha256:' + require('crypto').createHash('sha256').update(content).digest('hex'),
        storageRef: 'memory://550e8400-e29b-41d4-a716-446655440200',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'NOT_REQUIRED',
        correlationIds: [],
      };
      await storage.create(envelope, content, buildAuth('550e8400-e29b-41d4-a716-446655440000'));

      // Tamper to create checksum mismatch
      (storage as any).content.set('550e8400-e29b-41d4-a716-446655440200', Buffer.from('tampered'));

      const result = await engine.executeCleanup(storage, buildAuth('550e8400-e29b-41d4-a716-446655440000'));

      expect(result.totalOrphansDetected).toBeGreaterThan(0);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('skips evidence on legal hold', async () => {
      const envelope: EvidenceEnvelope = {
        schemaVersion: '1.0.0',
        evidenceId: '550e8400-e29b-41d4-a716-446655440201',
        runId: 'run-001',
        scenarioId: 'scenario-001',
        capabilityId: 'cap-001',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        timestamp: new Date().toISOString(),
        producer: 'test',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        checksum: `sha256:${'a'.repeat(64)}`,
        storageRef: 'memory://ev-held',
        retentionClass: 'SHORT_TERM',
        redactionStatus: 'NOT_REQUIRED',
        correlationIds: [],
      };
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      envelope.timestamp = oldDate.toISOString();

      await storage.create(envelope, Buffer.from('content'), buildAuth('550e8400-e29b-41d4-a716-446655440000'));
      engine.applyLegalHold('550e8400-e29b-41d4-a716-446655440201', 'Under investigation', 'admin');

      const result = await engine.executeCleanup(storage, buildAuth('550e8400-e29b-41d4-a716-446655440000'));
      expect(result.totalLegalHoldProtected).toBe(1);
    });
  });

  describe('tenantOffboarding (§7.3)', () => {
    let storage: InMemoryEvidenceStorageAdapter;

    beforeEach(() => {
      storage = new InMemoryEvidenceStorageAdapter();
    });

    it('offboards tenant and erases all evidence', async () => {
      await storage.create({
        schemaVersion: '1.0.0',
        evidenceId: '550e8400-e29b-41d4-a716-446655440202',
        runId: 'run-1',
        scenarioId: 's-1',
        capabilityId: 'c-1',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        timestamp: new Date().toISOString(),
        producer: 'p',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        checksum: `sha256:${'a'.repeat(64)}`,
        storageRef: 'memory://ev-1',
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'NOT_REQUIRED',
        correlationIds: [],
      }, Buffer.from('c1'), buildAuth('550e8400-e29b-41d4-a716-446655440001'));

      const { offboardingResult } = await engine.tenantOffboarding(
        storage,
        '550e8400-e29b-41d4-a716-446655440001',
        'GDPR Article 17',
        buildAuth('550e8400-e29b-41d4-a716-446655440001'),
      );

      expect(offboardingResult.totalErased).toBe(1);
    });
  });
});

describe('RETENTION_DURATIONS', () => {
  it('has correct values per ADR-002', () => {
    expect(RETENTION_DURATIONS.SHORT_TERM).toBe(14);
    expect(RETENTION_DURATIONS.MEDIUM_TERM).toBe(90);
    expect(RETENTION_DURATIONS.LONG_TERM).toBe(365);
    expect(RETENTION_DURATIONS.PERMANENT).toBe(2555);
  });
});

describe('DEFAULT_RETENTION_POLICIES', () => {
  it('has policies for all retention classes', () => {
    const classes = DEFAULT_RETENTION_POLICIES.map(p => p.retentionClass);
    expect(classes).toContain('SHORT_TERM');
    expect(classes).toContain('MEDIUM_TERM');
    expect(classes).toContain('LONG_TERM');
    expect(classes).toContain('PERMANENT');
  });

  it('PERMANENT policy has autoDeleteEnabled false', () => {
    const permanent = DEFAULT_RETENTION_POLICIES.find(p => p.retentionClass === 'PERMANENT');
    expect(permanent?.autoDeleteEnabled).toBe(false);
  });

  it('PERMANENT policy has legalHoldEnabled true', () => {
    const permanent = DEFAULT_RETENTION_POLICIES.find(p => p.retentionClass === 'PERMANENT');
    expect(permanent?.legalHoldEnabled).toBe(true);
  });
});

describe('RetentionQueryEngine', () => {
  let engine: RetentionEngine;
  let queryEngine: RetentionQueryEngine;

  beforeEach(() => {
    engine = new RetentionEngine();
    queryEngine = new RetentionQueryEngine(engine);
  });

  it('finds expired evidence', () => {
    const created = new Date();
    created.setDate(created.getDate() - 20);

    const records = [
      { evidenceId: 'ev-001', retentionClass: 'SHORT_TERM' as const, createdAt: created.toISOString() },
    ];

    const expired = queryEngine.findExpiredEvidence(records);
    expect(expired).toContain('ev-001');
  });

  it('excludes evidence on legal hold', () => {
    const created = new Date();
    created.setDate(created.getDate() - 20);

    const records = [
      { evidenceId: 'ev-001', retentionClass: 'SHORT_TERM' as const, createdAt: created.toISOString() },
    ];

    engine.applyLegalHold('ev-001', 'Investigation', 'admin');

    const expired = queryEngine.findExpiredEvidence(records, { excludeLegalHold: true });
    expect(expired).not.toContain('ev-001');
  });
});