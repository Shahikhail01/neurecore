/**
 * Mobile matrix types — Phase 28 (P28) — CR-AI-1107.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §9 (P28).
 *
 * SOLID:
 *   SRP — only declares the typed mobile support surface.
 *   ISP — narrow `IActionGate` interface for capability gating.
 *   DIP — concrete clients depend on `IMobileSupportMatrixSource`,
 *         never on a hard-coded list.
 *
 * Reuses the BE-declared `MobileSupportMatrix` (re-exported from the
 * backend through the API) so the FE never diverges from the BE.
 */

export type MobileActionStatus = 'SUPPORTED' | 'DEGRADED' | 'UNSUPPORTED';

export type MobileViewport = 'mobile' | 'tablet' | 'desktop';

export interface MobileAction {
  readonly action: string;
  readonly status: MobileActionStatus;
  readonly minimumViewport: MobileViewport;
  readonly degradedNote?: string;
}

export interface MobileSupportMatrix {
  readonly platform: string;
  readonly version: string;
  readonly lastUpdated: string;
  readonly actions: ReadonlyArray<MobileAction>;
}

export interface ActionGateContext {
  readonly viewport: MobileViewport;
}

export interface IActionGate {
  isAllowed(action: string, ctx: ActionGateContext): boolean;
}

export interface IMobileSupportMatrixSource {
  load(): Promise<MobileSupportMatrix>;
  /** Synchronous accessor for already-loaded matrix. */
  current(): MobileSupportMatrix | null;
}
