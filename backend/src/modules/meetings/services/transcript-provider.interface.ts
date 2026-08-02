/**
 * Meeting transcript ingestion — provider port (P3).
 *
 * The canonical owner for transcript ingestion from consented sources.
 * Each provider implementation wraps an external SDK / HTTP API and
 * returns a normalized {@link MeetingTranscript}.
 *
 * The port is intentionally narrow: the ingestion service (the
 * downstream consumer) needs only `fetch` to pull the transcript
 * and `verifySignature` to validate the provider webhook.
 */
import type {
  MeetingProvider,
  MeetingTranscript,
} from '../schemas/meeting.types';

export interface FetchTranscriptInput {
  tenantId: string;
  /** Provider-issued transcript identifier. */
  externalId: string;
  /** When supplied, the provider is expected to validate the payload
   *  signature against this raw body. */
  rawBody?: string;
  signature?: string;
}

export interface ITranscriptProvider {
  readonly provider: MeetingProvider;
  /** True when the provider's SDK is wired and credentials configured. */
  isAvailable(): boolean;
  fetch(input: FetchTranscriptInput): Promise<MeetingTranscript>;
  /** Validate a webhook signature. Throws when the signature is invalid. */
  verifySignature(rawBody: string, signature: string): void;
}
