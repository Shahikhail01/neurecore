/**
 * Phase 25 — ITranscriptProvider.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * SOLID — ISP: every provider exposes a single narrow surface. The
 * Outlook / Teams / Zoom providers do NOT inherit a fat
 * `IConnectorAdapter`; they expose only the operations the transcript
 * ingestion service actually consumes. Adding a 4th live provider
 * means implementing this interface and registering it with the
 * `TranscriptProviderRegistry` — no orchestration code changes.
 *
 * LSP: every provider substitutes `ITranscriptProvider`. The
 * `TranscriptIngestionService` consumes them through the interface;
 * provider-agnostic.
 *
 * SRP: the provider owns ONLY outbound calls to its upstream API and
 * the typed translation of the upstream shape into `TranscriptIngestInput`.
 * Consent, idempotency, and tenant scoping live in
 * `MeetingConsentService` and `TranscriptIngestionService`.
 *
 * DIP: providers depend on injected `IIntegrationCredentialStore`
 * (a typed credential accessor) and `HttpClient` (typed HTTP).
 * No direct `fetch`, no Prisma calls, no env reads at runtime.
 */

import type { MeetingProvider } from '@prisma/client';

export interface TranscriptProviderCapabilities {
  /**
   * Indicates whether the provider supports live call-graph ingestion
   * (i.e. a webhook subscription that emits transcript events
   * incrementally) vs. pull-only. The Outlook + Teams providers
   * support both; Zoom is pull-only; Google Meet is pull-only.
   */
  readonly supportsLiveCallGraph: boolean;
  /** Whether the provider emits transcript deltas vs. only the final blob. */
  readonly supportsIncrementalTranscript: boolean;
  /** Provider-supported scopes required for read access to transcripts. */
  readonly requiredScopes: ReadonlyArray<string>;
}

export interface TranscriptFetchInput {
  readonly tenantId: string;
  /** The OAuth-scoped user (subject) the transcript is fetched under. */
  readonly userId: string;
  /** Provider-side meeting identifier (e.g. Microsoft Graph `joinWebUrl` id). */
  readonly providerMeetingId: string;
}

export interface TranscriptFetchResult {
  readonly providerMeetingId: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly durationSeconds: number;
  readonly transcriptText: string;
  readonly languageCode: string;
  readonly participants: ReadonlyArray<{ userId?: string; name?: string; email?: string }>;
}

export interface LiveTranscriptEvent {
  readonly provider: MeetingProvider;
  readonly providerMeetingId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly eventType: 'call.started' | 'call.ended' | 'transcript.partial' | 'transcript.final';
  readonly occurredAt: Date;
  readonly transcriptText?: string;
  readonly title?: string;
  readonly durationSeconds?: number;
  readonly languageCode?: string;
  readonly participants?: ReadonlyArray<{ userId?: string; name?: string; email?: string }>;
}

export interface ITranscriptProvider {
  readonly provider: MeetingProvider;
  readonly capabilities: TranscriptProviderCapabilities;
  /** Pull a finalized transcript for a known meeting. */
  fetchTranscript(input: TranscriptFetchInput): Promise<TranscriptFetchResult>;
  /**
   * Translate an upstream webhook payload (already JSON-parsed) into
   * a typed `LiveTranscriptEvent`. Providers MUST be pure: no I/O,
   * no Prisma. The translation is deterministic and unit-testable.
   */
  parseLiveEvent(payload: unknown): LiveTranscriptEvent | null;
}

/** DI token — the registry of providers (Map<MeetingProvider, ITranscriptProvider>). */
export const TRANSCRIPT_PROVIDER_REGISTRY = Symbol('TranscriptProviderRegistry');
/** DI token — a single provider instance (multi-binding via `useFactory` + spread). */
export const TRANSCRIPT_PROVIDER = Symbol('TranscriptProvider');
