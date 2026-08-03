/**
 * NeureCore Harness - Evidence Viewer Module
 *
 * This module implements the evidence viewer API per Phase 2 + §7.3:
 * - Read-only evidence access
 * - Tenant scoping enforced (§5.2)
 * - Authorization enforcement (§5.2)
 * - Full trace viewing with correlation
 * - Tamper detection display
 * - Redaction applied on display (§7.3)
 *
 * Document ID: NC-HARNESS-VIEWER-001
 * Version: 2.0
 * Status: PHASE_2_IMPLEMENTED
 */

import type {
  EvidenceEnvelope,
  RunOutcome,
  AuthorizationContext,
} from '../contracts';
import {
  EvidenceClassificationSchema,
  RetentionClassSchema,
  AuthorizationContextSchema,
  hasPermission,
} from '../contracts';
import type {
  IEvidenceStorageAdapter,
  EvidenceFilter,
  EvidenceVerificationResult,
  EvidenceAccessLog,
  EvidenceAnnotation,
} from '../storage';
import type { RetentionEngine, RetentionStatus } from '../retention';
import { sanitizeWithAttestation } from '../redaction';

// ============================================================
// VIEW MODELS (read-only, no raw evidence content exposed)
// ============================================================

export interface EvidenceView {
  evidenceId: string;
  runId: string;
  scenarioId: string;
  capabilityId: string;
  tenantId: string;
  timestamp: string;
  producer: string;
  mediaType: string;
  classification: string;
  checksum: string;
  storageRef: string;
  retentionClass: string;
  redactionStatus: string;
  correlationIds: string[];
  integrityStatus: 'VALID' | 'INVALID' | 'UNKNOWN';
  retentionStatus: RetentionStatus;
  daysUntilExpiry: number | null;
}

export interface RunTraceView {
  runId: string;
  scenarioId: string;
  capabilityIds: string[];
  tenantId: string;
  outcome: RunOutcome;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  evidenceCount: number;
  evidence: EvidenceView[];
  hasIntegrityIssues: boolean;
  hasCleanupIssues: boolean;
  hasRedactionIssues: boolean;
}

export interface TenantEvidenceView {
  tenantId: string;
  totalEvidence: number;
  byClassification: Record<string, number>;
  byRetentionClass: Record<string, number>;
  expiredCount: number;
  archivedCount: number;
  legalHoldCount: number;
  evidence: EvidenceView[];
}

export interface ViewerStats {
  totalEvidenceCount: number;
  totalSizeBytes: number;
  byClassification: Record<string, number>;
  byRetentionClass: Record<string, number>;
  integrityIssues: number;
  expiredEvidence: number;
  archivedEvidence: number;
  legalHoldEvidence: number;
}

// ============================================================
// EVIDENCE VIEWER
// ============================================================

export interface EvidenceViewerConfig {
  maxEvidencePerPage?: number;
  enableIntegrityCheck?: boolean;
  enableRetentionCheck?: boolean;
}

const DEFAULT_VIEWER_CONFIG: EvidenceViewerConfig = {
  maxEvidencePerPage: 100,
  enableIntegrityCheck: true,
  enableRetentionCheck: true,
};

function enforceAuth(auth: AuthorizationContext, permission: 'evidence:read' | 'retention:admin'): void {
  AuthorizationContextSchema.parse(auth);
  if (!hasPermission(auth, permission)) {
    throw new Error(`Authorization denied: actor ${auth.actorId} lacks permission ${permission}`);
  }
}

export class EvidenceViewer {
  private readonly storage: IEvidenceStorageAdapter;
  private readonly retentionEngine: RetentionEngine | null;
  private readonly config: EvidenceViewerConfig;

  constructor(
    storage: IEvidenceStorageAdapter,
    retentionEngine?: RetentionEngine,
    config: Partial<EvidenceViewerConfig> = {},
  ) {
    this.storage = storage;
    this.retentionEngine = retentionEngine ?? null;
    this.config = { ...DEFAULT_VIEWER_CONFIG, ...config };
  }

  async getEvidence(
    evidenceId: string,
    auth: AuthorizationContext,
    checkIntegrity = true,
  ): Promise<EvidenceView> {
    // Use storage.read which enforces tenant scoping + authorization
    const { envelope } = await this.storage.read(evidenceId, auth);

    let integrityStatus: 'VALID' | 'INVALID' | 'UNKNOWN' = 'UNKNOWN';
    if (checkIntegrity && this.config.enableIntegrityCheck) {
      const result = await this.storage.verify(evidenceId);
      integrityStatus = result.valid ? 'VALID' : 'INVALID';
    }

    let retentionStatus: RetentionStatus = 'ACTIVE';
    let daysUntilExpiry: number | null = null;

    if (this.retentionEngine && this.config.enableRetentionCheck) {
      const status = this.retentionEngine.getRetentionStatus(
        evidenceId,
        envelope.retentionClass,
        envelope.timestamp
      );
      retentionStatus = status.status;
      daysUntilExpiry = status.daysUntilExpiry;
    }

    return this.mapToEvidenceView(envelope, integrityStatus, retentionStatus, daysUntilExpiry);
  }

