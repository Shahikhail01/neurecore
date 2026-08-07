/**
 * Phase 15 — PageContext unit tests.
 */

import {
  SUPPORTED_ENTITY_TYPES,
  PageContextDto,
  asPageContextShape,
  validatePageContext,
} from './page-context.dto';

describe('Phase 15 — PageContext validation', () => {
  const base = {
    entityType: 'customer',
    entityId: 'c-1',
  };

  it('accepts the baseline shape', () => {
    expect(validatePageContext(base)).toEqual(base);
  });

  it('rejects unknown entityType', () => {
    const bad = { entityType: 'transcript', entityId: 't-1' };
    expect(validatePageContext(bad)).toBeNull();
  });

  it('rejects missing id', () => {
    expect(
      validatePageContext({ entityType: 'customer' }),
    ).toBeNull();
  });

  it('accepts every supported entityType', () => {
    for (const t of SUPPORTED_ENTITY_TYPES) {
      expect(
        asPageContextShape({ entityType: t, entityId: 'id-1' }),
      ).toEqual({ entityType: t, entityId: 'id-1' });
    }
  });

  it('rejects non-string entityType / entityId', () => {
    expect(validatePageContext({ entityType: 1, entityId: 'c' })).toBeNull();
    expect(validatePageContext({ entityType: 'customer', entityId: 1 })).toBeNull();
    expect(validatePageContext(null)).toBeNull();
    expect(validatePageContext('not an object')).toBeNull();
  });

  it('keeps optional fields only when present', () => {
    const withExtras = {
      ...base,
      fields: [{ name: 'industry', value: 'finance' }],
      locale: 'en',
      timezone: 'America/New_York',
      allowedActions: ['draft-email'],
    };
    const out = validatePageContext(withExtras);
    expect(out?.fields).toHaveLength(1);
    expect(out?.locale).toBe('en');
    expect(out?.allowedActions).toContain('draft-email');
  });

  it('parses the dto class through `validatePageContext` correctly', () => {
    const dto = Object.assign(new PageContextDto(), base);
    expect(validatePageContext(dto)).toEqual({
      entityType: 'customer',
      entityId: 'c-1',
    });
  });
});
