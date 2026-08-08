/**
 * Phase 29 — JSX source parser (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Turns a `.tsx` source string into a typed `A11ySourceDocument` —
 * a flat, ordered list of JSX element occurrences with their
 * attributes and 1-based line numbers.
 *
 * The scanner is deliberately hand-rolled (no TypeScript compiler
 * dependency) so the audit runs in milliseconds over thousands of
 * files in CI, exactly like `detect-route-duplication.ts` and
 * `detect-wildcard-tenant-bypass.ts`.
 *
 * It is expression-aware: `>` inside `onClick={() => a > b}` and
 * inside string literals never terminates a tag, and nested elements
 * written inside attribute expressions (`icon={<Check />}`) are still
 * discovered because the cursor re-enters the attribute region.
 *
 * SOLID
 *   SRP — owns ONLY lexical parsing. It applies no WCAG semantics.
 *   LSP — implements `IJsxSourceParser`; any other parser (e.g. a
 *         ts-morph backed one) can substitute it.
 *   DIP — rules and the runner depend on the produced value object,
 *         never on this class.
 */

import { Injectable } from '@nestjs/common';
import type {
  A11yAttribute,
  A11yElement,
  A11ySourceDocument,
} from '../interfaces/IA11yRule';

export interface IJsxSourceParser {
  parse(path: string, source: string): A11ySourceDocument;
}

const TAG_NAME_START = /[A-Za-z]/;
const TAG_NAME_BODY = /[A-Za-z0-9_.:-]/;
const ATTR_NAME_START = /[A-Za-z_]/;
const ATTR_NAME_BODY = /[A-Za-z0-9_:.-]/;

@Injectable()
export class JsxSourceParser implements IJsxSourceParser {
  parse(path: string, source: string): A11ySourceDocument {
    const elements: A11yElement[] = [];
    const scannable = this.blankComments(source);
    const len = scannable.length;
    let index = 0;
    let line = 1;

    while (index < len) {
      const ch = scannable.charAt(index);
      if (ch === '\n') {
        line += 1;
        index += 1;
        continue;
      }
      if (ch !== '<') {
        index += 1;
        continue;
      }
      const next = scannable.charAt(index + 1);
      if (!next || !TAG_NAME_START.test(next)) {
        index += 1;
        continue;
      }

      let cursor = index + 1;
      while (cursor < len && TAG_NAME_BODY.test(scannable.charAt(cursor))) {
        cursor += 1;
      }
      const tag = scannable.slice(index + 1, cursor);
      const close = this.findTagEnd(scannable, cursor);
      if (close < 0) {
        // Not a tag (e.g. a `a < b` comparison). Skip the `<` only, so
        // the remainder of the document is still scanned.
        index += 1;
        continue;
      }
      const attrRegion = scannable.slice(cursor, close);
      const selfClosing = attrRegion.trimEnd().endsWith('/');
      elements.push({
        tag,
        line,
        selfClosing,
        attributes: this.parseAttributes(attrRegion),
      });

      // Re-enter the attribute region so nested elements written inside
      // attribute expressions are discovered and line numbers stay exact.
      index = cursor;
    }

    return { path, source, elements };
  }

  /**
   * Replace the body of `//` and block comments with spaces, keeping
   * every newline so line numbers are preserved exactly. Quoted and
   * template strings are never treated as comments, so a URL such as
   * `"https://x"` survives intact.
   *
   * Without this pass, prose that mentions markup — `<html class="…">`
   * inside a JSDoc block — would be reported as a real violation.
   */
  private blankComments(source: string): string {
    const out = source.split('');
    const len = source.length;
    let cursor = 0;
    let quote: string | null = null;

    while (cursor < len) {
      const ch = source.charAt(cursor);
      if (quote !== null) {
        if (ch === '\\') {
          cursor += 2;
          continue;
        }
        if (ch === quote) quote = null;
        cursor += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        cursor += 1;
        continue;
      }
      const pair = source.slice(cursor, cursor + 2);
      if (pair === '//') {
        while (cursor < len && source.charAt(cursor) !== '\n') {
          out[cursor] = ' ';
          cursor += 1;
        }
        continue;
      }
      if (pair === '/*') {
        while (cursor < len && source.slice(cursor, cursor + 2) !== '*/') {
          if (source.charAt(cursor) !== '\n') out[cursor] = ' ';
          cursor += 1;
        }
        out[cursor] = ' ';
        out[cursor + 1] = ' ';
        cursor += 2;
        continue;
      }
      cursor += 1;
    }
    return out.join('');
  }