  /**
   * §7.3: "Apply field-level redaction ... again before UI display/export"
   */
  async getRedactedContent(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; redactedContent: unknown }> {
    const { redactedContent } = await this.storage.readRedacted(evidenceId, auth);

    let parsed: unknown;
    try {
      parsed = JSON.parse(redactedContent.toString('utf-8'));
    } catch {
      parsed = redactedContent.toString('utf-8');
    }

    // §7.3: apply redaction AGAIN before UI display
    const result = sanitizeWithAttestation(parsed);
    return {
      envelope: (await this.storage.read(evidenceId, auth)).envelope,
      redactedContent: result.sanitized,
    };
  }

  async listEvidence(
    filter: EvidenceFilter,
    auth: AuthorizationContext,
    page = 1,
  ): Promise<{ evidence: EvidenceView[]; total: number; page: number; pageSize: number }> {
    // Use storage.list which enforces tenant scoping + authorization
    const allEvidence = await this.storage.list(filter, auth);
    const pageSize = this.config.maxEvidencePerPage ?? 100;

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paged = allEvidence.slice(start, end);

    const evidenceViews: EvidenceView[] = [];
    for (const envelope of paged) {
      const view = await this.getEvidence(envelope.evidenceId, auth, false);
      evidenceViews.push(view);
    }

    return {
      evidence: evidenceViews,
      total: allEvidence.length,
      page,
      pageSize,
    };
  }

  async getRunTrace(
    runId: string,
    auth: AuthorizationContext,
  ): Promise<RunTraceView> {
    enforceAuth(auth, 'evidence:read');

    // Use storage.list which enforces tenant scoping + authorization
    const evidence = await this.storage.list({ runId }, auth);

    const evidenceViews: EvidenceView[] = [];
    let hasIntegrityIssues = false;
    let hasCleanupIssues = false;
    let hasRedactionIssues = false;

    for (const envelope of evidence) {
      const view = await this.getEvidence(envelope.evidenceId, auth);
      evidenceViews.push(view);

      if (view.integrityStatus === 'INVALID') hasIntegrityIssues = true;
      if (view.redactionStatus !== 'APPLIED' && view.redactionStatus !== 'NOT_REQUIRED') {
        hasRedactionIssues = true;
      }
    }

    let startedAt = '';
    let completedAt: string | null = null;
    let durationMs: number | null = null;
    let outcome: RunOutcome = 'UNKNOWN';
    let capabilityIds: string[] = [];
    let tenantId = '';

    if (evidenceViews.length > 0) {
      startedAt = evidenceViews[0].timestamp;
      tenantId = evidenceViews[0].tenantId;
      capabilityIds = [...new Set(evidenceViews.map(e => e.capabilityId))];
    }

    return {
      runId,
      scenarioId: evidenceViews[0]?.scenarioId ?? '',
      capabilityIds,
      tenantId,
      outcome,
      startedAt,
      completedAt,
      durationMs,
      evidenceCount: evidenceViews.length,
      evidence: evidenceViews,
      hasIntegrityIssues,
      hasCleanupIssues,
      hasRedactionIssues,
    };
  }

  async getTenantEvidence(
    tenantId: string,
    auth: AuthorizationContext,
    page = 1,
  ): Promise<TenantEvidenceView> {
    enforceAuth(auth, 'evidence:read');

    // §5.2: tenant scoping
    if (tenantId !== auth.tenantId && !auth.isSuperAdmin) {
      throw new Error(`Authorization denied: actor ${auth.actorId} cannot view tenant ${tenantId}`);
    }

    const evidence = await this.storage.list({ tenantId }, auth);

    const byClassification: Record<string, number> = {};
    const byRetentionClass: Record<string, number> = {};
    let expiredCount = 0;
    let archivedCount = 0;
    let legalHoldCount = 0;

    const evidenceViews: EvidenceView[] = [];

    for (const envelope of evidence) {
      const view = await this.getEvidence(envelope.evidenceId, auth, false);
      evidenceViews.push(view);

      byClassification[envelope.classification] = (byClassification[envelope.classification] ?? 0) + 1;
      byRetentionClass[envelope.retentionClass] = (byRetentionClass[envelope.retentionClass] ?? 0) + 1;

      if (this.retentionEngine) {
        const status = this.retentionEngine.getRetentionStatus(
          envelope.evidenceId,
          envelope.retentionClass,
          envelope.timestamp
        );
        if (status.status === 'EXPIRED') expiredCount++;
        if (status.status === 'ARCHIVED') archivedCount++;
        if (status.status === 'LEGAL_HOLD') legalHoldCount++;
      }
    }

    const pageSize = this.config.maxEvidencePerPage ?? 100;
    const start = (page - 1) * pageSize;
    const paged = evidenceViews.slice(start, start + pageSize);

    return {
      tenantId,
      totalEvidence: evidence.length,
      byClassification,
      byRetentionClass,
      expiredCount,
      archivedCount,
      legalHoldCount,
      evidence: paged,
    };
  }

