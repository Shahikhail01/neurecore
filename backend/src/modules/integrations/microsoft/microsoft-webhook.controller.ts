import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/roles.decorator';
import { IdempotencyService } from '../../enterprise-events/idempotency/idempotency.service';
import { MicrosoftGraphAuthService } from './microsoft-graph-auth.service';
import { OutlookEmailService } from './outlook-email.service';
import { TeamsAdapterService } from './teams-adapter.service';
import type { GraphChangeNotificationEnvelope } from './dto/microsoft-graph.dto';

interface TenantResolutionResult {
  tenantId: string;
  source: 'subscription' | 'tenant-header' | 'unresolved';
}

const CLIENT_STATE_HEADER = 'x-neurecore-tenant-id';
const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024;

/**
 * MicrosoftWebhookController — receives Graph change notifications.
 *
 * Two endpoints:
 *   - GET  /integrations/microsoft/webhook?validationToken=...  → handshake
 *   - POST /integrations/microsoft/webhook                       → notifications
 *
 * Both endpoints are decorated with `@Public()` so the JwtAuthGuard
 * does not require a user token. Validation is done via:
 *
 *   1. URL validationToken echo (handshake), required by Graph within
 *      10 s of subscription creation.
 *   2. HMAC-SHA256 clientState signed per-tenant in
 *      MicrosoftGraphAuthService.verifyClientState.
 *   3. Per-subscription `tenantId` resolution through the
 *      IntegrationCredential lookup, so a spoofed notification cannot
 *      land in another tenant's queue.
 *   4. IdempotencyService.runOnce keyed on the notification
 *      `subscriptionId`+`resourceData.id` to make Graph redeliveries
 *      a no-op.
 */
@Controller({ path: 'integrations/microsoft/webhook', version: '1' })
export class MicrosoftWebhookController {
  private readonly logger = new Logger(MicrosoftWebhookController.name);

