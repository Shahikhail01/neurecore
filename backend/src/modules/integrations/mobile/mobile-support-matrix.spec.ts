import {
  MOBILE_SUPPORT_MATRIX_V1,
  mobileSupportFor,
} from './mobile-support-matrix';

describe('Phase 20 — MobileSupportMatrix (CR-AI-1107)', () => {
  it('declares the platform + version', () => {
    expect(MOBILE_SUPPORT_MATRIX_V1.platform).toBe('web-mobile');
    expect(typeof MOBILE_SUPPORT_MATRIX_V1.version).toBe('string');
    expect(MOBILE_SUPPORT_MATRIX_V1.actions.length).toBeGreaterThan(0);
  });

  it('chat send + skill invoke are supported on mobile', () => {
    expect(
      mobileSupportFor(MOBILE_SUPPORT_MATRIX_V1, 'send-chat-message')?.status,
    ).toBe('SUPPORTED');
    expect(
      mobileSupportFor(MOBILE_SUPPORT_MATRIX_V1, 'invoke-skill')?.status,
    ).toBe('SUPPORTED');
  });

  it('forecast drilldown is desktop-only', () => {
    const out = mobileSupportFor(MOBILE_SUPPORT_MATRIX_V1, 'view-forecast');
    expect(out?.status).toBe('UNSUPPORTED');
    expect(out?.minimumViewport).toBe('desktop');
  });

  it('returns undefined for unknown actions', () => {
    expect(
      mobileSupportFor(
        MOBILE_SUPPORT_MATRIX_V1,
        'no-such-action' as never,
      ),
    ).toBeUndefined();
  });

  it('every action carries a minimumViewport', () => {
    for (const a of MOBILE_SUPPORT_MATRIX_V1.actions) {
      expect(['mobile', 'tablet', 'desktop']).toContain(a.minimumViewport);
    }
  });
});
