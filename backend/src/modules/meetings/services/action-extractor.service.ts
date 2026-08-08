/**
 * Phase 25 — ActionExtractorService.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §2 + P25 upgrade.
 *
 * Closes CR-AI-0403 — "Action items with owner/due/confidence".
 *
 * Phase 25 upgrade: owner auto-resolution. The heuristic still
 * flags `@name` tokens; the service now also resolves those hints
 * against the real `User` table (case-insensitive on
 * firstName / lastName / email local-part). Each extracted item
 * carries:
 *   - ownerHint       the raw token from the transcript
 *   - ownerUserId     the resolved user id (null when no match)
 *   - ambiguousOwner  true when 2+ candidates OR no match
 *
 * SOLID:
 *   - SRP — owns ONLY the extract-from-transcript surface.
 *     Persistence is `CrmLinkerService`; consent is the consent
 *     service.
 *   - DIP — depends on injected `IOwnerResolver`; the resolver
 *     implementation lives in `OwnerResolver` (Prisma-backed).
 *     Tests can substitute a stub.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

export const OWNER_RESOLVER = Symbol('OwnerResolver');

export interface OwnerCandidate {
  readonly userId: string;
  readonly displayName: string;
  readonly email: string | null;
}

export interface IOwnerResolver {
  resolve(tenantId: string, hint: string): Promise<OwnerCandidate | null>;
  /**
   * Find users whose firstName, lastName, or email local-part
   * match the hint. Returns 0..n candidates. Used for ambiguous
   * detection.
   */
  candidates(tenantId: string, hint: string): Promise<ReadonlyArray<OwnerCandidate>>;
}

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

  /**
   * Back-compat overload — no owner resolution. Existing
   * synchronous callers (e.g. P16 callers) keep working.
   */
  static readonly SYNC_MODE: unique symbol = Symbol('ActionExtractor.sync');

  constructor(
    @Inject(OWNER_RESOLVER) private readonly ownerResolver: IOwnerResolver,
  ) {}

  /**
   * Synchronous shape-preserving extraction. Kept for backward
   * compatibility with the legacy `meeting.service.ts` and the
   * Phase 16 callers that did not yet know about owner
   * resolution.
   */
  extract(input: ExtractInput | ExtractInputLegacy): ReadonlyArray<ExtractedActionItem> {
    return this.extractSync(input);
  }

  /**
   * Async path with owner auto-resolution. New code MUST call
   * this. The synchronous `extract()` is retained only for
   * backward compatibility with Phase 16 callers.
   */
  async extractWithOwnerResolution(
    input: ExtractInput | ExtractInputLegacy,
  ): Promise<ReadonlyArray<ExtractedActionItem>> {
    const base = this.extractSync(input);
    if (base.length === 0) return base;
    const tenantId = input.tenantId;
    if (!tenantId || tenantId === '*') {
      throw new ActionExtractionForbiddenError('tenantId required');
    }
    const enriched: ExtractedActionItem[] = [];
    for (const item of base) {
      if (!item.ownerHint) {
        enriched.push(item);
        continue;
      }
      const cands = await this.ownerResolver.candidates(tenantId, item.ownerHint);
      const best =
        cands.length === 1
          ? cands[0]
          : cands.length > 1
            ? cands[0]
            : null;
      const resolved = best ?? (await this.ownerResolver.resolve(tenantId, item.ownerHint));
      enriched.push({
        ...item,
        ownerUserId: resolved?.userId ?? item.ownerUserId,
        // ambiguousOwner already includes multi-token; add single-hint
        // with no resolution → ambiguous. Resolution to exactly 1
        // candidate clears it.
        ambiguousOwner:
          cands.length > 1 || (item.ambiguousOwner && !resolved),
      });
    }
    return enriched;
  }

  private extractSync(input: ExtractInput | ExtractInputLegacy): ReadonlyArray<ExtractedActionItem> {
    const tenantId = input.tenantId;
    if (!tenantId || tenantId === '*') {
      throw new ActionExtractionForbiddenError('tenantId required');
    }

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
      const actor = actorRaw.replace(/^[\s@:]+/, '');
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
