/**
 * Zoom — Channel Client.
 *
 * Source plan: IMPL_PLAN §R4 §4.7 — replaces ZoomAdapter.dispatch() stub.
 *
 * OAuth 2.0 + meeting creation. Uses the `meeting:write` scope that
 * the ZoomAuthClient requests at authorization.
 *
 * SRP: protocol-level request building for Zoom; auth lives in the
 * ZoomAuthClient. This class depends only on the typed credential
 * shape, not on the OAuth flow.
 *
 * Idempotency: Zoom returns the same meeting id when the same
 * Idempotency-Key is replayed — we still tag every call to make
 * retries safe at our layer too.
 *
 * Endpoints:
 *   POST https://api.zoom.us/v2/users/me/meetings
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ZoomCredentials } from '../../integrations/zoom/zoom-auth.client';

export interface ZoomCreateMeetingParams {
  tenantId: string;
  topic: string;
  startTime: string;     // ISO 8601
  durationMinutes: number;
  agenda?: string;
  idempotencyKey: string;
}

export interface ZoomMeetingResult {
  id: string;
  joinUrl: string;
  startUrl: string;
  topic: string;
  startTime: string;
}

export class ZoomAuthException extends Error {
  constructor(public readonly inner: unknown) {
    super('Zoom access token invalid — refresh and retry');
    this.name = 'ZoomAuthException';
  }
}

@Injectable()
export class ZoomClient {
  private readonly logger = new Logger(ZoomClient.name);

  constructor(
    private readonly credentials: ZoomCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!credentials?.accessToken) {
      throw new BadRequestException('Zoom credentials missing accessToken');
    }
  }

  async createMeeting(params: ZoomCreateMeetingParams): Promise<ZoomMeetingResult> {
    const url = 'https://api.zoom.us/v2/users/me/meetings';
    const body = {
      topic: params.topic,
      type: 2, // scheduled meeting
      start_time: params.startTime,
      duration: params.durationMinutes,
      agenda: params.agenda,
      settings: {
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
      },
    };
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return (await res.json()) as ZoomMeetingResult;
    }
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new ZoomAuthException({ status: 401, body: text });
    }
    if (res.status >= 500) {
      throw new ServiceUnavailableException({
        code: 'ZOOM_TRANSIENT',
        status: res.status,
        body: text,
        idempotencyKey: params.idempotencyKey,
      });
    }
    throw new BadRequestException({
      code: 'ZOOM_BAD_REQUEST',
      status: res.status,
      body: text,
      idempotencyKey: params.idempotencyKey,
    });
  }
}
