/**
 * Phase P3 — Summary templates + follow-up compose unit tests.
 */
import { SummaryTemplatesService } from '../summary-templates.service';
import { FollowupService } from '../followup.service';
import type {
  ActionItem,
  MeetingSummary,
  MeetingTranscript,
} from '../../schemas/meeting.types';

const transcript: MeetingTranscript = {
  id: 'm1',
  tenantId: 't1',
  provider: 'STANDALONE',
  externalId: 'ext-1',
  title: 'Sync',
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
      rawId: 'alice@acme.com',
      displayName: 'Alice',
      resolutionStatus: 'resolved',
      userId: 'u-alice',
    },
    {
      rawId: 'bob@external.com',
      displayName: 'Bob',
      resolutionStatus: 'external',
    },
  ],
  utterances: [],
};

describe('SummaryTemplatesService', () => {
  it('exposes all eight Creatio-aligned templates', () => {
    const svc = new SummaryTemplatesService();
    const keys = svc.list().map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'overview',
        'decisions',
        'risks',
        'questions',
        'commitments',
        'actionItems',
        'sentiment',
        'followUp',
      ]),
    );
  });

  it('returns a defensive copy of the template', () => {
    const svc = new SummaryTemplatesService();
    const t1 = svc.get('overview');
    t1.sections.push('HACKED');
    const t2 = svc.get('overview');
    expect(t2.sections).not.toContain('HACKED');
  });

  it('renders a typed skeleton ordered per the template', () => {
    const svc = new SummaryTemplatesService();
    const skeleton = svc.renderSkeleton(transcript, 'overview');
    expect(skeleton.map((s) => s.title)).toEqual([
      'Purpose',
      'Attendees',
      'Key Outcomes',
    ]);
  });
});

describe('FollowupService.compose', () => {
  it('composes an email + calendar event', () => {
    const auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const runtime = { createRun: jest.fn() };
    const svc = new FollowupService(auditMock as never, runtime as never);
    const summary: MeetingSummary = {
      meetingId: 'm1',
      tenantId: 't1',
      generatedAt: '2026-08-02T11:00:00.000Z',
      templateKey: 'followUp',
      sections: [{ title: 'Purpose', bullets: ['Discuss roadmap'] }],
      version: 1,
    };
    const actions: ActionItem[] = [
      {
        id: 'a1',
        text: 'Send proposal',
        ownerUserId: 'u-alice',
        ownerDisplayName: 'Alice',
        ownerStatus: 'resolved',
        confidence: 0.9,
        ambiguity: 'low',
        sourceSpan: { startMs: 0, endMs: 1000 },
      },
    ];
    const draft = svc.compose(transcript, summary, actions);
    expect(draft.email.subject).toContain('Follow-up');
    expect(draft.email.body).toContain('Alice');
    expect(draft.calendarEvent.attendees).toContain('alice@acme.com');
    expect(draft.calendarEvent.attendees).not.toContain('bob@external.com');
  });
});
