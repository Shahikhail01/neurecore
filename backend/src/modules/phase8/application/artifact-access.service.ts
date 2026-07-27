// src/modules/phase8/application/artifact-access.service.ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface ArtifactAccessRequest {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  artifactId: string;
  artifactOwnerTenantId: string;
  storageRef: string;
  checksum: string;
  operation: 'READ' | 'WRITE' | 'DELETE';
  correlationId: string;
}

export interface ArtifactAccessDecision {
  allowed: boolean;
  reason: string;
  redactedRef?: string;
}

/**
 * Phase 8 — §10.1 item 7 (artifacts enforce tenant ownership at
 * storage and application layers) and §10.5 (artifact access
 * controls — Security — Access test).
 *
 * The service exposes ONE entry point that every controller,
 * download endpoint, and storage adapter must call before serving
 * an artifact. It does NOT touch the database — the storage layer
 * applies the same checks before materialising a signed URL or
 * streaming bytes. This means both layers fail-closed independently.
 */
@Injectable()
export class ArtifactAccessService {
  check(request: ArtifactAccessRequest): ArtifactAccessDecision {
    if (!request.tenantId) {
      return { allowed: false, reason: 'MISSING_TENANT_CONTEXT' };
    }
    if (request.artifactOwnerTenantId !== request.tenantId) {
      // Cross-tenant identifier policy: a 403 would leak existence.
      // Surface a safe not-found.
      return { allowed: false, reason: 'X_TENANT_NOT_FOUND' };
    }
    if (!request.checksum) {
      return { allowed: false, reason: 'MISSING_CHECKSUM' };
    }
    if (!this.checksumShape(request.checksum)) {
      return { allowed: false, reason: 'INVALID_CHECKSUM' };
    }
    if (request.operation === 'DELETE' && request.actorType !== 'HUMAN') {
      return { allowed: false, reason: 'DELETE_REQUIRES_HUMAN' };
    }
    if (request.operation === 'WRITE' && request.actorType === 'AI_AGENT') {
      return { allowed: false, reason: 'AI_WRITE_REQUIRES_APPROVAL' };
    }
    return {
      allowed: true,
      reason: 'OK',
      redactedRef: this.redactStorageRef(request.storageRef),
    };
  }

  /**
   * Recompute the expected checksum for the supplied bytes and
   * compare with the value persisted on the EvidenceArtifact row.
   * Used by storage-layer code to fail closed when the bytes on disk
   * have drifted from the record.
   */
  expectedChecksum(bytes: Buffer | string): string {
    return createHash('sha256').update(bytes).digest('hex');
  }

  /**
   * Stable redacted form of a storage ref, suitable for log lines
   * and metrics. Keeps tenant + object prefix; drops any embedded
   * secret tokens.
   */
  redactStorageRef(storageRef: string): string {
    if (!storageRef) return '';
    const sanitized = storageRef.replace(
      /([?&])(token|signature|key)=([^&]+)/gi,
      '$1$2=[REDACTED]',
    );
    const [prefix] = sanitized.split('?');
    if (!prefix) return sanitized;
    return prefix.length > 96 ? `${prefix.slice(0, 96)}…` : prefix;
  }

  private checksumShape(value: string): boolean {
    return /^[a-f0-9]{64}$/i.test(value);
  }
}
