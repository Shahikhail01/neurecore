/**
 * CrmWebhookController — Phase 27 (P27) inbound webhooks (CR-AI-1106).
 *
 * Accepts HubSpot + Salesforce + generic webhook events, verifies
 * their HMAC signature, and forwards to CrmEventTriggerService.
 *
 * SOLID:
 *   - SRP — HTTP routing only; signature verification + event
 *           classification are delegated.
 *   - OCP — a new provider = a new branch + a new env var. No edits
 *           to the trigger service.
 *   - DIP — depends on `CrmEventTriggerService` and the
 *           `ICrmWebhookSignatureVerifier` it exposes.
 */
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { CrmEventTriggerService } from '../../channels/crm/crm-event-trigger.service';

const HUBSPOT_SIGNATURE_HEADER = 'x-hubspot-signature-v3';
const SALESFORCE_SIGNATURE_HEADER = 'x-sf-signature';

@Controller({ path: 'connectors/webhooks', version: '1' })
export class CrmWebhookController {
  private readonly logger = new Logger(CrmWebhookController.name);

  constructor(
    private readonly trigger: CrmEventTriggerService,
    private readonly config: ConfigService,
  ) {}

  @Post('hubspot')
  @HttpCode(HttpStatus.OK)
  async hubspot(
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId: string,
    @Headers(HUBSPOT_SIGNATURE_HEADER) signature: string,
    @Body() body: unknown,
  ) {
    if (!tenantId || tenantId === '*') {
      throw new BadRequestException('tenantId header required');
    }
    const secret = this.config.get<string>('HUBSPOT_WEBHOOK_SECRET');
    if (!secret) {
      throw new ForbiddenException('HubSpot webhook secret not configured');
    }
    const rawBody = serialiseBody(body);
    const ok = this.trigger.verifyWebhookSignature({
      signature,
      requestBody: rawBody,
      secret,
    });
    if (!ok) {
      throw new ForbiddenException('HubSpot webhook signature mismatch');
    }
    const typed = body as {
      eventType?: string;
      payload?: Record<string, unknown>;
    };
    const ack = await this.trigger.ingest({
      tenantId,
      source: 'hubspot',
      eventType: typed?.eventType ?? 'unknown',
      payload: typed?.payload ?? {},
      receivedAt: new Date().toISOString(),
      ...(signature ? { signature } : {}),
      providerEventId: deriveProviderEventId('hubspot', body),
    });
    return ack;
  }

  @Post('salesforce')
  @HttpCode(HttpStatus.OK)
  async salesforce(
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId: string,
    @Headers(SALESFORCE_SIGNATURE_HEADER) signature: string,
    @Body() body: unknown,
  ) {
    if (!tenantId || tenantId === '*') {
      throw new BadRequestException('tenantId header required');
    }
    const secret = this.config.get<string>('SALESFORCE_WEBHOOK_SECRET');
    if (!secret) {
      throw new ForbiddenException('Salesforce webhook secret not configured');
    }
    const rawBody = serialiseBody(body);
    const ok = this.trigger.verifyWebhookSignature({
      signature,
      requestBody: rawBody,
      secret,
    });
    if (!ok) {
      throw new ForbiddenException('Salesforce webhook signature mismatch');
    }
    const typed = body as {
      eventType?: string;
      payload?: Record<string, unknown>;
    };
    const ack = await this.trigger.ingest({
      tenantId,
      source: 'salesforce',
      eventType: typed?.eventType ?? 'unknown',
      payload: typed?.payload ?? {},
      receivedAt: new Date().toISOString(),
      ...(signature ? { signature } : {}),
      providerEventId: deriveProviderEventId('salesforce', body),
    });
    return ack;
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async genericWebhook(
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId: string,
    @Body() body: unknown,
  ) {
    if (!tenantId || tenantId === '*') {
      throw new BadRequestException('tenantId header required');
    }
    const typed = body as {
      eventType?: string;
      payload?: Record<string, unknown>;
    };
    const ack = await this.trigger.ingest({
      tenantId,
      source: 'webhook',
      eventType: typed?.eventType ?? 'unknown',
      payload: typed?.payload ?? {},
      receivedAt: new Date().toISOString(),
    });
    return ack;
  }
}

function serialiseBody(body: unknown): string {
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body ?? {});
  } catch {
    return '';
  }
}

function deriveProviderEventId(
  _source: 'hubspot' | 'salesforce',
  body: unknown,
): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const typed = body as Record<string, unknown>;
  const candidates = [
    typed['eventId'],
    typed['event_id'],
    typed['id'],
    typed['messageId'],
    typed['message_id'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return undefined;
}
