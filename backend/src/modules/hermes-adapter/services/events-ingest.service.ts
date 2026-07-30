/**
 * HermesEventsIngestService — receives webhook events from the sidecar.
 *
 * Plan ref: NC-AWL-IMP-2 §1.3 (event webhook reception)
 *
 * The sidecar emits events to the gateway via HTTP POST. This service
 * receives them and is the entry point for translating them into
 * NeureCore's audit log.
 *
 * **Phase 1.3 scope:**
 *   - Accept the webhook request
 *   - Verify the request signature (HMAC, same secret as the tokens)
 *   - Hand the event to phase 1.4's audit log writer (placeholder)
 *
 * **What this service does NOT do in Phase 1.3:**
 *   - Persist to HermesAuditLog (the table is renamed in Phase 0)
 *   - Broadcast via Socket.IO (Phase 1.4)
 *   - Trigger downstream side effects (Phase 2)
 *
 * The webhook is posted from the sidecar's `EventBus._forward()` method.
 * The endpoint is registered at `POST /api/v1/hermes-adapter/events`.
 */

import { Injectable, Logger, BadRequestException, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { HermesTokenService } from './token.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

export interface SidecarWebhookEvent {
  type: string;
  executionId: string;
  ts: number;
  payload: Record<string, unknown>;
}

const SIGNATURE_HEADER = 'x-hermes-signature';
const TIMESTAMP_HEADER = 'x-hermes-timestamp';

@Injectable()
export class HermeEventsIngestService {
  private readonly logger = new Logger(HermeEventsIngestService.name);
  private readonly secret: string;
  private readonly toleranceSeconds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly tokenService: HermesTokenService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const secret = this.config.get<string>('HERMES_SIDECAR_SECRET');
    if (!secret) {
      throw new Error('HERMES_SIDECAR_SECRET is not configured.');
    }
    this.secret = secret;
    const tolEnv = this.config.get<string>('HERMES_SIDECAR_WEBHOOK_TOLERANCE_SECONDS');
    this.toleranceSeconds = tolEnv ? parseInt(tolEnv, 10) : 300; // 5 min default
  }

  /**
   * Ingest a webhook event from the sidecar.
   *
   * The sidecar signs the (timestamp + raw body) with the shared secret; we
   * verify the signature, then check the timestamp is within the tolerance
   * window (replay protection).
   */
  async ingest(
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ): Promise<SidecarWebhookEvent> {
    if (!signature) {
      throw new UnauthorizedException('Missing HMAC signature');
    }
    if (!timestamp) {
      throw new UnauthorizedException('Missing timestamp');
    }
    const tsNum = parseInt(timestamp, 10);
    if (Number.isNaN(tsNum)) {
      throw new BadRequestException('Invalid timestamp');
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - tsNum) > this.toleranceSeconds) {
      throw new UnauthorizedException(
        `Timestamp out of tolerance window (now=${now}, ts=${tsNum})`,
      );
    }

    const expected = crypto
      .createHmac('sha256', this.secret)
      .update(timestamp + '.' + rawBody)
      .digest('hex');
    const provided = signature.toLowerCase();
    if (
      expected.length !== provided.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
    ) {
      throw new UnauthorizedException('Bad signature');
    }

    let event: SidecarWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch (e) {
      throw new BadRequestException(`Body is not valid JSON: ${(e as Error).message}`);
    }
    if (!event.type || !event.executionId || typeof event.ts !== 'number') {
      throw new BadRequestException(
        'Event must have type, executionId, ts',
      );
    }

    if (!this.prisma) {
      this.logger.warn('PrismaService unavailable; verified event was not persisted');
      return event;
    }
    const existing = await this.prisma.auditLog.findFirst({
      where: { correlationId: event.executionId },
      orderBy: { createdAt: 'asc' },
      select: { tenantId: true, actor: true },
    });
    const tenantId =
      (typeof event.payload?.tenantId === 'string' ? event.payload.tenantId : null) ??
      existing?.tenantId ?? null;
    const actor =
      (typeof event.payload?.userId === 'string' ? event.payload.userId : null) ??
      existing?.actor ?? 'system';
    const causationId = `${event.executionId}:${event.ts}:${event.type}`;
    const duplicate = await this.prisma.auditLog.findFirst({
      where: { causationId },
      select: { id: true },
    });
    if (duplicate) return event;
    await this.prisma.auditLog.create({
      data: {
        actor,
        tenantId,
        action: `autonomous.${event.type}`,
        resource: 'autonomous_execution',
        resourceId: event.executionId,
        result: event.type.endsWith('failed') ? 'failure' : 'success',
        correlationId: event.executionId,
        causationId,
        details: event as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Webhook event: type=${event.type} executionId=${event.executionId} ts=${event.ts}`,
    );
    return event;
  }
}
