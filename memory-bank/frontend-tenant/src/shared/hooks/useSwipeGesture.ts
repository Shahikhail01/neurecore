'use client';
// ─── useSwipeGesture.ts ───────────────────────────────────────────────────────
// SRP: Touch/swipe gesture detection only — no routing, no side effects.
// OCP: New gesture types (e.g., 'swipe-up') added by extending SwipeDirection
//      and adjusting the detection logic below — nothing else changes.
//
// Usage:
//   const ref = useSwipeGesture({
//     onSwipeLeft:  () => router.forward(),
//     onSwipeRight: () => router.back(),
//     threshold: 60,
//   });
//   return <div ref={ref}>...</div>;

import { useRef, useCallback } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeHandlers {
  onSwipeLeft?:  () => void;
  onSwipeRight?: () => void;
  onSwipeUp?:    () => void;
  onSwipeDown?:  () => void;
  /** Minimum px distance to count as a swipe (default: 50) */
  threshold?: number;
  /** Maximum angle deviation from axis in degrees (default: 35) */
  maxAngle?: number;
}

interface TouchOrigin {
  x: number;
  y: number;
  time: number;
}

export function useSwipeGesture<T extends HTMLElement = HTMLDivElement>(
  handlers: SwipeHandlers,
): React.RefCallback<T> {
  const origin = useRef<TouchOrigin | null>(null);
  const { threshold = 50, maxAngle = 35 } = handlers;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const t = e.changedTouches[0];
    origin.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!origin.current) return;

    const t  = e.changedTouches[0];
    const dx = t.clientX - origin.current.x;
    const dy = t.clientY - origin.current.y;
    const dt = Date.now() - origin.current.time;
    origin.current = null;

    // Ignore taps and very slow drags (> 750ms)
    if (dt > 750) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dist = Math.hypot(dx, dy);

    if (dist < threshold) return;

    // Angle of movement from the primary axis
    const angle = Math.atan2(absY, absX) * (180 / Math.PI);

    if (absX > absY && angle <= maxAngle) {
      // Horizontal swipe
      if (dx > 0) handlers.onSwipeRight?.();
      else        handlers.onSwipeLeft?.();
    } else if (absY > absX && (90 - angle) <= maxAngle) {
      // Vertical swipe
      if (dy > 0) handlers.onSwipeDown?.();
      else        handlers.onSwipeUp?.();
    }
  }, [handlers, threshold, maxAngle]);

  const refCallback: React.RefCallback<T> = useCallback((node) => {
    if (!node) return;
    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchend',   handleTouchEnd,   { passive: true });
    // Return cleanup — RefCallbacks called with null on unmount
    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return refCallback;
}
