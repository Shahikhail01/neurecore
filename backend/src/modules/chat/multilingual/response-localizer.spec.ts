/**
 * Phase 15 — ResponseLocalizer.
 */

import { ResponseLocalizer } from './response-localizer';

describe('Phase 15 — ResponseLocalizer', () => {
  const svc = new ResponseLocalizer();

  it('negotiates the actor-supplied targetLocale first', () => {
    expect(svc.negotiate('es', 'en;q=0.9')).toBe('es');
  });

  it('parses Accept-Language when targetLocale is empty', () => {
    expect(svc.negotiate(undefined, 'fr-FR;q=0.9,en;q=0.8')).toBe('fr');
    expect(svc.negotiate(undefined, 'en-US')).toBe('en');
  });

  it('falls back to en when nothing parseable', () => {
    expect(svc.negotiate(undefined, '')).toBe('en');
    expect(svc.negotiate(undefined, undefined)).toBe('en');
  });

  it('extracts emails, currency tokens, and ISO dates', () => {
    const text =
      'Hi alice@example.com — confirm $5,000 by 2026-08-06. Backup: bob@example.com.';
    const out = svc.extract(text);
    const kinds = new Set(out.map((e) => e.kind));
    expect(kinds.has('email')).toBe(true);
    expect(kinds.has('currency')).toBe(true);
    expect(kinds.has('date')).toBe(true);
  });

  it('returns a LocalizationResult that preserves entities verbatim', () => {
    const out = svc.localize(
      'See alice@example.com — $5,000 by 2026-08-06.',
      { targetLocale: 'es' },
    );
    // The localizer extracts via regex; check the three entity kinds
    // are present somewhere in preservedEntities.
    expect(out.preservedEntities).toEqual(
      expect.arrayContaining([
        'alice@example.com',
        '2026-08-06',
      ]),
    );
    expect(out.preservedEntities.some((r) => /\$5,000/.test(r))).toBe(true);
    expect(out.detectedLocale).toBe('es');
  });

  it('produces a clean system-instruction fragment', () => {
    const txt = svc.systemInstruction();
    expect(txt).toContain('Preserve verbatim');
    expect(txt).toContain('ISO form');
    expect(txt).toContain('currency tokens');
  });
});
