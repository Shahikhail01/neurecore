/**
 * Phase P3 — Action extractor unit tests.
 *
 * Verifies the unmissable rule from §P3: no unmapped participant is
 * silently assigned. Action items whose owner cannot be resolved are
 * left in `ownerStatus: 'unresolved'`.
 */
import { ActionExtractorService } from '../action-extractor.service';
import type { MeetingTranscript } from '../../schemas/meeting.types';

const transcript: MeetingTranscript = {
  id: 'm1',
  tenantId: 't1',
  provider: 'STANDALONE',
  externalId: 'ext-1',
  title: 'Sprint review',
  startedAt: '2026-08-02T10:00:00.000Z',
  endedAt: '2026-08-02T11:00:00.000Z',
  consent: {
    tenantId: 't1',
    userId: 'u1',
    scope: 'TRANSCRIPT_INGEST',
    grantedAt: '2026-08-02T09:00:00.000Z',
    jurisdiction: 'GDPR',
  },
  participants: [
    {
      rawId: 'p1',
      displayName: 'Alice',
      resolutionStatus: 'resolved',
      userId: 'u-alice',
    },
    { rawId: 'p2', displayName: 'Bob', resolutionStatus: 'unresolved' },
    {
      rawId: 'p3',
      displayName: 'Carol External',
      resolutionStatus: 'external',
    },
  ],
  utterances: [
    {
      participantRawId: 'p1',
      startMs: 0,
      endMs: 30_000,
      text: 'Alice will draft the proposal by 2026-08-10. Carol will review it.',
    },
    {
      participantRawId: 'p2',
      startMs: 30_000,
      endMs: 60_000,
      text: 'Bob needs to follow up with the vendor next Friday.',
    },
    {
      participantRawId: 'p3',
      startMs: 60_000,
      endMs: 90_000,
      text: 'Carol shall send the contract by next Monday.',
    },
  ],
};

describe('ActionExtractorService', () => {
  it('extracts multiple action items per utterance', () => {
    const svc = new ActionExtractorService();
    const { items } = svc.extract(transcript);
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('marks unmapped owners as unresolved — never silently assigned', () => {
    const svc = new ActionExtractorService();
    const { items } = svc.extract(transcript);
    const bob = items.find(
      (i) => (i.ownerDisplayName ?? '').toLowerCase() === 'bob',
    );
    expect(bob).toBeDefined();
    expect(bob?.ownerStatus).toBe('unresolved');
    expect(bob?.ownerUserId).toBeUndefined();
  });

  it('resolves owners when displayName matches a participant', () => {
    const svc = new ActionExtractorService();
    const { items } = svc.extract(transcript);
    const alice = items.find(
      (i) => (i.ownerDisplayName ?? '').toLowerCase() === 'alice',
    );
    expect(alice?.ownerStatus).toBe('resolved');
    expect(alice?.ownerUserId).toBe('u-alice');
  });

  it('parses ISO dates', () => {
    const svc = new ActionExtractorService();
    const { items } = svc.extract(transcript);
    const alice = items.find(
      (i) => (i.ownerDisplayName ?? '').toLowerCase() === 'alice',
    );
    expect(alice?.dueDate).toBe('2026-08-10');
  });

  it('parses "next Friday" into an ISO date', () => {
    const svc = new ActionExtractorService();
    const { items } = svc.extract(transcript);
    const bob = items.find(
      (i) => (i.ownerDisplayName ?? '').toLowerCase() === 'bob',
    );
    expect(bob?.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns unresolvedParticipants list for UI mapping', () => {
    const svc = new ActionExtractorService();
    const { unresolvedParticipants } = svc.extract(transcript);
    const names = unresolvedParticipants.map((p) => p.displayName);
    expect(names).toContain('Bob');
    expect(names).not.toContain('Alice');
  });
});
