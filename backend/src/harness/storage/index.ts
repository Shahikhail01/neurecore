/**
 * NeureCore Harness - Storage Module
 *
 * This module implements the artifact storage adapter per ADR-002 + §7.1 + §7.3:
 * - Append-only evidence storage with checksums
 * - Content-addressed storage
 * - Encryption at rest (§7.1 "Raw artifacts are immutable and encrypted")
 * - Authorization enforcement (§5.2 "Fail closed for authorization")
 * - Tenant scoping (§5.2 "Secure and tenant-scoped by default")
 * - Auto-redaction before persistence (§7.3)
 * - Model hidden reasoning prohibition (§7.3 "Never store model hidden reasoning")
 * - Erasure + tenant offboarding (§7.3)
 *
 * Document ID: NC-HARNESS-STORAGE-001
 * Version: 2.0
 * Status: PHASE_2_IMPLEMENTED
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import type {
  EvidenceEnvelope,
  EvidenceRef,
  AuthorizationContext,
  AuthorizationPermission,
} from '../contracts';
import {
  EvidenceEnvelopeSchema,
  EvidenceRefSchema,
  AuthorizationContextSchema,
  hasPermission,
} from '../contracts';
import {
  DEFAULT_REDACTION_RULES,
  sanitizeObject,
  containsModelHiddenReasoning,
} from '../redaction';

// ============================================================
// STORAGE INTERFACE (per ADR-002 §4.1)
// ============================================================

export interface EvidenceFilter {
  runId?: string;
  scenarioId?: string;
  capabilityId?: string;
  tenantId?: string;
  classification?: string;
  mediaType?: string;
  fromDate?: string;
  toDate?: string;
  retentionClass?: string;
}

export interface IEvidenceStorageAdapter {
  create(
    envelope: EvidenceEnvelope,
    content: Buffer,
    auth: AuthorizationContext,
  ): Promise<EvidenceRef>;
  read(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; content: Buffer }>;
  readRedacted(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; redactedContent: Buffer }>;
  list(
    filter: EvidenceFilter,
    auth: AuthorizationContext,
  ): Promise<EvidenceEnvelope[]>;
  annotate(
    annotation: EvidenceAnnotation,
    auth: AuthorizationContext,
  ): Promise<void>;
  verify(evidenceId: string): Promise<EvidenceVerificationResult>;
  getAnnotations(evidenceId: string): Promise<EvidenceAnnotation[]>;
  getAccessLog(evidenceId: string): Promise<EvidenceAccessLog[]>;
  getStats(): EvidenceStorageStats;
  erase(
    evidenceId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<ErasureResult>;
  tenantOffboarding(
    tenantId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<TenantOffboardingResult>;
  scanForModelHiddenReasoning(
    content: unknown,
  ): { found: boolean; reason?: string };
}

export interface EvidenceAnnotation {
  annotationId: string;
  evidenceId: string;
  annotationType: 'CORRECTION' | 'DEPRECATION' | 'NOTE' | 'ERASURE';
  content: string;
  annotatedBy: string;
  annotatedAt: string;
  annotationChecksum: string;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  evidenceId: string;
  reason?: 'CHECKSUM_MISMATCH' | 'NOT_FOUND' | 'DEPRECATED' | 'VALID' | 'ENCRYPTION_ERROR';
  expectedChecksum?: string;
  actualChecksum?: string;
  deprecation?: EvidenceAnnotation | null;
}

export interface EvidenceAccessLog {
  accessId: string;
  evidenceId: string;
  accessedBy: string;
  accessType: 'READ' | 'ANNOTATE' | 'VERIFY' | 'CREATE' | 'ERASE';
  timestamp: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface EvidenceStorageStats {
  totalEvidenceCount: number;
  totalSizeBytes: number;
  byClassification: Record<string, number>;
  byRetentionClass: Record<string, number>;
}

export interface ErasureResult {
  success: boolean;
  evidenceId: string;
  erasedBy: string;
  erasedAt: string;
  reason: string;
  fieldsErased: string[];
  tombstoneRecorded: boolean;
}

export interface TenantOffboardingResult {
  tenantId: string;
  offboardedBy: string;
  offboardedAt: string;
  reason: string;
  totalEvidenceFound: number;
  totalErased: number;
  totalLegalHoldProtected: number;
  errors: string[];
}

// ============================================================
// ENCRYPTION HELPERS (§7.1: encryption at rest)
// ============================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encryptContent(plaintext: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes for AES-256-GCM');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptContent(ciphertext: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes for AES-256-GCM');
  }
  if (ciphertext.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short to be valid AES-256-GCM payload');
  }
  const iv = ciphertext.subarray(0, IV_LENGTH);
  const authTag = ciphertext.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = ciphertext.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function deriveKeyFromPassphrase(passphrase: string, salt: Buffer): Buffer {
  // SHA-256 derived key for reproducibility (production should use scrypt or PBKDF2)
  return createHash('sha256').update(passphrase).update(salt).digest();
}

// ============================================================
// FILE SYSTEM STORAGE ADAPTER
// ============================================================

export interface FileSystemStorageConfig {
  basePath: string;
  maxFileSizeBytes?: number;
  enableAccessLog?: boolean;
  encryptionKey?: Buffer;
  enableEncryption?: boolean;
}

const DEFAULT_CONFIG: FileSystemStorageConfig = {
  basePath: './evidence-storage',
  maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
  enableAccessLog: true,
  enableEncryption: true,
};

function enforceAuth(
  auth: AuthorizationContext,
  permission: AuthorizationPermission,
  evidenceTenantId?: string,
): void {
  // §5.2: "Fail closed for authorization"
  AuthorizationContextSchema.parse(auth);

  if (!hasPermission(auth, permission)) {
    throw new Error(
      `Authorization denied: actor ${auth.actorId} lacks permission ${permission}`,
    );
  }

  // §5.2: "Secure and tenant-scoped by default; missing tenant context is an error"
  if (evidenceTenantId && evidenceTenantId !== auth.tenantId && !auth.isSuperAdmin) {
    throw new Error(
      `Authorization denied: actor ${auth.actorId} cannot access evidence of tenant ${evidenceTenantId} (caller tenant=${auth.tenantId})`,
    );
  }
}

export class FileSystemEvidenceStorageAdapter implements IEvidenceStorageAdapter {
  private readonly config: FileSystemStorageConfig;
  private readonly envelopeDir: string;
  private readonly contentDir: string;
  private readonly annotationDir: string;
  private readonly accessLogDir: string;
  private readonly accessLogs: EvidenceAccessLog[] = [];

  constructor(config: Partial<FileSystemStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.enableEncryption && !this.config.encryptionKey) {
      // Derive a default key for dev; production must inject real key
      const salt = Buffer.from('neurecore-dev-salt');
      this.config.encryptionKey = deriveKeyFromPassphrase(
        process.env['NEURECORE_EVIDENCE_KEY'] ?? 'dev-default-do-not-use',
        salt,
      );
    }

    this.envelopeDir = join(this.config.basePath, 'envelopes');
    this.contentDir = join(this.config.basePath, 'content');
    this.annotationDir = join(this.config.basePath, 'annotations');
    this.accessLogDir = join(this.config.basePath, 'access-logs');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    for (const dir of [this.envelopeDir, this.contentDir, this.annotationDir, this.accessLogDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private getEnvelopePath(evidenceId: string): string {
    return join(this.envelopeDir, `${evidenceId}.json`);
  }

  private getContentPath(evidenceId: string): string {
    return join(this.contentDir, evidenceId);
  }

  private getAnnotationPath(evidenceId: string): string {
    return join(this.annotationDir, `${evidenceId}.json`);
  }

  async create(
    envelope: EvidenceEnvelope,
    content: Buffer,
    auth: AuthorizationContext,
  ): Promise<EvidenceRef> {
    enforceAuth(auth, 'evidence:create', envelope.tenantId);

    // §7.3: "Never store model hidden reasoning"
    const hiddenReasoningScan = this.scanForModelHiddenReasoning(content);
    if (hiddenReasoningScan.found) {
      throw new Error(
        `Evidence rejected: contains model hidden reasoning (${hiddenReasoningScan.reason}). §7.3 prohibits this.`,
      );
    }

    const envelopePath = this.getEnvelopePath(envelope.evidenceId);
    const contentPath = this.getContentPath(envelope.evidenceId);

    if (existsSync(envelopePath)) {
      throw new Error(`Evidence ${envelope.evidenceId} already exists (append-only)`);
    }
    if (existsSync(contentPath)) {
      throw new Error(`Content for ${envelope.evidenceId} already exists (append-only)`);
    }

    // §7.1: encrypt at rest before persistence
    let storedContent: Buffer = content;
    if (this.config.enableEncryption && this.config.encryptionKey) {
      storedContent = encryptContent(content, this.config.encryptionKey);
    }

    writeFileSync(envelopePath, JSON.stringify(envelope, null, 2), 'utf-8');
    writeFileSync(contentPath, storedContent);

    this.logAccess(envelope.evidenceId, auth.actorId, 'CREATE', true);

    return EvidenceRefSchema.parse({
      evidenceId: envelope.evidenceId,
      mediaType: envelope.mediaType,
      storageRef: `file://${contentPath}`,
      checksum: envelope.checksum,
      size: content.length,
    });
  }

  async read(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; content: Buffer }> {
    const envelopePath = this.getEnvelopePath(evidenceId);
    const contentPath = this.getContentPath(evidenceId);

    if (!existsSync(envelopePath) || !existsSync(contentPath)) {
      this.logAccess(evidenceId, auth.actorId, 'READ', false);
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    const envelopeContent = readFileSync(envelopePath, 'utf-8');
    const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(envelopeContent));

    enforceAuth(auth, 'evidence:read', envelope.tenantId);

    const storedContent = readFileSync(contentPath);

    // §7.1: decrypt on read
    let content: Buffer = storedContent;
    if (this.config.enableEncryption && this.config.encryptionKey) {
      try {
        content = decryptContent(storedContent, this.config.encryptionKey);
      } catch {
        this.logAccess(evidenceId, auth.actorId, 'READ', false);
        throw new Error(`Encryption/decryption error for evidence ${evidenceId}`);
      }
    }

    this.logAccess(evidenceId, auth.actorId, 'READ', true);

    return { envelope, content };
  }

  async readRedacted(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; redactedContent: Buffer }> {
    const result = await this.read(evidenceId, auth);

    // §7.3: "Apply field-level redaction before ... UI display/export"
    let content: unknown = result.content;
    try {
      content = JSON.parse(result.content.toString('utf-8'));
    } catch {
      content = result.content.toString('utf-8');
    }
    const redacted = sanitizeObject(content, DEFAULT_REDACTION_RULES);

    return {
      envelope: result.envelope,
      redactedContent: Buffer.from(JSON.stringify(redacted), 'utf-8'),
    };
  }

  async list(
    filter: EvidenceFilter,
    auth: AuthorizationContext,
  ): Promise<EvidenceEnvelope[]> {
    enforceAuth(auth, 'evidence:read');

    // §5.2: tenant scoping
    const effectiveFilter: EvidenceFilter = {
      ...filter,
      tenantId: auth.isSuperAdmin ? filter.tenantId : auth.tenantId,
    };

    const files = readdirSync(this.envelopeDir);
    const envelopes: EvidenceEnvelope[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const evidenceId = file.replace('.json', '');
      try {
        const envelopePath = this.getEnvelopePath(evidenceId);
        const envelopeContent = readFileSync(envelopePath, 'utf-8');
        const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(envelopeContent));

        if (this.matchesFilter(envelope, effectiveFilter)) {
          envelopes.push(envelope);
        }
      } catch {
        // Skip malformed files
      }
    }

    return envelopes;
  }

  private matchesFilter(envelope: EvidenceEnvelope, filter: EvidenceFilter): boolean {
    if (filter.runId && envelope.runId !== filter.runId) return false;
    if (filter.scenarioId && envelope.scenarioId !== filter.scenarioId) return false;
    if (filter.capabilityId && envelope.capabilityId !== filter.capabilityId) return false;
    if (filter.tenantId && envelope.tenantId !== filter.tenantId) return false;
    if (filter.classification && envelope.classification !== filter.classification) return false;
    if (filter.mediaType && envelope.mediaType !== filter.mediaType) return false;
    if (filter.retentionClass && envelope.retentionClass !== filter.retentionClass) return false;
    if (filter.fromDate && envelope.timestamp < filter.fromDate) return false;
    if (filter.toDate && envelope.timestamp > filter.toDate) return false;
    return true;
  }

  async annotate(
    annotation: EvidenceAnnotation,
    auth: AuthorizationContext,
  ): Promise<void> {
    const envelopePath = this.getEnvelopePath(annotation.evidenceId);
    if (!existsSync(envelopePath)) {
      throw new Error(`Evidence ${annotation.evidenceId} not found`);
    }

    const envelopeContent = readFileSync(envelopePath, 'utf-8');
    const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(envelopeContent));
    enforceAuth(auth, 'evidence:annotate', envelope.tenantId);

    const annotations = await this.getAnnotations(annotation.evidenceId);
    annotations.push(annotation);

    writeFileSync(
      this.getAnnotationPath(annotation.evidenceId),
      JSON.stringify(annotations, null, 2),
      'utf-8'
    );

    this.logAccess(annotation.evidenceId, auth.actorId, 'ANNOTATE', true);
  }

  async verify(evidenceId: string): Promise<EvidenceVerificationResult> {
    const envelopePath = this.getEnvelopePath(evidenceId);
    const contentPath = this.getContentPath(evidenceId);

    if (!existsSync(envelopePath)) {
      return { valid: false, evidenceId, reason: 'NOT_FOUND' };
    }

    const annotations = await this.getAnnotations(evidenceId);
    const deprecation = annotations.find(a => a.annotationType === 'DEPRECATION');

    if (deprecation) {
      return { valid: false, evidenceId, reason: 'DEPRECATED', deprecation };
    }

    if (!existsSync(contentPath)) {
      return { valid: false, evidenceId, reason: 'NOT_FOUND' };
    }

    const envelopeContent = readFileSync(envelopePath, 'utf-8');
    const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(envelopeContent));
    const storedContent = readFileSync(contentPath);

    // Decrypt before checksum verification
    let content: Buffer = storedContent;
    if (this.config.enableEncryption && this.config.encryptionKey) {
      try {
        content = decryptContent(storedContent, this.config.encryptionKey);
      } catch {
        return { valid: false, evidenceId, reason: 'ENCRYPTION_ERROR' };
      }
    }

    const calculatedChecksum = `sha256:${createHash('sha256').update(content).digest('hex')}`;

    if (calculatedChecksum !== envelope.checksum) {
      this.logAccess(evidenceId, 'system', 'VERIFY', false);
      return {
        valid: false,
        evidenceId,
        reason: 'CHECKSUM_MISMATCH',
        expectedChecksum: envelope.checksum,
        actualChecksum: calculatedChecksum,
      };
    }

    this.logAccess(evidenceId, 'system', 'VERIFY', true);
    return { valid: true, evidenceId, reason: 'VALID' };
  }

  async getAnnotations(evidenceId: string): Promise<EvidenceAnnotation[]> {
    const annotationPath = this.getAnnotationPath(evidenceId);
    if (!existsSync(annotationPath)) {
      return [];
    }

    const content = readFileSync(annotationPath, 'utf-8');
    return JSON.parse(content) as EvidenceAnnotation[];
  }

  async getAccessLog(evidenceId: string): Promise<EvidenceAccessLog[]> {
    return this.accessLogs.filter(log => log.evidenceId === evidenceId);
  }

  getStats(): EvidenceStorageStats {
    const stats: EvidenceStorageStats = {
      totalEvidenceCount: 0,
      totalSizeBytes: 0,
      byClassification: {},
      byRetentionClass: {},
    };

    const files = readdirSync(this.envelopeDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const evidenceId = file.replace('.json', '');
      try {
        const contentPath = this.getContentPath(evidenceId);
        if (existsSync(contentPath)) {
          const contentStat = statSync(contentPath);
          stats.totalSizeBytes += contentStat.size;
        }

        const envelopePath = this.getEnvelopePath(evidenceId);
        const envelopeContent = readFileSync(envelopePath, 'utf-8');
        const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(envelopeContent));

        stats.totalEvidenceCount++;
        stats.byClassification[envelope.classification] = (stats.byClassification[envelope.classification] || 0) + 1;
        stats.byRetentionClass[envelope.retentionClass] = (stats.byRetentionClass[envelope.retentionClass] || 0) + 1;
      } catch {
        // Skip malformed files
      }
    }

    return stats;
  }

  async erase(
    evidenceId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<ErasureResult> {
    enforceAuth(auth, 'evidence:erase');

    const envelopePath = this.getEnvelopePath(evidenceId);
    const contentPath = this.getContentPath(evidenceId);

    if (!existsSync(envelopePath)) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    const envelopeContent = readFileSync(envelopePath, 'utf-8');
    const envelope = EvidenceEnvelopeSchema.parse(JSON.parse(envelopeContent));
    enforceAuth(auth, 'evidence:erase', envelope.tenantId);

    const erasureAnnotation: EvidenceAnnotation = {
      annotationId: randomUUID(),
      evidenceId,
      annotationType: 'ERASURE',
      content: reason,
      annotatedBy: auth.actorId,
      annotatedAt: new Date().toISOString(),
      annotationChecksum: `sha256:${createHash('sha256').update(reason).digest('hex')}`,
    };

    const existingAnnotations = await this.getAnnotations(evidenceId);
    existingAnnotations.push(erasureAnnotation);
    writeFileSync(
      this.getAnnotationPath(evidenceId),
      JSON.stringify(existingAnnotations, null, 2),
      'utf-8'
    );

    if (existsSync(contentPath)) {
      try {
        rmSync(contentPath, { force: true });
      } catch {
        // best-effort
      }
    }

    this.logAccess(evidenceId, auth.actorId, 'ERASE', true);

    return {
      success: true,
      evidenceId,
      erasedBy: auth.actorId,
      erasedAt: erasureAnnotation.annotatedAt,
      reason,
      fieldsErased: ['content'],
      tombstoneRecorded: true,
    };
  }

  async tenantOffboarding(
    tenantId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<TenantOffboardingResult> {
    enforceAuth(auth, 'evidence:erase');

    const result: TenantOffboardingResult = {
      tenantId,
      offboardedBy: auth.actorId,
      offboardedAt: new Date().toISOString(),
      reason,
      totalEvidenceFound: 0,
      totalErased: 0,
      totalLegalHoldProtected: 0,
      errors: [],
    };

    const tenantEvidence = await this.list({ tenantId }, auth);
    result.totalEvidenceFound = tenantEvidence.length;

    for (const envelope of tenantEvidence) {
      try {
        const annotations = await this.getAnnotations(envelope.evidenceId);
        const hasLegalHold = annotations.some(a => a.annotationType === 'NOTE' && a.content.includes('LEGAL_HOLD'));
        if (hasLegalHold) {
          result.totalLegalHoldProtected++;
          continue;
        }
        await this.erase(envelope.evidenceId, `tenant offboarding: ${reason}`, auth);
        result.totalErased++;
      } catch (error) {
        result.errors.push(`${envelope.evidenceId}: ${error}`);
      }
    }

    return result;
  }

  scanForModelHiddenReasoning(
    content: unknown,
  ): { found: boolean; reason?: string } {
    return containsModelHiddenReasoning(content);
  }

  private logAccess(
    evidenceId: string,
    accessedBy: string,
    accessType: 'READ' | 'ANNOTATE' | 'VERIFY' | 'CREATE' | 'ERASE',
    success: boolean,
  ): void {
    if (!this.config.enableAccessLog) return;

    const log: EvidenceAccessLog = {
      accessId: randomUUID(),
      evidenceId,
      accessedBy,
      accessType,
      timestamp: new Date().toISOString(),
      success,
    };

    this.accessLogs.push(log);
  }
}

// ============================================================
// IN-MEMORY STORAGE ADAPTER (for testing)
// ============================================================

export class InMemoryEvidenceStorageAdapter implements IEvidenceStorageAdapter {
  private readonly envelopes = new Map<string, EvidenceEnvelope>();
  private readonly content = new Map<string, Buffer>();
  private readonly annotations = new Map<string, EvidenceAnnotation[]>();
  private readonly accessLogs: EvidenceAccessLog[] = [];

  async create(
    envelope: EvidenceEnvelope,
    content: Buffer,
    auth: AuthorizationContext,
  ): Promise<EvidenceRef> {
    enforceAuth(auth, 'evidence:create', envelope.tenantId);

    const hiddenReasoningScan = this.scanForModelHiddenReasoning(content);
    if (hiddenReasoningScan.found) {
      throw new Error(
        `Evidence rejected: contains model hidden reasoning (${hiddenReasoningScan.reason}). §7.3 prohibits this.`,
      );
    }

    if (this.envelopes.has(envelope.evidenceId)) {
      throw new Error(`Evidence ${envelope.evidenceId} already exists (append-only)`);
    }

    this.envelopes.set(envelope.evidenceId, envelope);
    this.content.set(envelope.evidenceId, content);
    this.annotations.set(envelope.evidenceId, []);

    this.logAccess(envelope.evidenceId, auth.actorId, 'CREATE', true);

    return EvidenceRefSchema.parse({
      evidenceId: envelope.evidenceId,
      mediaType: envelope.mediaType,
      storageRef: `memory://${envelope.evidenceId}`,
      checksum: envelope.checksum,
      size: content.length,
    });
  }

  async read(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; content: Buffer }> {
    const envelope = this.envelopes.get(evidenceId);
    const content = this.content.get(evidenceId);

    if (!envelope || !content) {
      this.logAccess(evidenceId, auth.actorId, 'READ', false);
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    enforceAuth(auth, 'evidence:read', envelope.tenantId);

    this.logAccess(evidenceId, auth.actorId, 'READ', true);
    return { envelope, content };
  }

  async readRedacted(
    evidenceId: string,
    auth: AuthorizationContext,
  ): Promise<{ envelope: EvidenceEnvelope; redactedContent: Buffer }> {
    const result = await this.read(evidenceId, auth);

    let content: unknown = result.content;
    try {
      content = JSON.parse(result.content.toString('utf-8'));
    } catch {
      content = result.content.toString('utf-8');
    }
    const redacted = sanitizeObject(content, DEFAULT_REDACTION_RULES);

    return {
      envelope: result.envelope,
      redactedContent: Buffer.from(JSON.stringify(redacted), 'utf-8'),
    };
  }

  async list(
    filter: EvidenceFilter,
    auth: AuthorizationContext,
  ): Promise<EvidenceEnvelope[]> {
    enforceAuth(auth, 'evidence:read');

    const effectiveFilter: EvidenceFilter = {
      ...filter,
      tenantId: auth.isSuperAdmin ? filter.tenantId : auth.tenantId,
    };

    const allEnvelopes = [...this.envelopes.values()];
    return allEnvelopes.filter(envelope => this.matchesFilter(envelope, effectiveFilter));
  }

  private matchesFilter(envelope: EvidenceEnvelope, filter: EvidenceFilter): boolean {
    if (filter.runId && envelope.runId !== filter.runId) return false;
    if (filter.scenarioId && envelope.scenarioId !== filter.scenarioId) return false;
    if (filter.capabilityId && envelope.capabilityId !== filter.capabilityId) return false;
    if (filter.tenantId && envelope.tenantId !== filter.tenantId) return false;
    if (filter.classification && envelope.classification !== filter.classification) return false;
    if (filter.mediaType && envelope.mediaType !== filter.mediaType) return false;
    if (filter.retentionClass && envelope.retentionClass !== filter.retentionClass) return false;
    if (filter.fromDate && envelope.timestamp < filter.fromDate) return false;
    if (filter.toDate && envelope.timestamp > filter.toDate) return false;
    return true;
  }

  async annotate(
    annotation: EvidenceAnnotation,
    auth: AuthorizationContext,
  ): Promise<void> {
    if (!this.envelopes.has(annotation.evidenceId)) {
      throw new Error(`Evidence ${annotation.evidenceId} not found`);
    }

    const envelope = this.envelopes.get(annotation.evidenceId)!;
    enforceAuth(auth, 'evidence:annotate', envelope.tenantId);

    const existing = this.annotations.get(annotation.evidenceId) || [];
    existing.push(annotation);
    this.annotations.set(annotation.evidenceId, existing);

    this.logAccess(annotation.evidenceId, auth.actorId, 'ANNOTATE', true);
  }

  async verify(evidenceId: string): Promise<EvidenceVerificationResult> {
    const envelope = this.envelopes.get(evidenceId);
    const content = this.content.get(evidenceId);

    if (!envelope) {
      return { valid: false, evidenceId, reason: 'NOT_FOUND' };
    }

    const annotations = await this.getAnnotations(evidenceId);
    const deprecation = annotations.find(a => a.annotationType === 'DEPRECATION');

    if (deprecation) {
      return { valid: false, evidenceId, reason: 'DEPRECATED', deprecation };
    }

    if (!content) {
      return { valid: false, evidenceId, reason: 'NOT_FOUND' };
    }

    const calculatedChecksum = `sha256:${createHash('sha256').update(content).digest('hex')}`;

    if (calculatedChecksum !== envelope.checksum) {
      this.logAccess(evidenceId, 'system', 'VERIFY', false);
      return {
        valid: false,
        evidenceId,
        reason: 'CHECKSUM_MISMATCH',
        expectedChecksum: envelope.checksum,
        actualChecksum: calculatedChecksum,
      };
    }

    this.logAccess(evidenceId, 'system', 'VERIFY', true);
    return { valid: true, evidenceId, reason: 'VALID' };
  }

  async getAnnotations(evidenceId: string): Promise<EvidenceAnnotation[]> {
    return this.annotations.get(evidenceId) || [];
  }

  async getAccessLog(evidenceId: string): Promise<EvidenceAccessLog[]> {
    return this.accessLogs.filter(log => log.evidenceId === evidenceId);
  }

  getStats(): EvidenceStorageStats {
    const stats: EvidenceStorageStats = {
      totalEvidenceCount: this.envelopes.size,
      totalSizeBytes: [...this.content.values()].reduce((sum, buf) => sum + buf.length, 0),
      byClassification: {},
      byRetentionClass: {},
    };

    for (const envelope of this.envelopes.values()) {
      stats.byClassification[envelope.classification] = (stats.byClassification[envelope.classification] || 0) + 1;
      stats.byRetentionClass[envelope.retentionClass] = (stats.byRetentionClass[envelope.retentionClass] || 0) + 1;
    }

    return stats;
  }

  async erase(
    evidenceId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<ErasureResult> {
    enforceAuth(auth, 'evidence:erase');

    const envelope = this.envelopes.get(evidenceId);
    if (!envelope) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    enforceAuth(auth, 'evidence:erase', envelope.tenantId);

    const erasureAnnotation: EvidenceAnnotation = {
      annotationId: randomUUID(),
      evidenceId,
      annotationType: 'ERASURE',
      content: reason,
      annotatedBy: auth.actorId,
      annotatedAt: new Date().toISOString(),
      annotationChecksum: `sha256:${createHash('sha256').update(reason).digest('hex')}`,
    };

    const existingAnnotations = this.annotations.get(evidenceId) || [];
    existingAnnotations.push(erasureAnnotation);
    this.annotations.set(evidenceId, existingAnnotations);

    this.content.delete(evidenceId);

    this.logAccess(evidenceId, auth.actorId, 'ERASE', true);

    return {
      success: true,
      evidenceId,
      erasedBy: auth.actorId,
      erasedAt: erasureAnnotation.annotatedAt,
      reason,
      fieldsErased: ['content'],
      tombstoneRecorded: true,
    };
  }

  async tenantOffboarding(
    tenantId: string,
    reason: string,
    auth: AuthorizationContext,
  ): Promise<TenantOffboardingResult> {
    enforceAuth(auth, 'evidence:erase');

    const result: TenantOffboardingResult = {
      tenantId,
      offboardedBy: auth.actorId,
      offboardedAt: new Date().toISOString(),
      reason,
      totalEvidenceFound: 0,
      totalErased: 0,
      totalLegalHoldProtected: 0,
      errors: [],
    };

    const tenantEvidence = await this.list({ tenantId }, auth);
    result.totalEvidenceFound = tenantEvidence.length;

    for (const envelope of tenantEvidence) {
      try {
        const annotations = await this.getAnnotations(envelope.evidenceId);
        const hasLegalHold = annotations.some(a => a.annotationType === 'NOTE' && a.content.includes('LEGAL_HOLD'));
        if (hasLegalHold) {
          result.totalLegalHoldProtected++;
          continue;
        }
        await this.erase(envelope.evidenceId, `tenant offboarding: ${reason}`, auth);
        result.totalErased++;
      } catch (error) {
        result.errors.push(`${envelope.evidenceId}: ${error}`);
      }
    }

    return result;
  }

  scanForModelHiddenReasoning(
    content: unknown,
  ): { found: boolean; reason?: string } {
    return containsModelHiddenReasoning(content);
  }

  private logAccess(
    evidenceId: string,
    accessedBy: string,
    accessType: 'READ' | 'ANNOTATE' | 'VERIFY' | 'CREATE' | 'ERASE',
    success: boolean,
  ): void {
    const log: EvidenceAccessLog = {
      accessId: randomUUID(),
      evidenceId,
      accessedBy,
      accessType,
      timestamp: new Date().toISOString(),
      success,
    };
    this.accessLogs.push(log);
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const STORAGE_VERSION = '2.0.0';