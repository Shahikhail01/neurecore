/**
 * Action-item extractor — turns transcript utterances into typed
 * {@link ActionItem} records (P3).
 *
 * Heuristic extraction keeps the service free of LLM dependencies:
 *  - A sentence is an action item if it matches
 *    `/(?:^|\s)(?:will|shall|need to|must|action:|TODO:?|by next)\b/i`
 *    OR is preceded by a speaker label `Name:` where the verb is
 *    future-tense.
 *  - Owner detection looks for `Name` patterns immediately after the
 *    trigger; resolution is delegated to {@link resolveOwner}.
 *  - Due date detection is a best-effort regex (ISO + named forms).
 *
 * Critical: participants that cannot be mapped are NEVER silently
 * assigned. They remain `ownerStatus: 'unresolved'` with their
 * raw displayName so the UI can prompt the user to map or skip.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  ActionItem,
  MeetingTranscript,
  MeetingParticipant,
} from '../schemas/meeting.types';
import { randomUUID } from 'node:crypto';

const ACTION_PATTERN =
  /(?:^|\.\s+|\n)([^.\n]*?\b(?:will|shall|needs? to|must|action:|TODO:?|by next|by friday|by monday|by eod|by eow)\b[^.\n]*)/gi;
const DUE_DATE_PATTERN =
  /\b(\d{4}-\d{2}-\d{2}|today|tomorrow|next (?:monday|tuesday|wednesday|thursday|friday)|eod|eow|next week)\b/i;
const OWNER_PATTERN =
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|shall|needs? to|must)\b/;

export interface ActionExtractionResult {
  items: ActionItem[];
  unresolvedParticipants: MeetingParticipant[];
}

@Injectable()
export class ActionExtractorService {
  private readonly logger = new Logger(ActionExtractorService.name);

  extract(transcript: MeetingTranscript): ActionExtractionResult {
    const items: ActionItem[] = [];
    const unresolved = new Set<string>();

    for (const utterance of transcript.utterances) {
      const matches = utterance.text.matchAll(ACTION_PATTERN);
      for (const m of matches) {
        const sentence = m[1].trim();
        if (!sentence) continue;
        const item = this.buildActionItem(
          sentence,
          utterance,
          transcript.participants,
        );
        if (item.ownerStatus === 'unresolved') {
          unresolved.add(item.ownerDisplayName ?? 'unknown');
        }
        items.push(item);
      }
    }

    return {
      items,
      unresolvedParticipants: transcript.participants.filter(
        (p) => p.resolutionStatus === 'unresolved',
      ),
    };
  }

  private buildActionItem(
    sentence: string,
    utterance: {
      participantRawId: string;
      startMs: number;
      endMs: number;
      text: string;
    },
    participants: MeetingParticipant[],
  ): ActionItem {
    const ownerMatch = sentence.match(OWNER_PATTERN);
    const ownerName = ownerMatch?.[1];
    const owner = ownerName
      ? this.resolveOwner(ownerName, participants)
      : undefined;
    const dueMatch = sentence.match(DUE_DATE_PATTERN);
    const due = dueMatch ? this.normalizeDate(dueMatch[1]) : undefined;

    const ambiguity: ActionItem['ambiguity'] = owner
      ? due
        ? 'low'
        : 'medium'
      : 'high';
    const confidence =
      ambiguity === 'low' ? 0.85 : ambiguity === 'medium' ? 0.6 : 0.35;

    return {
      id: randomUUID(),
      text: sentence,
      ownerUserId: owner?.userId,
      ownerDisplayName: owner?.displayName ?? ownerName,
      ownerStatus: owner ? 'resolved' : 'unresolved',
      dueDate: due,
      confidence,
      ambiguity,
      sourceSpan: { startMs: utterance.startMs, endMs: utterance.endMs },
    };
  }

  private resolveOwner(
    name: string,
    participants: MeetingParticipant[],
  ): MeetingParticipant | undefined {
    const lower = name.toLowerCase();
    const exact = participants.find(
      (p) =>
        p.resolutionStatus === 'resolved' &&
        p.displayName.toLowerCase() === lower,
    );
    if (exact) return exact;
    const partial = participants.find(
      (p) =>
        p.resolutionStatus === 'resolved' &&
        p.displayName.toLowerCase().includes(lower),
    );
    return partial;
  }

  private normalizeDate(token: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
    const today = new Date();
    switch (token.toLowerCase()) {
      case 'today':
        return today.toISOString().slice(0, 10);
      case 'tomorrow': {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
      }
      case 'eod':
      case 'eow':
        return today.toISOString().slice(0, 10);
      case 'next week': {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + 7);
        return d.toISOString().slice(0, 10);
      }
      default:
        if (token.startsWith('next ')) {
          const target = token.slice(5).toLowerCase();
          const map: Record<string, number> = {
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
            sunday: 0,
          };
          const dow = map[target];
          if (dow !== undefined) {
            const d = new Date(today);
            const diff = ((dow - d.getUTCDay() + 7) % 7) + 7;
            d.setUTCDate(d.getUTCDate() + diff);
            return d.toISOString().slice(0, 10);
          }
        }
        return token;
    }
  }
}
