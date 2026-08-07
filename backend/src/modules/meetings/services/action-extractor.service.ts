/**
 * Phase 16 — ActionExtractorService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2.
 *
 * Closes CR-AI-0403 — "Action items with owner/due/confidence".
 *
 * Heuristic extractor that turns a transcript + template into typed
 * action items. We do not ship an LLM call in this PR — the
 * heuristic is regex-driven + record-aware:
 *
 *   - sentences ending in "will <verb>" / "should <verb>" → action
 *   - "@name" tokens → owner (the regex returns the first match; the
 *     service flags ambiguousOwner=true when 2+ candidates exist)
 *   - ISO dates / "by Friday" / "next week" → dueDate
 *   - confidencePercent = 60 (heuristic) for regex hits, +10 per
 *     concrete signal (owner + due), capped at 95
 *
 * The Phase 17 PR swaps the heuristic for the production LLM path
 * behind the same interface.
 *
 * SRP — owns ONLY the extract-from-transcript surface. The
 * persistence (write to meeting_action_items) is in
 * CrmLinkerService.
 */

import { Injectable, Logger } from '@nestjs/common';

export class ActionExtractionForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionExtractionForbiddenError';
  }
}

export interface ExtractInput {
  readonly tenantId: string;
  readonly transcriptId: string;
  readonly transcriptText: string;
  readonly participants?: ReadonlyArray<{ name?: string; email?: string }>;
}

/**
 * Legacy envelope — accepts the legacy `MeetingTranscript` shape
 * (which exposes `utterances[]` instead of `transcriptText`). The
 * legacy `meeting.service.ts` calls `extract(transcript)` with that
 * shape.
 */
export interface ExtractInputLegacy {
  readonly tenantId?: string;
  readonly id?: string;
  readonly utterances?: ReadonlyArray<{
    text?: string;
    speaker?: string;
  }>;
  readonly participants?: ReadonlyArray<{ name?: string; email?: string }>;
}

export interface ExtractedActionItem {
  readonly description: string;
  readonly ownerUserId: string | null;
  readonly ownerHint: string | null;
  readonly dueDate: string | null;
  readonly confidencePercent: number;
  readonly ambiguousOwner: boolean;
}

const ACTION_PATTERN =
  /(?:^|\s|@)([A-Z@][A-Za-z0-9@_.-]{0,160}?)\s+(?:will|should|shall|must|need(?:s)?\s+to|is going to|are going to|are scheduled to)\s+([^.!?]{3,160})[.!?]/g;

const ISO_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const DATE_PHRASE_PATTERN = /\b(?:by|on)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|today|next\s+(?:week|month|quarter))\b/i;

@Injectable()
export class ActionExtractorService {
  private readonly logger = new Logger(ActionExtractorService.name);

  extract(input: ExtractInput | ExtractInputLegacy): ReadonlyArray<ExtractedActionItem> {
    const tenantId = input.tenantId;
    if (!tenantId || tenantId === '*') {
      throw new ActionExtractionForbiddenError('tenantId required');
    }

    // Legacy envelope — utterances[] joined into a single transcript
    let transcriptText: string;
    let transcriptId: string;
    let participants = input.participants;

    if ('transcriptText' in input && typeof input.transcriptText === 'string') {
      transcriptText = input.transcriptText;
      transcriptId = (input as ExtractInput).transcriptId;
    } else {
      const legacy = input as ExtractInputLegacy;
      transcriptText = (legacy.utterances ?? [])
        .map((u) => u.text ?? '')
        .filter(Boolean)
        .join(' ');
      transcriptId = legacy.id ?? 'unknown';
    }

    if (!transcriptText || transcriptText.length === 0) {
      return [];
    }

    const items: ExtractedActionItem[] = [];
    const matches = transcriptText.matchAll(ACTION_PATTERN);
    for (const m of matches) {
      const actorRaw = (m[1] ?? '').trim();
      const actionRaw = (m[2] ?? '').trim();
      const description = `${actorRaw}: ${actionRaw}`;

      // Strip any trailing whitespace/colon from the actor — match may
      // have started at whitespace or @ (the non-capturing prefix).
      const actor = actorRaw.replace(/^[\s@:]+/, '');
      // Scan the FULL transcript for owner tokens, not just the partial
      // match — ambiguous ownership only becomes visible across the
      // whole turn (e.g. "@charlie and @dana will close this out.").
      const ownerTokens = Array.from(
        transcriptText.matchAll(/@([A-Za-z][\w._-]{1,40})/g),
      ).map((x) => x[1] ?? '');
      const ambiguous = ownerTokens.length > 1;
      const ownerHint = ownerTokens[0] ?? null;
      void actor;

      const iso = description.match(ISO_DATE_PATTERN)?.[1];
      const phrase = description.match(DATE_PHRASE_PATTERN)?.[0];
      const dueDate = iso ?? phrase ?? null;

      let confidence = 60;
      if (ownerHint) confidence += 10;
      if (dueDate) confidence += 10;
      if (ambiguous) confidence -= 15;
      confidence = Math.max(20, Math.min(95, confidence));

      items.push({
        description,
        ownerUserId: null,
        ownerHint,
        dueDate,
        confidencePercent: confidence,
        ambiguousOwner: ambiguous,
      });
    }

    const seen = new Set<string>();
    void transcriptId; void participants;
    return items.filter((i) => {
      const key = i.description.toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
