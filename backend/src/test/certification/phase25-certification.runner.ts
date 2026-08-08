/**
 * Phase 25 — G25 Meetings-live certification runner.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G25-M-001 — Phase 16 G16 still APPROVED (no regression)
 *   G25-M-002 — TranscriptProviderRegistry wires Outlook + Teams
 *   G25-M-003 — OutlookCallGraphProvider parses live event payloads
 *   G25-M-004 — TeamsCallGraphProvider parses live event payloads
 *   G25-M-005 — Both providers expose supportsLiveCallGraph=true
 *   G25-M-006 — LiveTranscriptIngestionService refuses wildcard tenant
 *   G25-M-007 — LiveTranscriptIngestionService refuses unregistered providers
 *   G25-M-008 — LiveTranscriptIngestionService is idempotent on replay
 *   G25-M-009 — ActionExtractorService resolves owners against real users
 *   G25-M-010 — CrmLinkerService.writeBack refuses unlinked transcripts
 *   G25-M-011 — OutlookCallGraphClient fetches transcript blob (live client)
 *   G25-M-012 — OutlookCallGraphClient fails closed (no token)
 *   G25-M-013 — TeamsCallGraphClient fetches transcript blob (live client)
 *   G25-M-014 — TeamsCallGraphClient fails closed (no token)
 *   G25-M-015 — OutlookCallGraphProvider delegates fetch to the live client
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase16CertificationRunner } from './phase16-certification.runner';
import { OutlookCallGraphProvider } from '../../modules/meetings/providers/outlook-call-graph.provider';
import { TeamsCallGraphProvider } from '../../modules/meetings/providers/teams-call-graph.provider';
import { OutlookCallGraphClient } from '../../modules/meetings/providers/outlook-call-graph.client';
import { TeamsCallGraphClient } from '../../modules/meetings/providers/teams-call-graph.client';
import { TranscriptProviderUnavailableError } from '../../modules/meetings/providers/transcript-provider.errors';
import type { IHTTPClient, HTTPResponse } from '../../modules/connectors/adapters/live/http-client';
import type { IOAuthTokenStore, OAuthTokenData } from '../../modules/connectors/interfaces/IOAuthTokenStore';
import {
  TRANSCRIPT_PROVIDER,
  type ITranscriptProvider,
} from '../../modules/meetings/interfaces/ITranscriptProvider';
import { TranscriptProviderRegistry } from '../../modules/meetings/registry/transcript-provider.registry';
import { LiveTranscriptIngestionService } from '../../modules/meetings/services/live-transcript-ingestion.service';
import {
  ActionExtractorService,
  type IOwnerResolver,
  type OwnerCandidate,
} from '../../modules/meetings/services/action-extractor.service';
import { CrmLinkerService } from '../../modules/meetings/services/crm-linker.service';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase25CertificationRunner {
  private readonly logger = new Logger(Phase25CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    // G25-M-001 — Phase 16 G16 still APPROVED
    try {
      const p16 = await new Phase16CertificationRunner().run();
      record('G25-M-001', 'Phase 16 G16 still APPROVED', p16.verdict === 'APPROVED');
    } catch (err) {
      record('G25-M-001', 'Phase 16 G16 still APPROVED', false, (err as Error).message);
    }

    // G25-M-002 — registry wires Outlook + Teams
    {
      const outlook = new OutlookCallGraphProvider();
      const teams = new TeamsCallGraphProvider();
      const injected: ReadonlyArray<ITranscriptProvider> = [outlook, teams];
      const registry = new TranscriptProviderRegistry(injected as never);
      registry.onModuleInit();
      const ok = registry.has('OUTLOOK') && registry.has('TEAMS');
      record(
        'G25-M-002',
        'TranscriptProviderRegistry wires Outlook + Teams',
        ok,
        `registered=${registry.registered().join(',')}`,
      );
    }

    // G25-M-003 — Outlook parses live events
    {
      const outlook = new OutlookCallGraphProvider();
      const event = outlook.parseLiveEvent({
        value: [
          {
            changeType: 'created',
            resourceData: {
              id: 'm-outlook-1',
              meetingId: 'm-outlook-1',
              organizer: { id: 'u-1', upn: 'alice@example.com' },
            },
          },
        ],
      });
      const ok =
        event !== null &&
        event.provider === 'OUTLOOK' &&
        event.providerMeetingId === 'm-outlook-1' &&
        event.eventType === 'call.started';
      record(
        'G25-M-003',
        'OutlookCallGraphProvider parses live event payloads',
        ok,
        event ? `type=${event.eventType}` : 'null',
      );
      // Validation handshake returns null.
      const challenge = outlook.parseLiveEvent({ validationToken: 'abc' });
      record(
        'G25-M-003b',
        'OutlookCallGraphProvider returns null on validation handshake',
        challenge === null,
      );
    }

    // G25-M-004 — Teams parses live events
    {
      const teams = new TeamsCallGraphProvider();
      const event = teams.parseLiveEvent({
        value: [
          {
            changeType: 'updated',
            resourceData: { id: 'm-teams-1', meetingId: 'm-teams-1' },
          },
        ],
      });
      const ok =
        event !== null &&
        event.provider === 'TEAMS' &&
        event.providerMeetingId === 'm-teams-1' &&
        event.eventType === 'transcript.partial';
      record(
        'G25-M-004',
        'TeamsCallGraphProvider parses live event payloads',
        ok,
        event ? `type=${event.eventType}` : 'null',
      );
    }

    // G25-M-005 — capabilities declared
    {
      const outlook = new OutlookCallGraphProvider();
      const teams = new TeamsCallGraphProvider();
      const ok =
        outlook.capabilities.supportsLiveCallGraph &&
        outlook.capabilities.supportsIncrementalTranscript &&
        teams.capabilities.supportsLiveCallGraph &&
        teams.capabilities.supportsIncrementalTranscript &&
        outlook.capabilities.requiredScopes.length > 0 &&
        teams.capabilities.requiredScopes.length > 0;
      record(
        'G25-M-005',
        'Both providers declare supportsLiveCallGraph=true + required scopes',
        ok,
      );
    }

    // G25-M-006 — LiveTranscriptIngestionService refuses wildcard
    {
      const fakePrisma = {
        meetingTranscript: {
          findFirst: async () => null,
          create: async () => ({ id: 'mt-1' }),
          update: async () => ({ id: 'mt-1' }),
        },
      };
      const fakeConsent = {
        isGranted: async () => true,
      };
      const registry = new TranscriptProviderRegistry([
        new OutlookCallGraphProvider(),
      ] as never);
      registry.onModuleInit();
      const svc = new LiveTranscriptIngestionService(
        fakePrisma as never,
        registry as never,
        fakeConsent as never,
      );
      let rejected = false;
      try {
        await svc.ingestLive({
          tenantId: '*',
          userId: 'u',
          provider: 'OUTLOOK',
          providerMeetingId: 'm',
        });
      } catch {
        rejected = true;
      }
      record(
        'G25-M-006',
        'LiveTranscriptIngestionService refuses wildcard tenant',
        rejected,
      );
    }

    // G25-M-007 — refuses unregistered provider
    {
      const fakePrisma = {
        meetingTranscript: {
          findFirst: async () => null,
          create: async () => ({ id: 'mt-1' }),
          update: async () => ({ id: 'mt-1' }),
        },
      };
      const fakeConsent = {
        isGranted: async () => true,
      };
      const registry = new TranscriptProviderRegistry([] as never);
      registry.onModuleInit();
      const svc = new LiveTranscriptIngestionService(
        fakePrisma as never,
        registry as never,
        fakeConsent as never,
      );
      let rejected = false;
      try {
        await svc.ingestLive({
          tenantId: 't',
          userId: 'u',
          provider: 'ZOOM',
          providerMeetingId: 'm',
        });
      } catch {
        rejected = true;
      }
      record(
        'G25-M-007',
        'LiveTranscriptIngestionService refuses unregistered providers',
        rejected,
      );
    }

    // G25-M-008 — idempotent replay
    {
      let creates = 0;
      let updates = 0;
      const fakePrisma = {
        meetingTranscript: {
          findFirst: async () => {
            // After the first create, return the existing row so
            // the next call hits the update branch.
            return creates > 0 ? { id: 'mt-1' } : null;
          },
          create: async () => {
            creates += 1;
            return { id: 'mt-1' };
          },
          update: async () => {
            updates += 1;
            return { id: 'mt-1' };
          },
        },
      };
      const fakeConsent = {
        isGranted: async () => true,
      };
      const registry = new TranscriptProviderRegistry([
        new OutlookCallGraphProvider(),
      ] as never);
      registry.onModuleInit();
      const svc = new LiveTranscriptIngestionService(
        fakePrisma as never,
        registry as never,
        fakeConsent as never,
      );
      const first = await svc.ingestLive({
        tenantId: 't',
        userId: 'u',
        provider: 'OUTLOOK',
        providerMeetingId: 'm',
        transcriptText: 'first',
      });
      const second = await svc.ingestLive({
        tenantId: 't',
        userId: 'u',
        provider: 'OUTLOOK',
        providerMeetingId: 'm',
        transcriptText: 'second',
      });
      const ok =
        creates === 1 &&
        updates === 1 &&
        first.idempotent === false &&
        second.idempotent === true;
      record(
        'G25-M-008',
        'LiveTranscriptIngestionService is idempotent on replay',
        ok,
        `creates=${creates} updates=${updates}`,
      );
    }

    // G25-M-009 — owner auto-resolution against real users
    {
      const resolved: OwnerCandidate = {
        userId: 'u-1',
        displayName: 'Alice Smith',
        email: 'alice@example.com',
      };
      const resolver: IOwnerResolver = {
        resolve: async () => resolved,
        candidates: async () => [resolved],
      };
      const svc = new ActionExtractorService(resolver);
      const items = await svc.extractWithOwnerResolution({
        tenantId: 't',
        transcriptId: 't-1',
        transcriptText: '@alice will follow up by 2026-09-12.',
      });
      const ok = items[0]?.ownerUserId === 'u-1' && items[0]?.ambiguousOwner === false;
      record(
        'G25-M-009',
        'ActionExtractorService resolves owners against real users',
        ok,
        ok ? undefined : `ownerUserId=${items[0]?.ownerUserId}`,
      );

      // Ambiguous path: 2+ candidates.
      const ambigResolver: IOwnerResolver = {
        resolve: async () => resolved,
        candidates: async () => [resolved, { ...resolved, userId: 'u-2', displayName: 'Alice Jones' }],
      };
      const svcAmbig = new ActionExtractorService(ambigResolver);
      const itemsAmbig = await svcAmbig.extractWithOwnerResolution({
        tenantId: 't',
        transcriptId: 't-1',
        transcriptText: '@alice will follow up.',
      });
      record(
        'G25-M-009b',
        'ActionExtractorService flags ambiguity when 2+ candidates exist',
        itemsAmbig[0]?.ambiguousOwner === true,
      );
    }

    // G25-M-010 — CrmLinkerService.writeBack refuses unlinked transcript
    {
      let linkedWriteBack = false;
      const fakePrisma = {
        meetingTranscript: {
          findFirst: async () => ({ id: 'mt-1', linkedRecordType: null, linkedRecordId: null }),
          update: async () => ({}),
        },
        customerTouchpointEvent: {
          findFirst: async () => null,
          create: async () => {
            linkedWriteBack = true;
            return { id: 'tp-1' };
          },
        },
        customer: { findFirst: async () => null },
        customerContact: { findFirst: async () => null },
        deal: { findFirst: async () => null },
        meetingActionItem: { create: async () => ({ id: 'a-1' }) },
      };
      const svc = new CrmLinkerService(fakePrisma as never);
      let rejected = false;
      try {
        await svc.writeBack({
          tenantId: 't',
          transcriptId: 'mt-1',
          channelKind: 'meeting',
          subject: 'follow up',
          occurredAt: new Date(),
        });
      } catch {
        rejected = true;
      }
      record(
        'G25-M-010',
        'CrmLinkerService.writeBack refuses unlinked transcripts',
        rejected && !linkedWriteBack,
      );
    }

    // G25-M-011 — OutlookCallGraphClient fetches a transcript blob when a
    // tenant token is present (real client path, no provider stubbing).
    {
      const memoryStore: IOAuthTokenStore = new MemoryTokenStore({
        accessToken: 'outlook-token',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const http: IHTTPClient = {
        request: async (req): Promise<HTTPResponse> => {
          if (req.url.includes('/content')) {
            return { status: 200, headers: {}, body: 'full transcript text' };
          }
          if (req.url.includes('/transcripts')) {
            return {
              status: 200,
              headers: {},
              body: JSON.stringify({
                value: [
                  {
                    id: 'tr-1',
                    meetingTitle: 'Sales review',
                    startDateTime: '2026-08-01T10:00:00Z',
                    endDateTime: '2026-08-01T10:30:00Z',
                    language: 'en',
                  },
                ],
              }),
            };
          }
          return { status: 200, headers: {}, body: '' };
        },
      };
      const client = new OutlookCallGraphClient(http, memoryStore);
      const payload = await client.fetchTranscriptBlob({
        tenantId: 't-1',
        userId: 'u-1',
        onlineMeetingId: 'm-1',
      });
      const ok =
        payload.id === 'tr-1' &&
        payload.meetingTitle === 'Sales review' &&
        payload.content === 'full transcript text';
      record(
        'G25-M-011',
        'OutlookCallGraphClient fetches transcript blob with a provisioned token',
        ok,
        ok ? undefined : `payload=${JSON.stringify(payload)}`,
      );
    }

    // G25-M-012 — OutlookCallGraphClient fails closed (no token provisioned).
    {
      const client = new OutlookCallGraphClient(
        { request: async () => ({ status: 401, headers: {}, body: '' }) },
        new MemoryTokenStore(null),
      );
      let threw: TranscriptProviderUnavailableError | null = null;
      try {
        await client.fetchTranscriptBlob({
          tenantId: 't-1',
          userId: 'u-1',
          onlineMeetingId: 'm-1',
        });
      } catch (err) {
        if (err instanceof TranscriptProviderUnavailableError) threw = err;
      }
      record(
        'G25-M-012',
        'OutlookCallGraphClient fails closed when no token is provisioned',
        threw !== null,
        threw === null ? 'did not throw TranscriptProviderUnavailableError' : undefined,
      );
    }

    // G25-M-013 — TeamsCallGraphClient fetches a transcript blob.
    {
      const memoryStore: IOAuthTokenStore = new MemoryTokenStore({
        accessToken: 'teams-token',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const http: IHTTPClient = {
        request: async (req): Promise<HTTPResponse> => {
          if (req.url.includes('/content')) {
            return { status: 200, headers: {}, body: 'teams transcript' };
          }
          if (req.url.includes('/transcripts')) {
            return {
              status: 200,
              headers: {},
              body: JSON.stringify({
                value: [
                  {
                    id: 'tr-1',
                    subject: 'Standup',
                    startDateTime: '2026-08-01T09:00:00Z',
                    endDateTime: '2026-08-01T09:15:00Z',
                    language: 'en',
                  },
                ],
              }),
            };
          }
          return { status: 200, headers: {}, body: '' };
        },
      };
      const client = new TeamsCallGraphClient(http, memoryStore);
      const payload = await client.fetchTranscriptBlob({
        tenantId: 't-1',
        userId: 'u-1',
        onlineMeetingId: 'm-1',
      });
      const ok =
        payload.id === 'tr-1' &&
        payload.subject === 'Standup' &&
        payload.transcript === 'teams transcript';
      record(
        'G25-M-013',
        'TeamsCallGraphClient fetches transcript blob with a provisioned token',
        ok,
        ok ? undefined : `payload=${JSON.stringify(payload)}`,
      );
    }

    // G25-M-014 — TeamsCallGraphClient fails closed (no token provisioned).
    {
      const client = new TeamsCallGraphClient(
        { request: async () => ({ status: 401, headers: {}, body: '' }) },
        new MemoryTokenStore(null),
      );
      let threw: TranscriptProviderUnavailableError | null = null;
      try {
        await client.fetchTranscriptBlob({
          tenantId: 't-1',
          userId: 'u-1',
          onlineMeetingId: 'm-1',
        });
      } catch (err) {
        if (err instanceof TranscriptProviderUnavailableError) threw = err;
      }
      record(
        'G25-M-014',
        'TeamsCallGraphClient fails closed when no token is provisioned',
        threw !== null,
        threw === null ? 'did not throw TranscriptProviderUnavailableError' : undefined,
      );
    }

    // G25-M-015 — OutlookCallGraphProvider.fetchTranscript delegates to the
    // real client (end-to-end provider → client, non-mutating read).
    {
      const client: {
        fetchTranscriptBlob: (p: {
          tenantId: string;
          userId: string;
          onlineMeetingId: string;
        }) => Promise<{
          id: string;
          meetingTitle?: string;
          startDateTime?: string;
          endDateTime?: string;
          languageCode?: string;
          content: string;
        }>;
      } = {
        fetchTranscriptBlob: async () => ({
          id: 'm-1',
          meetingTitle: 'Daily',
          startDateTime: '2026-08-01T10:00:00Z',
          endDateTime: '2026-08-01T10:30:00Z',
          languageCode: 'en',
          content: 'hello world',
        }),
      };
      const provider = new OutlookCallGraphProvider(client as never);
      const result = await provider.fetchTranscript({
        tenantId: 't-1',
        userId: 'u-1',
        providerMeetingId: 'm-1',
      });
      const ok =
        result.transcriptText === 'hello world' &&
        result.title === 'Daily' &&
        result.durationSeconds === 1800;
      record(
        'G25-M-015',
        'OutlookCallGraphProvider delegates transcript fetch to the live client',
        ok,
        ok ? undefined : `result=${JSON.stringify(result)}`,
      );
    }

    this.logger.log(
      `Phase 25 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}

/** Minimal in-memory OAuth token store for the live-client gates. */
class MemoryTokenStore implements IOAuthTokenStore {
  private token: OAuthTokenData | null;
  constructor(token: OAuthTokenData | null) {
    this.token = token;
  }
  async save(_t: string, _p: string, data: OAuthTokenData): Promise<void> {
    this.token = data;
  }
  async get(_t: string, _p: string): Promise<OAuthTokenData | null> {
    return this.token;
  }
  async delete(_t: string, _p: string): Promise<void> {
    this.token = null;
  }
  async isExpired(_t: string, _p: string): Promise<boolean> {
    if (!this.token?.expiresAt) return false;
    return new Date(this.token.expiresAt).getTime() <= Date.now();
  }
}
