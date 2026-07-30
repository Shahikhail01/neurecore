/**
 * HermeSidecarEventsController — receives webhook events from the sidecar.
 *
 * Plan ref: NC-AWL-IMP-2 §1.3 (event webhook)
 *
 * The endpoint is unauthenticated by JWT (the sidecar is a service, not
 * a user) but HMAC-signed via the shared secret. The signing happens
 * again in the `HermeEventsIngestService`.
 *
 * **Phase 1.3 scope:** accept the event, verify signature, log it.
 * Phase 1.4 will write to audit log and broadcast via Socket.IO.
 *
 * Registered at
 * `POST /api/v1/hermes-adapter/executions/:executionId/events`.
 * The URL and signed body IDs must match.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/roles.decorator';
import { HermeEventsIngestService } from '../services/events-ingest.service';
import type { SidecarWebhookEvent } from '../services/events-ingest.service';

@Controller({ path: 'hermes-adapter/executions/:executionId/events', version: '1' })
@Public()
export class HermeSidecarEventsController {
  constructor(private readonly ingest: HermeEventsIngestService) {}

  @Post()
  @HttpCode(202)
  async receive(
    @Req() req: Request,
    @Param('executionId') executionId: string,
    @Headers('x-hermes-signature') signature: string | undefined,
    @Headers('x-hermes-timestamp') timestamp: string | undefined,
    @Body() body: SidecarWebhookEvent,
  ): Promise<{ accepted: true; type: string }> {
    if (body.executionId !== executionId) {
      throw new BadRequestException('Event executionId does not match URL');
    }
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!raw) {
      throw new Error('Raw request body is required for webhook verification');
    }
    const rawBody = raw.toString('utf8');
    const event = await this.ingest.ingest(rawBody, signature, timestamp);
    return { accepted: true, type: event.type };
  }
}
