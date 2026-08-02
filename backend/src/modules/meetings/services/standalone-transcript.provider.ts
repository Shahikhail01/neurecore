/**
 * Standalone transcript provider — accepts user-pasted transcripts
 * (e.g. from a vendor that lacks an API) once tenant consent has been
 * recorded. The caller (the controller) is responsible for validating
 * the consent record before invoking this provider.
 */
import { Injectable } from '@nestjs/common';
import type {
  ITranscriptProvider,
  FetchTranscriptInput,
} from './transcript-provider.interface';
import type { MeetingTranscript } from '../schemas/meeting.types';

@Injectable()
export class StandaloneTranscriptProvider implements ITranscriptProvider {
  public readonly provider = 'STANDALONE' as const;

  isAvailable(): boolean {
    return true;
  }

  async fetch(input: FetchTranscriptInput): Promise<MeetingTranscript> {
    if (!input.rawBody) {
      return Promise.reject(new Error('STANDALONE_PROVIDER_REQUIRES_RAW_BODY'));
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody);
    } catch {
      return Promise.reject(new Error('STANDALONE_PROVIDER_INVALID_JSON'));
    }
    return Promise.resolve(this.coerce(parsed, input));
  }

  verifySignature(_rawBody: string, _signature: string): void {
    // Standalone provider has no external webhook — signature is a no-op.
  }

  private coerce(
    payload: unknown,
    input: FetchTranscriptInput,
  ): MeetingTranscript {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('STANDALONE_PROVIDER_INVALID_PAYLOAD');
    }
    const p = payload as Partial<MeetingTranscript>;
    return {
      id: input.externalId,
      tenantId: input.tenantId,
      provider: 'STANDALONE',
      externalId: input.externalId,
      title: typeof p.title === 'string' ? p.title : 'Untitled meeting',
      startedAt:
        typeof p.startedAt === 'string'
          ? p.startedAt
          : new Date().toISOString(),
      endedAt:
        typeof p.endedAt === 'string' ? p.endedAt : new Date().toISOString(),
      participants: Array.isArray(p.participants) ? p.participants : [],
      utterances: Array.isArray(p.utterances) ? p.utterances : [],
      consent: p.consent ?? {
        tenantId: input.tenantId,
        userId: 'system',
        scope: 'TRANSCRIPT_INGEST',
        grantedAt: new Date().toISOString(),
        jurisdiction: 'OTHER',
      },
    };
  }
}