  /**
   * Index of the `>` that closes the tag opened at `from`, or -1.
   * Brace depth and quoting are tracked so expressions never confuse
   * the scan.
   */
  private findTagEnd(source: string, from: number): number {
    const len = source.length;
    let depth = 0;
    let quote: string | null = null;
    let cursor = from;

    while (cursor < len) {
      const ch = source.charAt(cursor);
      if (quote !== null) {
        if (ch === '\\') {
          cursor += 2;
          continue;
        }
        if (ch === quote) quote = null;
        cursor += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        cursor += 1;
        continue;
      }
      if (ch === '{') {
        depth += 1;
        cursor += 1;
        continue;
      }
      if (ch === '}') {
        if (depth > 0) depth -= 1;
        cursor += 1;
        continue;
      }
      if (ch === '>' && depth === 0) return cursor;
      cursor += 1;
    }
    return -1;
  }

  /** Parse `name`, `name="v"`, `name='v'` and `name={expr}` pairs. */
  private parseAttributes(region: string): ReadonlyMap<string, A11yAttribute> {
    const attributes = new Map<string, A11yAttribute>();
    const len = region.length;
    let cursor = 0;

    while (cursor < len) {
      const ch = region.charAt(cursor);
      if (!ATTR_NAME_START.test(ch)) {
        cursor += 1;
        continue;
      }
      let end = cursor;
      while (end < len && ATTR_NAME_BODY.test(region.charAt(end))) end += 1;
      const name = region.slice(cursor, end);

      let probe = end;
      while (probe < len && /\s/.test(region.charAt(probe))) probe += 1;
      if (region.charAt(probe) !== '=') {
        this.put(attributes, { name, value: null, expression: false });
        cursor = end;
        continue;
      }

      probe += 1;
      while (probe < len && /\s/.test(region.charAt(probe))) probe += 1;
      const opener = region.charAt(probe);
      if (opener === '"' || opener === "'") {
        const closeIdx = region.indexOf(opener, probe + 1);
        if (closeIdx < 0) break;
        this.put(attributes, {
          name,
          value: region.slice(probe + 1, closeIdx),
          expression: false,
        });
        cursor = closeIdx + 1;
        continue;
      }
      if (opener === '{') {
        const closeIdx = this.matchBrace(region, probe);
        if (closeIdx < 0) break;
        this.put(attributes, {
          name,
          value: region.slice(probe + 1, closeIdx).trim(),
          expression: true,
        });
        cursor = closeIdx + 1;
        continue;
      }
      // Malformed attribute — record presence only and move on.
      this.put(attributes, { name, value: null, expression: false });
      cursor = probe + 1;
    }

    return attributes;
  }

  /** Index of the `}` matching the `{` at `from`, or -1. */
  private matchBrace(region: string, from: number): number {
    const len = region.length;
    let depth = 0;
    let quote: string | null = null;
    let cursor = from;

    while (cursor < len) {
      const ch = region.charAt(cursor);
      if (quote !== null) {
        if (ch === '\\') {
          cursor += 2;
          continue;
        }
        if (ch === quote) quote = null;
        cursor += 1;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        cursor += 1;
        continue;
      }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) return cursor;
      }
      cursor += 1;
    }
    return -1;
  }

  /** First occurrence wins — JSX evaluates duplicates left-to-right. */
  private put(target: Map<string, A11yAttribute>, attr: A11yAttribute): void {
    if (!target.has(attr.name)) target.set(attr.name, attr);
  }
}
