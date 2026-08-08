/**
 * IViewportDetector — Phase 28 (P28) — CR-AI-1107.
 *
 * Narrow port for the current viewport category. The hook
 * implementation uses matchMedia; tests inject a stub.
 *
 * SOLID:
 *   ISP — one method.
 *   DIP — the gate depends on this interface, not on `window`.
 */
import type { MobileViewport } from './mobile-matrix';

export interface IViewportDetector {
  current(): MobileViewport;
  subscribe(listener: (next: MobileViewport) => void): () => void;
}
