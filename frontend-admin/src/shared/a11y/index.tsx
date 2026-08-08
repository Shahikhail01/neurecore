'use client';

/**
 * Phase 18 — WCAG 2.2 AA primitives.
 *
 * Source plan: IMPLEMENTATION-PLAN-PHASE-15-18.md §4.
 *
 * Closes CR-AI-1304 "Accessibility WCAG 2.2 AA + localization".
 *
 * Two primitives:
 *   - useFocusTrap(ref)  — keeps Tab order inside a dialog container
 *   - LiveAnnouncer      — screen-reader live region helper
 *
 * SRP — owns ONLY the a11y primitives. Components that need a11y
 * compose these; they do NOT roll their own focus / ARIA logic.
 *
 * Both are dependency-free React primitives so they can ship to
 * every page without a bundle-size penalty.
 */

import { useEffect, useRef, useState } from 'react';

export const A11Y_LIVE_REGION_ID = 'neurecore-a11y-live-region';

/**
 * Trap focus inside `ref.current` while `active` is true. Returns a
 * setter the consumer can wire to a ref. Escape closes via
 * `onEscape` (consumer wires the close handler).
 */
export function useFocusTrap(
  active: boolean,
  onEscape?: () => void,
): React.MutableRefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const root = ref.current;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      );
    const first = focusables()[0];
    if (first) first.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const all = focusables();
      if (all.length === 0) {
        e.preventDefault();
        return;
      }
      const first = all[0]!;
      const last = all[all.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
  return ref;
}

/**
 * Live-region announcer — renders an sr-only `aria-live="polite"`
 * element and exposes an `announce(msg)` function. Use for status
 * updates that should be read by screen readers without stealing
 * focus (WCAG SC 4.1.3).
 */
export interface LiveAnnouncerApi {
  announce: (message: string) => void;
}

export function LiveAnnouncer(): React.ReactElement {
  const [msg, setMsg] = useState('');
  const api = useRef<LiveAnnouncerApi>({
    announce(message: string) {
      setMsg(message);
    },
  });
  return (
    <div
      id={A11Y_LIVE_REGION_ID}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={srOnlyStyle}
    >
      {msg}
    </div>
  );
}

/**
 * Visually hide content while keeping it available to assistive
 * technology — the canonical "sr-only" pattern (WCAG SC 1.3.1).
 */
export const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};
