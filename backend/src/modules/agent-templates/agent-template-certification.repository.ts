// src/modules/agent-templates/agent-template-certification.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AgentTemplateCertification } from '@prisma/client';

/**
 * AgentTemplateCertificationRepository — Prisma-backed CRUD for
 * `AgentTemplateCertification`.
 *
 * Provides:
 *   - create(): persist a certification event with a deterministic
 *     `signatureHash` derived from (versionId, evaluationReport,
 *     certifiedByActorId). This signature is what `verifySignature()`
 *     re-computes to detect tampering.
 *   - latestForVersion(): the most recent certification event for a version.
 *   - verifySignature(): re-computes and compares.
 */
@Injectable()
export class AgentTemplateCertificationRepository {
  private readonly logger = new Logger(
    AgentTemplateCertificationRepository.name,
  );

  constructor(private readonly prisma: PrismaService) {}

  async create(args: {
    tenantId: string;
    agentTemplateVersionId: string;
    certifiedByActorId: string;
    evaluationReport: Prisma.JsonValue;
    expiresAt?: Date | null;
  }): Promise<AgentTemplateCertification> {
    const signatureHash = this.computeSignature(args);
    return this.prisma.agentTemplateCertification.create({
      data: {
        tenantId: args.tenantId,
        agentTemplateVersionId: args.agentTemplateVersionId,
        certifiedByActorId: args.certifiedByActorId,
        certifiedAt: new Date(),
        signatureHash,
        evaluationReport: (args.evaluationReport ??
          {}) as Prisma.InputJsonValue,
        expiresAt: args.expiresAt ?? null,
      },
    });
  }

  async latestForVersion(
    tenantId: string,
    agentTemplateVersionId: string,
  ): Promise<AgentTemplateCertification | null> {
    return this.prisma.agentTemplateCertification.findFirst({
      where: { tenantId, agentTemplateVersionId },
      orderBy: { certifiedAt: 'desc' },
    });
  }

  async listForVersion(
    tenantId: string,
    agentTemplateVersionId: string,
  ): Promise<AgentTemplateCertification[]> {
    return this.prisma.agentTemplateCertification.findMany({
      where: { tenantId, agentTemplateVersionId },
      orderBy: { certifiedAt: 'desc' },
    });
  }

  async getById(
    tenantId: string,
    id: string,
  ): Promise<AgentTemplateCertification | null> {
    return this.prisma.agentTemplateCertification.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Re-derive the signature for an existing row and compare.
   * Returns true iff the stored hash matches a fresh computation.
   */
  async verifySignature(cert: AgentTemplateCertification): Promise<boolean> {
    const recomputed = await Promise.resolve(
      this.computeSignature({
        tenantId: cert.tenantId,
        agentTemplateVersionId: cert.agentTemplateVersionId,
        certifiedByActorId: cert.certifiedByActorId,
        evaluationReport: cert.evaluationReport,
        expiresAt: cert.expiresAt,
      }),
    );
    const ok = recomputed === cert.signatureHash;
    if (!ok) {
      this.logger.warn(
        `Certification signature mismatch on ${cert.id}: stored=${cert.signatureHash} computed=${recomputed}`,
      );
    }
    return ok;
  }

  /**
   * Deterministic SHA-256 over the canonicalized certification inputs.
   * Property: any change to (versionId, evaluationReport, certifiedByActorId)
   * produces a different signature.
   */
  private computeSignature(args: {
    tenantId: string;
    agentTemplateVersionId: string;
    certifiedByActorId: string;
    evaluationReport: Prisma.JsonValue;
    expiresAt?: Date | null;
  }): string {
    const payload = JSON.stringify({
      tenantId: args.tenantId,
      agentTemplateVersionId: args.agentTemplateVersionId,
      certifiedByActorId: args.certifiedByActorId,
      evaluationReport: args.evaluationReport ?? {},
      expiresAt: args.expiresAt ? args.expiresAt.toISOString() : null,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
