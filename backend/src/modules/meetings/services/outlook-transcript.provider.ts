/**
 * Outlook transcript provider — typed stub implementing the
 * {@link ITranscriptProvider} port.
 *
 * Per plan rule 1 this is NOT a second provider registry. The Outlook
 * real SDK lives in `modules/integrations/google` (which exposes
 * Microsoft Graph through the same OAuth client); here we declare the
 * adapter the meetings module consumes. When the real Graph
 * subscription for onlineMeetings transcripts is wired at production,
 * this class is replaced with a Microsoft-Graph-backed implementation
 * that honours the same contract.
 *
 * The current implementation falls back to a structured "unavailable"
 * response — plan rule 3.13 forbids fake success.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  ITranscriptProvider,
  FetchTranscriptInput,
} from './transcript-provider.interface';
import type { MeetingTranscript } from '../schemas/meeting.types';

@Injectable()
export class OutlookTranscriptProvider implements ITranscriptProvider {
  public readonly provider = 'OUTLOOK' as const;
  private readonly logger = new Logger(OutlookTranscriptProvider.name);

  isAvailable(): boolean {
    return Boolean(
      process.env.MICROSOFT_GRAPH_TENANT_ID &&
      process.env.MICROSOFT_GRAPH_CLIENT_ID,
    );
  }

  async fetch(_input: FetchTranscriptInput): Promise<MeetingTranscript> {
    return Promise.reject(
      new Error(
        !this.isAvailable()
          ? 'OUTLOOK_PROVIDER_UNAVAILABLE: MICROSOFT_GRAPH_TENANT_ID / CLIENT_ID not configured'
          : 'OUTLOOK_PROVIDER_NOT_IMPLEMENTED',
      ),
    );
  }

  verifySignature(_rawBody: string, _signature: string): void {
    throw new Error('OUTLOOK_PROVIDER_NOT_IMPLEMENTED');
  }
}
