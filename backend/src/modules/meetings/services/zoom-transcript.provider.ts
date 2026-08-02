/**
 * Zoom transcript provider — typed stub.
 *
 * Production wiring: Zoom Webhook events of type
 * `meeting.transcript_completed` → REST download of the VTT transcript.
 * Webhook signature validated against the Zoom secret token using
 * HMAC-SHA256.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  ITranscriptProvider,
  FetchTranscriptInput,
} from './transcript-provider.interface';
import type { MeetingTranscript } from '../schemas/meeting.types';

@Injectable()
export class ZoomTranscriptProvider implements ITranscriptProvider {
  public readonly provider = 'ZOOM' as const;
  private readonly logger = new Logger(ZoomTranscriptProvider.name);

  isAvailable(): boolean {
    return Boolean(
      process.env.ZOOM_WEBHOOK_SECRET_TOKEN && process.env.ZOOM_CLIENT_ID,
    );
  }

  async fetch(_input: FetchTranscriptInput): Promise<MeetingTranscript> {
    return Promise.reject(
      new Error(
        !this.isAvailable()
          ? 'ZOOM_PROVIDER_UNAVAILABLE'
          : 'ZOOM_PROVIDER_NOT_IMPLEMENTED',
      ),
    );
  }

  verifySignature(rawBody: string, signature: string): void {
    const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    if (!secret) throw new Error('ZOOM_WEBHOOK_SECRET_TOKEN not configured');
    const expected = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('INVALID_SIGNATURE');
    }
  }
}