  async verifyEvidence(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<EvidenceVerificationResult> {
    enforceAuth(auth, 'evidence:read');
    return this.storage.verify(evidenceId);
  }

  async getEvidenceAnnotations(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<EvidenceAnnotation[]> {
    enforceAuth(auth, 'evidence:read');
    return this.storage.getAnnotations(evidenceId);
  }

  async getEvidenceAccessLog(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<EvidenceAccessLog[]> {
    enforceAuth(auth, 'evidence:read');
    return this.storage.getAccessLog(evidenceId);
  }

  async getStats(auth: AuthorizationContext): Promise<ViewerStats> {
    enforceAuth(auth, 'retention:admin');

    const storageStats = this.storage.getStats();

    let expiredEvidence = 0;
    let archivedEvidence = 0;
    let legalHoldEvidence = 0;
    let integrityIssues = 0;

    if (this.retentionEngine) {
      const allEvidence = await this.storage.list({}, auth);
      for (const envelope of allEvidence) {
        const status = this.retentionEngine.getRetentionStatus(
          envelope.evidenceId,
          envelope.retentionClass,
          envelope.timestamp
        );
        if (status.status === 'EXPIRED') expiredEvidence++;
        if (status.status === 'ARCHIVED') archivedEvidence++;
        if (status.status === 'LEGAL_HOLD') legalHoldEvidence++;
      }
    }

    const integrityChecks = await Promise.all(
      (await this.storage.list({}, auth)).slice(0, 1000).map(e =>
        this.storage.verify(e.evidenceId)
      )
    );
    integrityIssues = integrityChecks.filter(r => !r.valid).length;

    return {
      totalEvidenceCount: storageStats.totalEvidenceCount,
      totalSizeBytes: storageStats.totalSizeBytes,
      byClassification: storageStats.byClassification,
      byRetentionClass: storageStats.byRetentionClass,
      integrityIssues,
      expiredEvidence,
      archivedEvidence,
      legalHoldEvidence,
    };
  }

  private mapToEvidenceView(
    envelope: EvidenceEnvelope,
    integrityStatus: 'VALID' | 'INVALID' | 'UNKNOWN',
    retentionStatus: RetentionStatus,
    daysUntilExpiry: number | null,
  ): EvidenceView {
    return {
      evidenceId: envelope.evidenceId,
      runId: envelope.runId,
      scenarioId: envelope.scenarioId,
      capabilityId: envelope.capabilityId,
      tenantId: envelope.tenantId,
      timestamp: envelope.timestamp,
      producer: envelope.producer,
      mediaType: envelope.mediaType,
      classification: envelope.classification,
      checksum: envelope.checksum,
      storageRef: envelope.storageRef,
      retentionClass: envelope.retentionClass,
      redactionStatus: envelope.redactionStatus,
      correlationIds: envelope.correlationIds,
      integrityStatus,
      retentionStatus,
      daysUntilExpiry,
    };
  }
}

// ============================================================
// CORRELATION VIEWER
// ============================================================

export interface CorrelationNode {
  id: string;
  type: 'run' | 'evidence' | 'event';
  timestamp: string;
  parentId?: string;
  details: Record<string, unknown>;
}

export interface CorrelationChain {
  rootCorrelationId: string;
  tenantId: string;
  nodes: CorrelationNode[];
}

export class CorrelationViewer {
  constructor(private readonly storage: IEvidenceStorageAdapter) {}

  async getCorrelationChain(
    correlationId: string,
    auth: AuthorizationContext,
  ): Promise<CorrelationChain | null> {
    enforceAuth(auth, 'evidence:read');

    const allEvidence = await this.storage.list({}, auth);
    const matchingEvidence = allEvidence.filter(e =>
      e.correlationIds.includes(correlationId)
    );

    if (matchingEvidence.length === 0) {
      return null;
    }

    const nodes: CorrelationNode[] = [];

    for (const evidence of matchingEvidence) {
      nodes.push({
        id: evidence.evidenceId,
        type: 'evidence',
        timestamp: evidence.timestamp,
        details: {
          runId: evidence.runId,
          scenarioId: evidence.scenarioId,
          capabilityId: evidence.capabilityId,
          producer: evidence.producer,
        },
      });
    }

    const tenantId = matchingEvidence[0]?.tenantId ?? '';

    return {
      rootCorrelationId: correlationId,
      tenantId,
      nodes,
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const VIEWER_VERSION = '2.0.0';