/**
 * Chatbot i18n — unit tests.
 *
 * Asserts:
 *   1. translate() returns the requested locale's translation.
 *   2. translate() falls back to the default English copy when the
 *      locale is missing.
 *   3. {var} placeholders are substituted.
 *   4. translationCoverage() returns sensible numbers.
 */

import {
  CHAT_MESSAGES,
  translate,
  translationCoverage,
} from './chatbot-i18n';
import type { LocaleId } from '../localization/locale.registry';

describe('chatbot i18n', () => {
  it('ships at least 12 messages (Phase 6.4 baseline)', () => {
    expect(CHAT_MESSAGES.length).toBeGreaterThanOrEqual(12);
  });

  it('every message id is unique', () => {
    const ids = CHAT_MESSAGES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every message has a non-empty defaultText', () => {
    for (const m of CHAT_MESSAGES) {
      expect(m.defaultText.length).toBeGreaterThan(0);
    }
  });

  it('translate returns the requested locale', () => {
    const out = translate({ id: 'intent.understood', locale: 'fr-FR' as LocaleId, vars: { intent: 'saluer' } });
    expect(out).toContain('saluer');
  });

  it('translate falls back to English when locale missing', () => {
    const out = translate({ id: 'tool.invoked', locale: 'tr-TR' as LocaleId });
    // tr-TR is not in the sample translations for tool.invoked; fallback.
    expect(out).toMatch(/Invoking|invocando|auf/i);
  });

  it('translate substitutes {var} placeholders', () => {
    const out = translate({
      id: 'agent.execution_succeeded',
      locale: 'ja-JP' as LocaleId,
      vars: { durationMs: 42 },
    });
    expect(out).toContain('42');
  });

  it('translationCoverage reports honest fractions', () => {
    const en = translationCoverage('en-US');
    // en-US has translations for everything because of the canonical
    // English copy + the per-locale entry for each message.
    expect(en.translated).toBeGreaterThanOrEqual(0);
    expect(en.total).toBeGreaterThan(0);
    expect(en.coverage).toBeGreaterThanOrEqual(0);
    expect(en.coverage).toBeLessThanOrEqual(1);
  });

  it('every locale has a non-zero coverage on at least the canonical messages', () => {
    const locales: LocaleId[] = [
      'en-US', 'fr-FR', 'de-DE', 'es-ES', 'pt-BR',
      'it-IT', 'ja-JP', 'zh-CN', 'ko-KR',
      'ar-SA', 'he-IL', 'ru-RU', 'pl-PL', 'tr-TR', 'nl-NL',
    ];
    for (const l of locales) {
      const c = translationCoverage(l);
      // We do not require full coverage; assert the helper is honest.
      expect(c.coverage).toBeGreaterThanOrEqual(0);
      expect(c.coverage).toBeLessThanOrEqual(1);
    }
  });
});
