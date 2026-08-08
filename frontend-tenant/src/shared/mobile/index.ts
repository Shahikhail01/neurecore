/**
 * Mobile FE — Phase 28 (P28) — CR-AI-1107.
 *
 * Public surface of the mobile-FE module.
 *
 *   - MOBILE_MATRIX_VERSION    — the matrix version this build ships
 *   - STATIC_MOBILE_MATRIX_V1  — the inlined matrix (mirrors BE)
 *   - MobileActionGate         — the capability gate
 *   - MobileProvider           — React provider
 *   - useMobileActionGate      — hook for components
 *   - MobileShell              — responsive layout primitive
 *   - MobileNav                — actions nav that respects the gate
 */

export {
  type MobileAction,
  type MobileActionStatus,
  type MobileViewport,
  type MobileSupportMatrix,
  type ActionGateContext,
  type IActionGate,
  type IMobileSupportMatrixSource,
} from './mobile-matrix';
export {
  STATIC_MOBILE_MATRIX_V1,
  StaticMobileSupportMatrixSource,
} from './static-matrix-source';
export {
  HttpMobileSupportMatrixSource,
  MOBILE_MATRIX_URL,
  defaultMatrixFetcher,
  type MatrixFetcher,
} from './http-matrix-source';
export { MobileActionGate } from './mobile-action-gate';
export {
  type IViewportDetector,
} from './viewport-detector';
export {
  MatchMediaViewportDetector,
  VIEWPORT_BREAKPOINTS,
} from './matchmedia-viewport-detector';
export {
  MobileProvider,
  useMobileActionGate,
  type MobileProviderProps,
} from './mobile-provider';
export { MobileShell, type MobileShellProps } from './mobile-shell';
export { MobileNav, type MobileNavItem, type MobileNavProps } from './mobile-nav';

export const MOBILE_MATRIX_VERSION = '1.0.0';
