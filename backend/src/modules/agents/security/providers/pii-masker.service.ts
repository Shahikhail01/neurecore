/**
 * PiiMaskerService
 *
 * SOLID: SRP — Replaces detected PII tokens with type-labelled placeholders.
 * SOLID: DIP — Implements the abstract IPiiMasker contract, has no knowledge of
 *              how detection was performed.
 *
 * Masking strategy: redact from end-to-start so that previously computed
 * character indices remain valid as we mutate the string.
 */

import { Injectable } from '@nestjs/common';
import type { IPiiMasker, PiiEntity } from '../interfaces/pii.interfaces';

@Injectable()
export class PiiMaskerService implements IPiiMasker {
  /**
   * Replace every entity in `entities` with `[REDACTED:<TYPE>]`.
   *
   * Processes replacements in reverse order (highest `start` index first) to
   * keep earlier indices valid throughout the operation.
   */
  mask(text: string, entities: PiiEntity[]): string {
    if (entities.length === 0) return text;

    // Sort descending by start so we replace from the end of the string first.
    const sorted = [...entities].sort((a, b) => b.start - a.start);

    let result = text;
    for (const entity of sorted) {
      const placeholder = `[REDACTED:${entity.type}]`;
      result =
        result.slice(0, entity.start) + placeholder + result.slice(entity.end);
    }

    return result;
  }
}
