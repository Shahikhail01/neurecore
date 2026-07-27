// src/modules/execution/execution.controller.ts
//
// Phase 7 — Execution UX surface endpoints.
// Adds read-side endpoints (attempt detail, evidence download) and an
// operator retry endpoint, complementing the existing request + cancel
// commands. All endpoints require JWT auth and enforce tenant isolation.
import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExecutionOrchestrator } from './application/execution-orchestrator';
import { CorrelationService } from '../../common/correlation/correlation.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller('execution')
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(
    private readonly orchestrator: ExecutionOrchestrator,
    private readonly correlation: CorrelationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('request')
  async requestExecution(
    @Body()
    body: { taskId: string; agentId: string; executionRequestId: string },
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `request-execution:${body.taskId}:${body.executionRequestId}`,
    );

    return this.orchestrator.requestExecution(
      body.taskId,
      body.agentId,
      body.executionRequestId,
      metadata,
    );
  }

  @Post('cancel/:attemptId')
  async cancel(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `cancel-execution:${attemptId}`,
    );

    await this.orchestrator.cancel(attemptId, metadata);
    return { cancelled: true };
  }

  /**
   * Phase 7 — operator retry (P1). Re-queues a failed attempt as a
   * fresh execution request using the canonical create-or-return
   * idempotency strategy on (tenantId, taskId, executionRequestId).
   */
  @Post('retry/:attemptId')
  async retry(
    @Param('attemptId') attemptId: string,
    @Body() body: { reason?: string } | undefined,
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const attempt = await this.prisma.executionAttempt.findFirst({
      where: { id: attemptId, tenantId: user.tenantId },
      select: { id: true, taskId: true, agentId: true, status: true },
    });
    if (!attempt) {
      throw new NotFoundException('EXECUTION_ATTEMPT_NOT_FOUND');
    }

    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `retry-execution:${attemptId}:${Date.now()}`,
    );

    const result = await this.orchestrator.requestExecution(
      attempt.taskId,
      attempt.agentId,
      metadata.idempotencyKey,
      metadata,
    );

    await this.prisma.timelineEvent.create({
      data: {
        tenantId: user.tenantId,
        projectId: null,
        occurredAt: new Date(),
        category: 'AI_ACTION',
        severity: 'MEDIUM',
        sourceType: 'HUMAN',
        sourceId: user.id,
        title: 'OperatorRetry',
        description: `Operator requested retry for attempt ${attemptId}${body?.reason ? `: ${body.reason}` : ''}.`,
        relatedEntityType: 'ExecutionAttempt',
        relatedEntityId: result.attemptId,
        correlationId: metadata.correlationId,
        createdByUserId: user.id,
      },
    });

    return {
      retried: true,
      attemptId: result.attemptId,
      attemptNumber: result.attemptNumber,
    };
  }

  /**
   * Phase 7 — execution attempt detail (trace + evidence + tool calls).
   */
  @Get('attempt/:attemptId')
  async getAttempt(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    const attempt = await this.prisma.executionAttempt.findFirst({
      where: { id: attemptId, tenantId: user.tenantId },
      include: {
        toolCalls: {
          orderBy: { occurredAt: 'asc' },
        },
        evidence: {
          orderBy: { createdAt: 'asc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            projectId: true,
            requiredRole: true,
            requiredCapabilities: true,
          },
        },
        agent: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('EXECUTION_ATTEMPT_NOT_FOUND');
    }

    return attempt;
  }

  /**
   * Phase 7 — evidence download endpoint. Serves the stored artifact
   * blob for the tenant that owns it. The read path always validates
   * `(storageRef, tenantId)` so cross-tenant storage references return
   * not-found, never forbidden (Phase 7 §9.1 + §10.1).
   */
  @Get('evidence/:evidenceId/download')
  async downloadEvidence(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: { tenantId: string },
    @Res() res: Response,
  ) {
    const evidence = await this.prisma.evidenceArtifact.findFirst({
      where: { id: evidenceId, tenantId: user.tenantId },
    });
    if (!evidence) {
      throw new NotFoundException('EVIDENCE_NOT_FOUND');
    }

    const body = await this.readEvidenceBody(evidence.storageRef);
    const filename = this.suggestFilename(
      evidence.storageRef,
      evidence.mimeType,
    );

    res.setHeader(
      'Content-Type',
      evidence.mimeType || 'application/octet-stream',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Checksum', evidence.checksum);
    res.setHeader('X-Evidence-Id', evidence.id);
    res.send(body);
  }

  /**
   * Inline preview (used by the EvidenceViewer). Returns the stored
   * body with `Content-Type` set so the browser can render text /
   * markdown / images directly.
   */
  @Get('evidence/:evidenceId/preview')
  @Header('Cache-Control', 'no-store')
  async previewEvidence(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: { tenantId: string },
    @Res() res: Response,
  ) {
    const evidence = await this.prisma.evidenceArtifact.findFirst({
      where: { id: evidenceId, tenantId: user.tenantId },
    });
    if (!evidence) {
      throw new NotFoundException('EVIDENCE_NOT_FOUND');
    }

    const body = await this.readEvidenceBody(evidence.storageRef);
    res.setHeader(
      'Content-Type',
      evidence.mimeType || 'application/octet-stream',
    );
    if (
      !evidence.mimeType.startsWith('text/') &&
      !evidence.mimeType.includes('json')
    ) {
      // wrap previews as plain text so the browser can display them
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.send(body);
  }

  private async readEvidenceBody(storageRef: string): Promise<Buffer> {
    // Storage abstraction. Today: filesystem or inline data URIs.
    // The orchestrator's runtime writes evidence as either:
    //   1. A filesystem path (absolute or relative to EVIDENCE_ROOT)
    //   2. An `inline:...` marker (synthesises the body from metadata)
    // Future: switch to S3 / GCS without changing the controller.
    if (storageRef.startsWith('inline:')) {
      const payload = storageRef.slice('inline:'.length);
      return Buffer.from(payload, 'utf-8');
    }
    if (storageRef.startsWith('data:')) {
      const match = storageRef.match(/^data:[^;]+;base64,(.*)$/);
      if (!match) return Buffer.from('', 'utf-8');
      return Buffer.from(match[1], 'base64');
    }
    const fs = await import('fs/promises');
    const path = await import('path');
    const root = process.env.EVIDENCE_ROOT
      ? path.resolve(process.env.EVIDENCE_ROOT)
      : path.resolve(process.cwd(), 'storage', 'evidence');
    const safe = path.normalize(storageRef).replace(/^(\.\.[/\\])+/, '');
    const absolute = path.isAbsolute(safe) ? safe : path.join(root, safe);
    return fs.readFile(absolute);
  }

  private suggestFilename(storageRef: string, mimeType: string): string {
    const ext = mimeType.split('/').pop() ?? 'bin';
    if (storageRef.startsWith('inline:') || storageRef.startsWith('data:')) {
      return `evidence.${ext}`;
    }
    const base = storageRef.split('/').pop() ?? 'evidence';
    return base.includes('.') ? base : `${base}.${ext}`;
  }
}
