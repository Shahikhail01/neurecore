/**
 * Phase 16 — TranscriptIngestionService tests.
 */

import {
  TranscriptIngestionService,
  MeetingConsentRequiredError,
} from './transcript-ingestion.service';

function makePrisma(opts: {
  consents?: unknown[];
  transcriptRow?: unknown;
}): {
  prisma: {
    meetingProviderConsent: { findFirst: jest.Mock; upsert: jest.Mock };
    meetingTranscript: { upsert: jest.Mock };
  };
} {
  const consents = opts.consents ?? [
    { id: 'c-1', jurisdiction: 'EU-GDPR', scopes: ['transcript:read'] },
  ];
  return {
    prisma: {
      meetingProviderConsent: {
        findFirst: jest.fn(async () => consents[0] ?? null),
        upsert: jest.fn(async () => ({})),
      },
      meetingTranscript: {
        upsert: jest.fn(async (args: { create: { jurisdiction: string; provider: 'TEAMS' }; update?: Record<string, unknown> }) =>
          opts.transcriptRow ?? {
            id: 'mt-1',
            provider: args.create.provider,
            jurisdiction: args.update?.['jurisdiction'] ?? args.create.jurisdiction,
            status: 'TRANSCRIBED',
          }),
      },
    },
  };
}

const SAMPLE = {
  tenantId: 'tenant-A',
  userId: 'u-1',
  provider: 'TEAMS' as const,
  providerMeetingId: 'm-99',
  title: 'Q3 forecast review',
  scheduledAt: new Date('2026-09-01T10:00:00Z'),
  durationSeconds: 1800,
  transcriptText: 'Alice: We need to ship by Friday. Bob: OK.',
  languageCode: 'en',
};

describe('Phase 16 — TranscriptIngestionService', () => {
  it('refuses wildcard tenantId', async () => {
    const svc = new TranscriptIngestionService(makePrisma({}).prisma as never);
    await expect(svc.ingest({ ...SAMPLE, tenantId: '*' })).rejects.toThrow(
      /tenantId/,
    );
  });

  it('refuses ingestion without an active consent', async () => {
    const { prisma } = makePrisma({ consents: [] });
    const svc = new TranscriptIngestionService(prisma as never);
    await expect(svc.ingest(SAMPLE)).rejects.toBeInstanceOf(
      MeetingConsentRequiredError,
    );
  });

  it('upserts transcript when consent exists', async () => {
    const { prisma } = makePrisma({});
    const svc = new TranscriptIngestionService(prisma as never);
    const out = await svc.ingest(SAMPLE);
    expect(out.transcriptId).toBe('mt-1');
    expect(out.consentId).toBe('c-1');
    expect(prisma.meetingTranscript.upsert).toHaveBeenCalled();
  });

  it('infers EU-GDPR jurisdiction when no override + EU locale', async () => {
    const { prisma } = makePrisma({});
    const svc = new TranscriptIngestionService(prisma as never);
    const out = await svc.ingest({ ...SAMPLE, languageCode: 'de' });
    expect(out.jurisdiction).toBe('EU-GDPR');
  });

  it('honours explicit jurisdiction', async () => {
    const { prisma } = makePrisma({});
    const svc = new TranscriptIngestionService(prisma as never);
    const out = await svc.ingest({
      ...SAMPLE,
      jurisdiction: 'US-CA',
      languageCode: 'en',
    });
    expect(out.jurisdiction).toBe('US-CA');
  });

  it('grantConsent upserts the consent row', async () => {
    const { prisma } = makePrisma({});
    prisma.meetingProviderConsent.upsert = jest.fn(async () => ({ id: 'consent-xyz' }));
    const svc = new TranscriptIngestionService(prisma as never);
    const out = await svc.grantConsent({
      tenantId: 'tenant-A',
      userId: 'u-1',
      provider: 'ZOOM',
      scopes: ['transcript:read'],
      jurisdiction: 'EU-GDPR',
    });
    expect(out.consentId).toBe('consent-xyz');
    expect(prisma.meetingProviderConsent.upsert).toHaveBeenCalled();
  });

  it('getById returns null on wildcard tenantId', async () => {
    const { prisma } = makePrisma({});
    const svc = new TranscriptIngestionService(prisma as never);
    expect(await svc.getById('*', 'mt-1')).toBeNull();
  });
});
