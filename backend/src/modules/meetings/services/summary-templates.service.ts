/**
 * Summary templates service — typed catalogue of configurable meeting
 * summary templates (P3).
 *
 * Eight first-class templates cover the Creatio surface:
 *   overview, decisions, risks, questions, commitments,
 *   actionItems, sentiment, followUp.
 *
 * Each template is a typed object; consumers can supply a custom
 * template by passing a {@link SummaryTemplate} to
 * {@link SummaryTemplatesService.render}.
 */
import { Injectable } from '@nestjs/common';
import type {
  SummaryTemplate,
  SummaryTemplateKey,
  SummarySection,
  MeetingTranscript,
} from '../schemas/meeting.types';

const DEFAULT_TEMPLATES: Record<SummaryTemplateKey, SummaryTemplate> = {
  overview: {
    key: 'overview',
    label: 'Overview',
    description:
      'High-level summary of meeting purpose, attendees and outcomes.',
    sections: ['Purpose', 'Attendees', 'Key Outcomes'],
  },
  decisions: {
    key: 'decisions',
    label: 'Decisions',
    description: 'Decisions taken during the meeting, with attribution.',
    sections: ['Decisions Made', 'Owners', 'Rationale'],
  },
  risks: {
    key: 'risks',
    label: 'Risks',
    description: 'Identified risks and open issues.',
    sections: ['Identified Risks', 'Likelihood', 'Mitigations'],
  },
  questions: {
    key: 'questions',
    label: 'Questions',
    description: 'Open questions raised during the meeting.',
    sections: ['Open Questions', 'Assigned To', 'Deadline'],
  },
  commitments: {
    key: 'commitments',
    label: 'Commitments',
    description: 'Explicit commitments made by participants.',
    sections: ['Commitment', 'Owner', 'Due Date'],
  },
  actionItems: {
    key: 'actionItems',
    label: 'Action Items',
    description: 'Concrete action items with owners and due dates.',
    sections: ['Action', 'Owner', 'Due Date', 'Confidence'],
  },
  sentiment: {
    key: 'sentiment',
    label: 'Sentiment',
    description: 'Customer / participant sentiment observed.',
    sections: ['Overall Sentiment', 'Concerns', 'Positives'],
  },
  followUp: {
    key: 'followUp',
    label: 'Follow-up',
    description: 'Suggested follow-up email and calendar event content.',
    sections: ['Email Subject', 'Email Body', 'Calendar Event'],
  },
};

@Injectable()
export class SummaryTemplatesService {
  /** Built-in templates — copy before mutation. */
  list(): SummaryTemplate[] {
    return Object.values(DEFAULT_TEMPLATES).map((t) => ({
      ...t,
      sections: [...t.sections],
    }));
  }

  get(key: SummaryTemplateKey): SummaryTemplate {
    const t = DEFAULT_TEMPLATES[key];
    return { ...t, sections: [...t.sections] };
  }

  /**
   * Render an empty structure for `template` — used by the summary
   * service to build a typed skeleton that downstream extractors
   * populate. Sections are returned in the order declared by the
   * template.
   */
  renderSkeleton(
    transcript: MeetingTranscript,
    templateKey: SummaryTemplateKey,
  ): SummarySection[] {
    const t = this.get(templateKey);
    return t.sections.map((title) => ({
      title,
      bullets: [
        `(${transcript.participants.length} participants, ${transcript.utterances.length} utterances)]`,
      ],
    }));
  }
}
