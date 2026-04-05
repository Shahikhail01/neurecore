/**
 * RegexPiiDetector
 *
 * SOLID: SRP — Only detects PII via regex; no masking logic.
 * SOLID: OCP — New patterns are added by extending PATTERNS constant only.
 * SOLID: DIP — Implements the abstract IPiiDetector contract.
 */

import { Injectable } from '@nestjs/common';
import type {
  IPiiDetector,
  PiiEntity,
  PiiEntityType,
} from '../interfaces/pii.interfaces';

interface PatternEntry {
  type: PiiEntityType;
  /** Must have the global (`g`) flag set. */
  regex: RegExp;
}

/**
 * Ordered list of patterns.
 * Each regex MUST use the global flag (`g`) so `matchAll` works correctly.
 *
 * Patterns are intentionally conservative to avoid false-positives in
 * legitimate agent conversations.
 */
const PATTERNS: readonly PatternEntry[] = [
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: 'PHONE_US',
    // Matches  +1 (555) 867-5309  |  555-867-5309  |  5558675309
    regex: /(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    type: 'SSN',
    // 123-45-6789  |  123 45 6789
    regex: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
  },
  {
    type: 'CREDIT_CARD',
    // 4-4-4-4 groups, optionally separated by space or dash
    regex: /\b(?:\d{4}[-\s]){3}\d{4}\b/g,
  },
  {
    type: 'IP_ADDRESS',
    regex:
      /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
] as const;

@Injectable()
export class RegexPiiDetector implements IPiiDetector {
  /**
   * Run all patterns against `text` and return every match as a
   * `PiiEntity`.  Overlapping matches are possible when multiple types
   * appear in close proximity; the masker should handle them in
   * reverse-index order.
   */
  detect(text: string): PiiEntity[] {
    const entities: PiiEntity[] = [];

    for (const entry of PATTERNS) {
      // Clone regex to reset lastIndex for each call.
      const re = new RegExp(entry.regex.source, entry.regex.flags);
      for (const match of text.matchAll(re)) {
        const value = match[0];
        const start = match.index ?? 0;
        entities.push({
          type: entry.type,
          value,
          start,
          end: start + value.length,
        });
      }
    }

    return entities;
  }
}
