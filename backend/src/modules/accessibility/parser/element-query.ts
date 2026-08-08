/**
 * Phase 29 — Element query helpers (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Pure, dependency-free predicates shared by every rule so no rule
 * re-implements attribute lookup or accessible-name detection.
 *
 * SOLID
 *   SRP — owns ONLY element interrogation. No WCAG policy lives here;
 *         a rule decides what a missing name *means*.
 *   DIP — pure functions over the `A11yElement` value object.
 */

import type { A11yAttribute, A11yElement } from '../interfaces/IA11yRule';

/** Native HTML tags are lowercase; React components are capitalised. */
export function isHtmlTag(element: A11yElement): boolean {
  const first = element.tag.charAt(0);
  return first === first.toLowerCase() && first !== first.toUpperCase();
}

export function attributeOf(
  element: A11yElement,
  name: string,
): A11yAttribute | null {
  return element.attributes.get(name) ?? null;
}

export function hasAttribute(element: A11yElement, name: string): boolean {
  return element.attributes.has(name);
}

export function hasAnyAttribute(
  element: A11yElement,
  names: ReadonlyArray<string>,
): boolean {
  return names.some((n) => element.attributes.has(n));
}

/**
 * Literal text of an attribute, or null when the attribute is absent
 * or written as an expression whose value cannot be known statically.
 */
export function literalValue(
  element: A11yElement,
  name: string,
): string | null {
  const attr = attributeOf(element, name);
  if (!attr || attr.value === null) return null;
  if (!attr.expression) return attr.value;
  const trimmed = attr.value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  return quoted ? (quoted[2] ?? null) : null;
}

/**
 * True when the attribute is present and is NOT a statically-known
 * empty string. An expression counts as "provided" because the audit
 * cannot prove it empty, and flagging it would produce false
 * positives that erode trust in the gate.
 */
export function providesValue(element: A11yElement, name: string): boolean {
  const attr = attributeOf(element, name);
  if (!attr) return false;
  if (attr.value === null) return false;
  if (attr.expression) return attr.value.trim().length > 0;
  return attr.value.trim().length > 0;
}

/** Any of the standard ways an element can carry an accessible name. */
export const ACCESSIBLE_NAME_ATTRIBUTES: ReadonlyArray<string> = [
  'aria-label',
  'aria-labelledby',
  'title',
];

export function hasAccessibleNameAttribute(element: A11yElement): boolean {
  return ACCESSIBLE_NAME_ATTRIBUTES.some((n) => providesValue(element, n));
}

/** React keyboard handlers that make a click target operable by keyboard. */
export const KEYBOARD_HANDLERS: ReadonlyArray<string> = [
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
];

/** ARIA roles that explicitly strip an element of all semantics. */
export const PRESENTATIONAL_ROLES: ReadonlyArray<string> = [
  'presentation',
  'none',
];

/**
 * True when the author has explicitly declared the element invisible
 * to assistive technology (`aria-hidden`) or semantically empty
 * (`role="presentation"` / `role="none"`).
 *
 * Such an element is not an accessibility target, so name and
 * keyboard rules must not report it — flagging it would force authors
 * to add meaningless ARIA to decorative wrappers and would erode
 * trust in the audit.
 */
export function isAriaExempt(element: A11yElement): boolean {
  const hidden = attributeOf(element, 'aria-hidden');
  if (
    hidden &&
    (hidden.value ?? 'true').trim().replace(/['"]/g, '') !== 'false'
  ) {
    return true;
  }
  const role = literalValue(element, 'role');
  return role !== null && PRESENTATIONAL_ROLES.includes(role);
}

/** Space-separated class tokens of `className="…"`, or an empty list. */ export function classTokens(
  element: A11yElement,
): ReadonlyArray<string> {
  const literal = literalValue(element, 'className');
  if (literal !== null) return literal.split(/\s+/).filter(Boolean);
  const attr = attributeOf(element, 'className');
  if (!attr || attr.value === null) return [];
  // Expression form: harvest every quoted string literal inside it so
  // `cn('h-4 w-4', cond && 'p-2')` is still analysable.
  const tokens: string[] = [];
  const re = /(['"`])([^'"`]*)\1/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attr.value)) !== null) {
    tokens.push(...(match[2] ?? '').split(/\s+/).filter(Boolean));
  }
  return tokens;
}

/** Numeric value of a Tailwind size token such as `h-4` → 4. */
export function tailwindScale(
  tokens: ReadonlyArray<string>,
  prefix: string,
): number | null {
  for (const token of tokens) {
    const match = new RegExp(`^${prefix}-(\\d+(?:\\.\\d+)?)$`).exec(token);
    if (match) return Number(match[1]);
  }
  return null;
}
