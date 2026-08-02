/**
 * Teams transcript provider — typed stub. Same fail-closed posture
 * as {@link OutlookTranscriptProvider}; Teams transcripts surface
 * through the same Microsoft Graph API so the production wiring is
 * shared.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  ITranscriptProvider,
  FetchTranscriptInput,
} from './transcript-provider.interface';
import type { MeetingTranscript } from '../schemas/meeting.types';

@Injectable()
export class TeamsTranscriptProvider implements ITranscriptProvider {
  public readonly provider = 'TEAMS' as const;
  private readonly logger = new Logger(TeamsTranscriptProvider.name);

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
          ? 'TEAMS_PROVIDER_UNAVAILABLE'
          : 'TEAMS_PROVIDER_NOT_IMPLEMENTED',
      ),
    );
  }

  verifySignature(_rawBody: string, _signature: string): void {
    throw new Error('TEAMS_PROVIDER_NOT_IMPLEMENTED');
  }
}
