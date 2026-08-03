/**
 * NeureCore Harness - Retention Module
 *
 * This module implements retention policy enforcement per ADR-002 + §7.3:
 * - Retention classes with defined durations
 * - Archive and expiry enforcement
 * - Legal hold support
 * - Tenant offboarding coordination (§7.3)
 * - Actual cleanup execution + orphan alerts (§5.2)
 * - Retention audit trail
 *
 * Document ID: NC-HARNESS-RETENTION-001
 * Version: 2.0
 * Status: PHASE_2_IMPLEMENTED
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';
import type {
  RetentionClass,
  AuthorizationContext,
} from '../contracts';
import {
  RetentionClassSchema,
  AuthorizationContextSchema,
  hasPermission,
} from '../contracts';
import type { IEvidenceStorageAdapter, EvidenceFilter } from '../storage';

// ============================================================
// RETENTION POLICY (per ADR-002 §2.2)
// ============================================================

export const RetentionPolicySchema = z.object({
  policyId: z.string().min(1),
  name: z.string().min(1),
  retentionClass: RetentionClassSchema,
  retentionDays: z.number().int().positive(),
  archiveEnabled: z.boolean(),
  archiveAfterDays: z.number().int().nonnegative().optional(),
  legalHoldEnabled: z.boolean(),
  autoDeleteEnabled: z.boolean(),
});
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;

export const RETENTION_DURATIONS: Record<RetentionClass, number> = {
  SHORT_TERM: 14,
  MEDIUM_TERM: 90,
  LONG_TERM: 365,
  PERMANENT: 2555, // 7 years
};

export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    policyId: 'policy-short-term',
    name: 'Short-Term Retention',
    retentionClass: 'SHORT_TERM',
    retentionDays: RETENTION_DURATIONS.SHORT_TERM,
    archiveEnabled: false,
    legalHoldEnabled: false,
    autoDeleteEnabled: true,
  },
  {
    policyId: 'policy-medium-term',
    name: 'Medium-Term Retention',
    retentionClass: 'MEDIUM_TERM',
    retentionDays: RETENTION_DURATIONS.MEDIUM_TERM,
    archiveEnabled: true,
    archiveAfterDays: 30,
    legalHoldEnabled: false,
    autoDeleteEnabled: true,
  },
  {
    policyId: 'policy-long-term',
    name: 'Long-Term Retention',
    retentionClass: 'LONG_TERM',
    retentionDays: RETENTION_DURATIONS.LONG_TERM,
    archiveEnabled: true,
    archiveAfterDays: 90,
    legalHoldEnabled: false,
    autoDeleteEnabled: true,
  },
  {
    policyId: 'policy-permanent',
    name: 'Permanent Retention',
    retentionClass: 'PERMANENT',
    retentionDays: RETENTION_DURATIONS.PERMANENT,
    archiveEnabled: true,
    archiveAfterDays: 365,
    legalHoldEnabled: true,
    autoDeleteEnabled: false,
  },
];

// ============================================================
// LEGAL HOLD
// ============================================================

export const LegalHoldStatusSchema = z.enum(['ACTIVE', 'RELEASED']);
export type LegalHoldStatus = z.infer<typeof LegalHoldStatusSchema>;

export const LegalHoldSchema = z.object({
  holdId: z.string().min(1),
  evidenceId: z.string().min(1),
  reason: z.string().min(1),
  heldBy: z.string().min(1),
  heldAt: z.string().datetime(),
  releasedAt: z.string().datetime().nullable(),
  status: LegalHoldStatusSchema,
});
export type LegalHold = z.infer<typeof LegalHoldSchema>;

// ============================================================
// RETENTION AUDIT
// ============================================================

export const RetentionActionSchema = z.enum([
  'CREATED',
  'ARCHIVED',
  'EXPIRED',
  'LEGAL_HOLD_APPLIED',
  'LEGAL_HOLD_RELEASED',
  'DELETED',
  'ACCESSED',
  'CLEANUP_FAILED',
  'ORPHAN_DETECTED',
  'TENANT_OFFBOARDED',
]);
export type RetentionAction = z.infer<typeof RetentionActionSchema>;

export const RetentionAuditEntrySchema = z.object({
  auditId: z.string().min(1),
  evidenceId: z.string().min(1),
  action: RetentionActionSchema,
  performedBy: z.string().min(1),
  performedAt: z.string().datetime(),
  details: z.record(z.unknown(), z.unknown()).optional(),
});
export type RetentionAuditEntry = z.infer<typeof RetentionAuditEntrySchema>;

// ============================================================
// RETENTION STATUS
// ============================================================

export const RetentionStatusSchema = z.enum([
  'ACTIVE',
  'ARCHIVED',
  'EXPIRED',
  'LEGAL_HOLD',
  'DELETED',
]);
export type RetentionStatus = z.infer<typeof RetentionStatusSchema>;

export interface EvidenceRetentionStatus {
  evidenceId: string;
  status: RetentionStatus;
  retentionClass: RetentionClass;
  createdAt: string;
  expiresAt: string | null;
  archivedAt: string | null;
  legalHold: LegalHold | null;
  daysUntilExpiry: number | null;
  daysUntilArchive: number | null;
}

// ============================================================
// ORPHAN DETECTION & ALERTS (§5.2)
// ============================================================

export const OrphanAlertSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type OrphanAlertSeverity = z.infer<typeof OrphanAlertSeveritySchema>;

export const OrphanAlertSchema = z.object({
  alertId: z.string().min(1),
  evidenceId: z.string().min(1),
  severity: OrphanAlertSeveritySchema,
  reason: z.string().min(1),
  detectedAt: z.string().datetime(),
  context: z.record(z.unknown(), z.unknown()).optional(),
});
export type OrphanAlert = z.infer<typeof OrphanAlertSchema>;

// ============================================================
// CLEANUP RESULT (§5.2)
// ============================================================

export interface CleanupResult {
  runId?: string;
  executedAt: string;
  executedBy: string;
  totalInspected: number;
  totalArchived: number;
  totalDeleted: number;
  totalLegalHoldProtected: number;
  totalCleanupFailed: number;
  totalOrphansDetected: number;
  errors: Array<{ evidenceId: string; error: string }>;
}

// ============================================================
// RETENTION ENGINE
// ============================================================

export interface RetentionEngineConfig {
  policies: RetentionPolicy[];
  checkIntervalMs: number;
  archiveOnExpiry: boolean;
  deleteOnExpiry: boolean;
}

const DEFAULT_CONFIG: RetentionEngineConfig = {
  policies: DEFAULT_RETENTION_POLICIES,
  checkIntervalMs: 24 * 60 * 60 * 1000, // Daily
  archiveOnExpiry: true,
  deleteOnExpiry: false,
};

export class RetentionEngine {
  private readonly config: RetentionEngineConfig;
  private readonly legalHolds = new Map<string, LegalHold>();
  private readonly auditLog: RetentionAuditEntry[] = [];
  private readonly orphanAlerts: OrphanAlert[] = [];
  private readonly alertsHandler: ((alert: OrphanAlert) => void) | null = null;

  constructor(
    config: Partial<RetentionEngineConfig> = {},
    onAlert?: (alert: OrphanAlert) => void,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.alertsHandler = onAlert ?? null;
  }

  getPolicyForRetentionClass(retentionClass: RetentionClass): RetentionPolicy {
    const policy = this.config.policies.find(p => p.retentionClass === retentionClass);
    if (!policy) {
      throw new Error(`No policy found for retention class: ${retentionClass}`);
    }
    return policy;
  }

  getRetentionStatus(
    evidenceId: string,
    retentionClass: RetentionClass,
    createdAt: string,
  ): EvidenceRetentionStatus {
    const policy = this.getPolicyForRetentionClass(retentionClass);
    const created = new Date(createdAt);
    const now = new Date();

    const expiresAt = new Date(created);
    expiresAt.setDate(expiresAt.getDate() + policy.retentionDays);

    let archivedAt: string | null = null;
    let daysUntilArchive: number | null = null;

    if (policy.archiveEnabled && policy.archiveAfterDays) {
      const archiveAt = new Date(created);
      archiveAt.setDate(archiveAt.getDate() + policy.archiveAfterDays);
      if (now >= archiveAt) {
        archivedAt = archiveAt.toISOString();
      } else {
        daysUntilArchive = Math.ceil((archiveAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const legalHold = this.legalHolds.get(evidenceId) ?? null;
    const isOnHold = legalHold?.status === 'ACTIVE';

    let status: RetentionStatus;
    if (isOnHold) {
      status = 'LEGAL_HOLD';
    } else if (archivedAt) {
      status = 'ARCHIVED';
    } else if (expiresAt < now) {
      status = 'EXPIRED';
    } else {
      status = 'ACTIVE';
    }

    const daysUntilExpiry = isOnHold ? null :
      Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      evidenceId,
      status,
      retentionClass,
      createdAt,
      expiresAt: expiresAt.toISOString(),
      archivedAt,
      legalHold,
      daysUntilExpiry,
      daysUntilArchive,
    };
  }

  shouldArchive(
    evidenceId: string,
    retentionClass: RetentionClass,
    createdAt: string,
  ): boolean {
    const status = this.getRetentionStatus(evidenceId, retentionClass, createdAt);
    return status.status === 'ARCHIVED';
  }

  shouldExpire(
    evidenceId: string,
    retentionClass: RetentionClass,
    createdAt: string,
  ): boolean {
    const status = this.getRetentionStatus(evidenceId, retentionClass, createdAt);
    return status.status === 'EXPIRED';
  }

  shouldDelete(
    evidenceId: string,
    retentionClass: RetentionClass,
    createdAt: string,
  ): boolean {
    if (!this.config.deleteOnExpiry) return false;
    return this.shouldExpire(evidenceId, retentionClass, createdAt);
  }

  applyLegalHold(
    evidenceId: string,
    reason: string,
    heldBy: string,
    auth?: AuthorizationContext,
  ): LegalHold {
    if (auth) {
      AuthorizationContextSchema.parse(auth);
      if (!hasPermission(auth, 'evidence:retain:legal-hold')) {
        throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission evidence:retain:legal-hold`);
      }
    }

    const existing = this.legalHolds.get(evidenceId);
    if (existing?.status === 'ACTIVE') {
      throw new Error(`Evidence ${evidenceId} is already on legal hold`);
    }

    const hold: LegalHold = {
      holdId: randomUUID(),
      evidenceId,
      reason,
      heldBy,
      heldAt: new Date().toISOString(),
      releasedAt: null,
      status: 'ACTIVE',
    };

    this.legalHolds.set(evidenceId, hold);
    this.logAudit(evidenceId, 'LEGAL_HOLD_APPLIED', heldBy, { holdId: hold.holdId, reason });

    return hold;
  }

  releaseLegalHold(
    evidenceId: string,
    releasedBy: string,
    auth?: AuthorizationContext,
  ): LegalHold {
    if (auth) {
      AuthorizationContextSchema.parse(auth);
      if (!hasPermission(auth, 'evidence:retain:release')) {
        throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission evidence:retain:release`);
      }
    }

    const hold = this.legalHolds.get(evidenceId);
    if (!hold || hold.status !== 'ACTIVE') {
      throw new Error(`No active legal hold found for evidence: ${evidenceId}`);
    }

    hold.status = 'RELEASED';
    hold.releasedAt = new Date().toISOString();

    this.logAudit(evidenceId, 'LEGAL_HOLD_RELEASED', releasedBy, { holdId: hold.holdId });

    return hold;
  }

  isOnLegalHold(evidenceId: string): boolean {
    const hold = this.legalHolds.get(evidenceId);
    return hold?.status === 'ACTIVE';
  }

  getLegalHold(evidenceId: string): LegalHold | null {
    return this.legalHolds.get(evidenceId) ?? null;
  }

  getAuditLog(evidenceId?: string): RetentionAuditEntry[] {
    if (evidenceId) {
      return this.auditLog.filter(entry => entry.evidenceId === evidenceId);
    }
    return [...this.auditLog];
  }

  getOrphanAlerts(): OrphanAlert[] {
    return [...this.orphanAlerts];
  }

  /**
   * §5.2: "Cleanup failure is a run failure and triggers an orphan-resource alert"
   * Detects orphaned evidence (e.g., evidence without an envelope, or where the
   * envelope cannot be loaded after the content was partially cleaned up).
   */
  async detectOrphans(
    storage: IEvidenceStorageAdapter,
    auth: AuthorizationContext,
  ): Promise<OrphanAlert[]> {
    AuthorizationContextSchema.parse(auth);
    if (!hasPermission(auth, 'retention:admin')) {
      throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission retention:admin`);
    }

    const detected: OrphanAlert[] = [];
    const allEvidence = await storage.list({}, auth);

    for (const envelope of allEvidence) {
      try {
        const verification = await storage.verify(envelope.evidenceId);
        if (!verification.valid) {
          const alert: OrphanAlert = {
            alertId: randomUUID(),
            evidenceId: envelope.evidenceId,
            severity: 'HIGH',
            reason: `Evidence verification failed: ${verification.reason}`,
            detectedAt: new Date().toISOString(),
            context: {
              runId: envelope.runId,
              tenantId: envelope.tenantId,
              classification: envelope.classification,
              verificationReason: verification.reason,
            },
          };
          detected.push(alert);
          this.orphanAlerts.push(alert);
          this.logAudit(envelope.evidenceId, 'ORPHAN_DETECTED', auth.actorId, {
            severity: alert.severity,
            reason: alert.reason,
          });
          if (this.alertsHandler) this.alertsHandler(alert);
        }
      } catch (error) {
        const alert: OrphanAlert = {
          alertId: randomUUID(),
          evidenceId: envelope.evidenceId,
          severity: 'CRITICAL',
          reason: `Verification threw: ${String(error)}`,
          detectedAt: new Date().toISOString(),
        };
        detected.push(alert);
        this.orphanAlerts.push(alert);
        this.logAudit(envelope.evidenceId, 'ORPHAN_DETECTED', auth.actorId, {
          severity: alert.severity,
          reason: alert.reason,
        });
        if (this.alertsHandler) this.alertsHandler(alert);
      }
    }

    return detected;
  }

  /**
   * §5.2: "Cleanup failure is a run failure"
   * §7.3: "Test erasure, retention expiry"
   * Executes retention cleanup: archives + deletes expired evidence,
   * respects legal hold, logs all actions, raises orphan alerts on failure.
   */
  async executeCleanup(
    storage: IEvidenceStorageAdapter,
    auth: AuthorizationContext,
  ): Promise<CleanupResult> {
    AuthorizationContextSchema.parse(auth);
    if (!hasPermission(auth, 'retention:admin')) {
      throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission retention:admin`);
    }

    const result: CleanupResult = {
      executedAt: new Date().toISOString(),
      executedBy: auth.actorId,
      totalInspected: 0,
      totalArchived: 0,
      totalDeleted: 0,
      totalLegalHoldProtected: 0,
      totalCleanupFailed: 0,
      totalOrphansDetected: 0,
      errors: [],
    };

    const allEvidence = await storage.list({}, auth);
    result.totalInspected = allEvidence.length;

    const orphans = await this.detectOrphans(storage, auth);
    result.totalOrphansDetected = orphans.length;

    for (const envelope of allEvidence) {
      try {
        const status = this.getRetentionStatus(envelope.evidenceId, envelope.retentionClass, envelope.timestamp);

        if (status.status === 'LEGAL_HOLD') {
          result.totalLegalHoldProtected++;
          continue;
        }

        if (status.status === 'ARCHIVED') {
          result.totalArchived++;
          this.logAudit(envelope.evidenceId, 'ARCHIVED', auth.actorId, {
            retentionClass: envelope.retentionClass,
            policy: this.getPolicyForRetentionClass(envelope.retentionClass).policyId,
          });
          continue;
        }

        if (status.status === 'EXPIRED') {
          const policy = this.getPolicyForRetentionClass(envelope.retentionClass);
          if (policy.autoDeleteEnabled && this.config.deleteOnExpiry) {
            await storage.erase(envelope.evidenceId, 'retention expired', auth);
            result.totalDeleted++;
            this.logAudit(envelope.evidenceId, 'DELETED', auth.actorId, {
              retentionClass: envelope.retentionClass,
            });
          } else {
            result.totalArchived++;
            this.logAudit(envelope.evidenceId, 'ARCHIVED', auth.actorId, {
              retentionClass: envelope.retentionClass,
              autoArchive: true,
            });
          }
        }
      } catch (error) {
        result.totalCleanupFailed++;
        result.errors.push({
          evidenceId: envelope.evidenceId,
          error: String(error),
        });
        this.logAudit(envelope.evidenceId, 'CLEANUP_FAILED', auth.actorId, {
          error: String(error),
        });

        // §5.2: cleanup failure triggers orphan alert
        const alert: OrphanAlert = {
          alertId: randomUUID(),
          evidenceId: envelope.evidenceId,
          severity: 'CRITICAL',
          reason: `Cleanup failed: ${String(error)}`,
          detectedAt: new Date().toISOString(),
        };
        this.orphanAlerts.push(alert);
        if (this.alertsHandler) this.alertsHandler(alert);
      }
    }

    return result;
  }

  /**
   * §7.3: tenant offboarding
   */
  async tenantOffboarding(
    storage: IEvidenceStorageAdapter,
    tenantId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<{
    offboardingResult: Awaited<ReturnType<typeof storage.tenantOffboarding>>;
    cleanupResult: CleanupResult;
  }> {
    AuthorizationContextSchema.parse(auth);
    if (!hasPermission(auth, 'evidence:erase')) {
      throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission evidence:erase`);
    }

    const offboardingResult = await storage.tenantOffboarding(tenantId, reason, auth);
    this.logAudit(`tenant:${tenantId}`, 'TENANT_OFFBOARDED', auth.actorId, {
      tenantId,
      reason,
      erased: offboardingResult.totalErased,
      legalHoldProtected: offboardingResult.totalLegalHoldProtected,
    });

    const cleanupResult = await this.executeCleanup(storage, auth);

    return { offboardingResult, cleanupResult };
  }

  private logAudit(
    evidenceId: string,
    action: RetentionAction,
    performedBy: string,
    details?: Record<string, unknown>,
  ): void {
    const entry: RetentionAuditEntry = {
      auditId: randomUUID(),
      evidenceId,
      action,
      performedBy,
      performedAt: new Date().toISOString(),
      details,
    };
    this.auditLog.push(entry);
  }

  getRetentionDays(retentionClass: RetentionClass): number {
    return RETENTION_DURATIONS[retentionClass];
  }

  getExpiryDate(retentionClass: RetentionClass, createdAt: string): Date {
    const days = this.getRetentionDays(retentionClass);
    const expiry = new Date(createdAt);
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }
}

// ============================================================
// RETENTION QUERY ENGINE
// ============================================================

export interface ExpiredEvidenceQuery {
  asOfDate?: string;
  retentionClasses?: RetentionClass[];
  excludeLegalHold?: boolean;
}

export class RetentionQueryEngine {
  constructor(private readonly retentionEngine: RetentionEngine) {}

  findExpiredEvidence(
    evidenceRecords: Array<{ evidenceId: string; retentionClass: RetentionClass; createdAt: string }>,
    query: ExpiredEvidenceQuery = {},
  ): string[] {
    return evidenceRecords
      .filter(record => {
        if (query.retentionClasses && !query.retentionClasses.includes(record.retentionClass)) {
          return false;
        }

        if (query.excludeLegalHold !== false && this.retentionEngine.isOnLegalHold(record.evidenceId)) {
          return false;
        }

        const status = this.retentionEngine.getRetentionStatus(
          record.evidenceId,
          record.retentionClass,
          record.createdAt
        );

        return status.status === 'EXPIRED';
      })
      .map(record => record.evidenceId);
  }

  findEvidenceForArchive(
    evidenceRecords: Array<{ evidenceId: string; retentionClass: RetentionClass; createdAt: string }>,
    query: ExpiredEvidenceQuery = {},
  ): string[] {
    return evidenceRecords
      .filter(record => {
        if (query.retentionClasses && !query.retentionClasses.includes(record.retentionClass)) {
          return false;
        }

        if (query.excludeLegalHold !== false && this.retentionEngine.isOnLegalHold(record.evidenceId)) {
          return false;
        }

        const policy = this.retentionEngine.getPolicyForRetentionClass(record.retentionClass);
        if (!policy.archiveEnabled) return false;

        const status = this.retentionEngine.getRetentionStatus(
          record.evidenceId,
          record.retentionClass,
          record.createdAt
        );

        return status.status === 'ARCHIVED';
      })
      .map(record => record.evidenceId);
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const RETENTION_VERSION = '2.0.0';