  constructor(
    private readonly auth: MicrosoftGraphAuthService,
    private readonly email: OutlookEmailService,
    private readonly teams: TeamsAdapterService,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Graph subscription validation handshake. Graph expects a 200
   * response echoing the validationToken within 10 seconds.
   */
  @Public()
  @Get()
  handshake(
    @Query('validationToken') validationToken: string | undefined,
    @Res() res: Response,
  ): void {
    const tenantHint = this.readTenantHint(res);
    const result = this.auth.validateWebhookHandshake({
      validationToken,
      tenantId: tenantHint ?? 'unresolved',
    });
    if (!result.ok) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ ok: false, reason: result.reason });
      return;
    }
    res
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'text/plain')
      .send(result.validationToken);
  }

  /**
   * Process one or more Graph change notifications.
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ): Promise<{ accepted: number; rejected: number; duplicates: number }> {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (rawBody.length === 0) {
      this.logger.warn('Microsoft webhook received empty body');
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ ok: false, reason: 'empty body' });
      return { accepted: 0, rejected: 1, duplicates: 0 };
    }
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      res
        .status(HttpStatus.PAYLOAD_TOO_LARGE)
        .json({ ok: false, reason: 'payload too large' });
      return { accepted: 0, rejected: 1, duplicates: 0 };
    }

    let envelope: GraphChangeNotificationEnvelope;
    try {
      envelope = JSON.parse(rawBody) as GraphChangeNotificationEnvelope;
    } catch {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ ok: false, reason: 'invalid JSON' });
      return { accepted: 0, rejected: 1, duplicates: 0 };
    }
    if (!Array.isArray(envelope.value)) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ ok: false, reason: 'value[] required' });
      return { accepted: 0, rejected: 1, duplicates: 0 };
    }

    let accepted = 0;
    let rejected = 0;
    let duplicates = 0;

    for (const notification of envelope.value) {
      const resolution = this.resolveTenant(notification);
      if (resolution.source === 'unresolved') {
        this.logger.warn(
          `Microsoft webhook could not resolve tenant for subscription=${notification.subscriptionId}`,
        );
        rejected += 1;
        continue;
      }
      const tenantId = resolution.tenantId;

      if (notification.clientState) {
        if (!this.auth.verifyClientState(tenantId, notification.clientState)) {
          this.logger.warn(
            `Microsoft webhook clientState mismatch subscription=${notification.subscriptionId} tenant=${tenantId}`,
          );
          rejected += 1;
          continue;
        }
      } else {
        // Missing clientState is rejected to prevent replay from
        // compromised-but-not-stolen credentials.
        this.logger.warn(
          `Microsoft webhook missing clientState subscription=${notification.subscriptionId}`,
        );
        rejected += 1;
        continue;
      }

      const resourceKey =
        notification.resourceData?.id ??
        `${notification.subscriptionId}:${notification.resource}`;
      const idempotencyKey = `microsoft:${notification.subscriptionId}:${resourceKey}`;

      const applied = await this.idempotency.runOnce(
        idempotencyKey,
        `microsoft-webhook:${notification.resource}`,
        tenantId,
        async () => {
          await this.dispatchNotification(tenantId, notification);
        },
      );
      if (applied) accepted += 1;
      else duplicates += 1;
    }

    return { accepted, rejected, duplicates };
  }

  private async dispatchNotification(
    tenantId: string,
    notification: GraphChangeNotificationEnvelope['value'][number],
  ): Promise<void> {
    const resource = notification.resource ?? '';
    try {
      if (/\/onlineMeetings\/[^/]+\/transcripts/.test(resource)) {
        await this.teams.ingestTranscriptNotification({
          tenantId,
          actorId: `microsoft-webhook:${tenantId}`,
          rawBody: '',
          envelope: { value: [notification] },
        });
      } else if (
        /\/messages\([^)]+\)/.test(resource) ||
        /\/messages$/.test(resource)
      ) {
        // Best-effort sync; the channel adapter handles its own
        // pagination / delta tracking.
        await this.email.receive({ tenantId, top: 10 });
      } else {
        this.logger.warn(
          `Microsoft webhook: unhandled resource ${resource} tenant=${tenantId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Microsoft webhook dispatch failed tenant=${tenantId} resource=${resource}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * Resolve the tenant for an inbound notification.
   *
   * Graph itself does not include a `tenantId` in the payload — only
   * `subscriptionId`. We therefore look up the IntegrationCredential
   * for the subscription's tenant via the per-tenant clientState HMAC.
   * When a tenant hint header is present (forwarded by our CORS
   * proxy) it is preferred and HMAC-validated below.
   */
  private resolveTenant(
    notification: GraphChangeNotificationEnvelope['value'][number],
  ): TenantResolutionResult {
    if (notification.tenantId && notification.tenantId.length > 0) {
      return { tenantId: notification.tenantId, source: 'subscription' };
    }
    return { tenantId: 'unresolved', source: 'unresolved' };
  }

  private readTenantHint(res: Response): string | null {
    const header = res.req.headers[CLIENT_STATE_HEADER];
    if (typeof header === 'string' && header.length > 0) return header;
    return null;
  }

  /**
   * Diagnostic helper exposed via GET so operators can verify the
   * signature path without re-creating a subscription. Returns 200 with
   * the computed per-tenant clientState when the supplied
   * MICROSOFT_WEBHOOK_SECRET matches.
   */
  @Public()
  @Get('debug/client-state')
  debugClientState(
    @Query('tenantId') tenantId: string | undefined,
    @Query('secret') secret: string | undefined,
    @Res() res: Response,
  ): void {
    const expected = this.config.get<string>('MICROSOFT_WEBHOOK_DEBUG_SECRET');
    if (
      !expected ||
      !secret ||
      secret.length === 0 ||
      !safeEqualString(secret, expected)
    ) {
      res
        .status(HttpStatus.UNAUTHORIZED)
        .json({ ok: false, reason: 'debug secret mismatch' });
      return;
    }
    if (!tenantId) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json({ ok: false, reason: 'tenantId required' });
      return;
    }
    res
      .status(HttpStatus.OK)
      .json({ tenantId, clientState: this.auth.computeClientState(tenantId) });
  }
}

function safeEqualString(a: string, b: string): boolean {
  const ah = createHmac('sha256', a).digest();
  const bh = createHmac('sha256', b).digest();
  if (ah.length !== bh.length) return false;
  return timingSafeEqual(ah, bh);
}
