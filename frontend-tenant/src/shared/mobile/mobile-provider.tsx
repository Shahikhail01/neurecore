'use client';

/**
 * Mobile provider — Phase 28 (P28) — CR-AI-1107.
 *
 * React provider that wires the `MobileActionGate` once at the app
 * root. Components consume the gate through `useMobileActionGate()`.
 *
 * SRP — wire-up + context provision only.
 * DIP — defaults to the static matrix + matchMedia detector; consumers
 *       may inject a different source.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MobileActionGate } from './mobile-action-gate';
import { HttpMobileSupportMatrixSource } from './http-matrix-source';
import { MatchMediaViewportDetector } from './matchmedia-viewport-detector';
import type {
  ActionGateContext,
  MobileAction,
  MobileViewport,
} from './mobile-matrix';

interface MobileActionGateApi {
  isAllowed(action: string, ctx?: ActionGateContext): boolean;
  describe(action: string): MobileAction | undefined;
  actionsAllowedOn(viewport: MobileViewport): ReadonlyArray<MobileAction>;
  viewport: MobileViewport;
}

const MobileActionGateContext = createContext<MobileActionGateApi | null>(null);

export interface MobileProviderProps {
  readonly children: ReactNode;
  readonly gate?: MobileActionGate;
  readonly initialViewport?: MobileViewport;
}

export function MobileProvider({
  children,
  gate,
  initialViewport = 'desktop',
}: MobileProviderProps) {
  const builtGate = useMemo(
    () =>
      gate ??
      // Live BE matrix with static fallback (P28): the gate reads the
      // canonical backend source and only degrades to the inlined
      // mirror when the network/backend is unavailable.
      new MobileActionGate(
        new HttpMobileSupportMatrixSource(),
        new MatchMediaViewportDetector(),
      ),
    [gate],
  );

  const [viewport, setViewport] = useState<MobileViewport>(initialViewport);

  useEffect(() => {
    let mounted = true;
    builtGate.ready().catch(() => undefined);
    const detector = new MatchMediaViewportDetector();
    setViewport(detector.current());
    const unsubscribe = detector.subscribe((next) => {
      if (mounted) setViewport(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [builtGate]);

  const api = useMemo<MobileActionGateApi>(
    () => ({
      isAllowed: (action, ctx) => builtGate.isAllowed(action, ctx ?? { viewport }),
      describe: (action) => builtGate.describe(action),
      actionsAllowedOn: (v) => builtGate.actionsAllowedOn(v),
      viewport,
    }),
    [builtGate, viewport],
  );

  const ref = useRef(api);
  ref.current = api;

  return (
    <MobileActionGateContext.Provider value={api}>
      {children}
    </MobileActionGateContext.Provider>
  );
}

export function useMobileActionGate(): MobileActionGateApi {
  const ctx = useContext(MobileActionGateContext);
  if (!ctx) {
    return {
      isAllowed: () => false,
      describe: () => undefined,
      actionsAllowedOn: () => [],
      viewport: 'desktop',
    };
  }
  return ctx;
}
