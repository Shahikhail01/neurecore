/**
 * MatchMediaViewportDetector — Phase 28 (P28) — CR-AI-1107.
 *
 * Browser-side viewport detector backed by `window.matchMedia`.
 * Defines the breakpoints:
 *   - < 768px  → mobile
 *   - < 1024px → tablet
 *   - ≥ 1024px → desktop
 *
 * SOLID:
 *   SRP — only owns the viewport classification.
 *   DIP — implements `IViewportDetector`; consumers depend on the
 *         interface, not on `window`.
 */
import type { IViewportDetector } from './viewport-detector';
import type { MobileViewport } from './mobile-matrix';

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

export class MatchMediaViewportDetector implements IViewportDetector {
  private readonly mql: MediaQueryList | null;

  constructor(win: { matchMedia: (q: string) => MediaQueryList } | null = typeof window !== 'undefined' ? window : null) {
    this.mql = win ? win.matchMedia('(max-width: 767px)') : null;
  }

  current(): MobileViewport {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width <= MOBILE_MAX) return 'mobile';
    if (width <= TABLET_MAX) return 'tablet';
    return 'desktop';
  }

  subscribe(listener: (next: MobileViewport) => void): () => void {
    if (!this.mql || typeof this.mql.addEventListener !== 'function') {
      return () => undefined;
    }
    const onChange = () => listener(this.current());
    this.mql.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      this.mql?.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }
}

export const VIEWPORT_BREAKPOINTS = {
  mobileMax: MOBILE_MAX,
  tabletMax: TABLET_MAX,
} as const;
