/**
 * Meetings module — domain types (P3).
 *
 * Pure type definitions; no runtime. Imported by services, schemas
 * and tests. Keep this file free of side-effects so it can be
 * imported from web (for shared client/server schemas later).
 */

export type Jurisdiction = 'GDPR' | 'CCPA' | 'PDPA' | 'LGPD' | 'OTHER';

export type MeetingProvider = 'OUTLOOK' | 'TEAMS' | 'ZOOM' | 'STANDALONE';

export interface MeetingConsent {
  tenantId: string;
  userId: string;
  scope: 'TRANSCRIPT_INGEST' | 'RECORDING_INGEST' | 'AI_SUMMARY' | 'CRM_LINK';
  grantedAt: string;
  expiresAt?: string;
  jurisdiction: Jurisdiction;
  /** Provider scope — limits consent to a single source. */
  provider?: MeetingProvider;
}

export interface MeetingParticipant {
  /** Provider-supplied identifier (email, sip, etc.). */
  rawId: string;
  displayName: string;
  /** Resolved NeureCore user id, when mapping succeeded. */
  userId?: string;
  /** When mapping failed the participant is left unresolved. */
  resolutionStatus: 'resolved' | 'unresolved' | 'external';
}

export interface MeetingUtterance {
  participantRawId: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface MeetingTranscript {
  id: string;
  tenantId: string;
  provider: MeetingProvider;
  externalId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  participants: MeetingParticipant[];
  utterances: MeetingUtterance[];
  consent: MeetingConsent;
}

export type ActionItemStatus = 'resolved' | 'unresolved';

export interface ActionItem {
  id: string;
  text: string;
  ownerUserId?: string;
  ownerDisplayName?: string;
  /** When owner could not be resolved the status is `unresolved`. */
  ownerStatus: ActionItemStatus;
  dueDate?: string;
  confidence: number;
  ambiguity: 'low' | 'medium' | 'high';
  /** Source span (utterance indices) so users can audit the extraction. */
  sourceSpan: { startMs: number; endMs: number };
}

export interface SummarySection {
  title: string;
  bullets: string[];
}

export type SummaryTemplateKey =
  | 'overview'
  | 'decisions'
  | 'risks'
  | 'questions'
  | 'commitments'
  | 'actionItems'
  | 'sentiment'
  | 'followUp';

export interface SummaryTemplate {
  key: SummaryTemplateKey;
  label: string;
  description: string;
  /** Stable ordered section titles. */
  sections: string[];
}

export interface MeetingSummary {
  meetingId: string;
  tenantId: string;
  generatedAt: string;
  templateKey: SummaryTemplateKey;
  sections: SummarySection[];
  /** Versioning — every regeneration increments this. */
  version: number;
}

export interface MeetingLink {
  entityType: 'account' | 'contact' | 'lead' | 'opportunity' | 'case';
  entityId: string;
  /** Optional role of the entity in the meeting (host, customer, …). */
  role?: string;
}

export interface FollowUpDraft {
  email: { subject: string; body: string };
  calendarEvent: {
    title: string;
    description: string;
    startAt: string;
    durationMinutes: number;
    attendees: string[];
  };
}

export interface MeetingCorrection {
  id: string;
  meetingId: string;
  tenantId: string;
  field: 'actionItem' | 'summarySection' | 'participant';
  targetId: string;
  before: unknown;
  after: unknown;
  correctedBy: string;
  correctedAt: string;
  reason: string;
}
