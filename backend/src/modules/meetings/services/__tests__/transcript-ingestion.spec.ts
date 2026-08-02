/**
 * Phase P3 — Transcript ingestion unit tests.
 */
import { TranscriptIngestionService } from '../transcript-ingestion.service';
import { OutlookTranscriptProvider } from '../outlook-transcript.provider';
import { TeamsTranscriptProvider } from '../teams-transcript.provider';
import { ZoomTranscriptProvider } from '../zoom-transcript.provider';
import { StandaloneTranscriptProvider } from '../standalone-transcript.provider';
import type { MeetingConsent } from '../../schemas/meeting.types';

const baseConsent: MeetingConsent = {
  tenantId: 't1',
  userId: 'u1',
  scope: 'TRANSCRIPT_INGEST',
  grantedAt: '2026-08-02T09:00:00.000Z',
  jurisdiction: 'GDPR',
};

function buildSut() {
  const prismaMock = { knowledgeEntry: {}, auditLog: {} } as never;
  const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new TranscriptIngestionService(
    prismaMock,
    auditMock as never,
    new OutlookTranscriptProvider(),
    new TeamsTranscriptProvider(),
    new ZoomTranscriptProvider(),
    new StandaloneTranscriptProvider(),
  );
  return { svc, auditMock };
}

describe('TranscriptIngestionService', () => {
  it('rejects missing consent', async () => {
    const { svc } = buildSut();
    await expect(
      svc.ingest({
        tenantId: 't1',
        actorId: 'u1',
        provider: 'STANDALONE',
        externalId: 'e1',
        consent: undefined as never,
      }),
    ).rejects.toThrow(/consent required/);
  });

  it('rejects consent/tenant mismatch', async () => {
    const { svc } = buildSut();
    await expect(
      svc.ingest({
        tenantId: 't1',
        actorId: 'u1',
        provider: 'STANDALONE',
        externalId: 'e1',
        consent: { ...baseConsent, tenantId: 'other-tenant' },
      }),
    ).rejects.toThrow(/consent_tenant_mismatch/);
  });

  it('rejects expired consent', async () => {
    const { svc } = buildSut();
    await expect(
      svc.ingest({
        tenantId: 't1',
        actorId: 'u1',
        provider: 'STANDALONE',
        externalId: 'e1',
        consent: { ...baseConsent, expiresAt: '2020-01-01T00:00:00.000Z' },
      }),
    ).rejects.toThrow(/consent_expired/);
  });

  it('fails closed when an unavailable provider is selected', async () => {
    const { svc } = buildSut();
    await expect(
      svc.ingest({
        tenantId: 't1',
        actorId: 'u1',
        provider: 'OUTLOOK',
        externalId: 'e1',
        consent: baseConsent,
      }),
    ).rejects.toThrow(/OUTLOOK_PROVIDER_UNAVAILABLE|unavailable/);
  });

  it('ingests standalone provider transcript', async () => {
    const { svc } = buildSut();
    const rawBody = JSON.stringify({
      title: 'Sync',
      startedAt: '2026-08-02T10:00:00.000Z',
      endedAt: '2026-08-02T11:00:00.000Z',
      participants: [
        { rawId: 'p1', displayName: 'P', resolutionStatus: 'resolved' },
      ],
      utterances: [
        { participantRawId: 'p1', startMs: 0, endMs: 1000, text: 'hi' },
      ],
    });
    const t = await svc.ingest({
      tenantId: 't1',
      actorId: 'u1',
      provider: 'STANDALONE',
      externalId: 'e1',
      consent: baseConsent,
      rawBody,
    });
    expect(t.title).toBe('Sync');
    expect(t.participants.length).toBe(1);
  });

  it('writes audit log on ingest', async () => {
    const { svc, auditMock } = buildSut();
    const rawBody = JSON.stringify({
      title: 'X',
      startedAt: '2026-08-02T10:00:00.000Z',
      endedAt: '2026-08-02T11:00:00.000Z',
      participants: [],
      utterances: [],
    });
    await svc.ingest({
      tenantId: 't1',
      actorId: 'u1',
      provider: 'STANDALONE',
      externalId: 'e2',
      consent: baseConsent,
      rawBody,
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'meetings.transcript.ingested' }),
    );
  });
});
