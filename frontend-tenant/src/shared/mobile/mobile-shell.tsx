'use client';

/**
 * MobileShell — Phase 28 (P28) — CR-AI-1107.
 *
 * Responsive layout shell. On mobile viewports it collapses the
 * sidebar; on tablet it shows a compact header; on desktop it
 * renders the full shell.
 *
 * SRP — layout only; no business logic.
 * OCP — `MobileNav` is injected; additional columns can be added
 *       without forking this component.
 */

import type { ReactNode } from 'react';
import { useMobileActionGate } from './mobile-provider';

export interface MobileShellProps {
  readonly children: ReactNode;
  readonly nav?: ReactNode;
  readonly sidebar?: ReactNode;
}

export function MobileShell({ children, nav, sidebar }: MobileShellProps) {
  const { viewport } = useMobileActionGate();
  if (viewport === 'mobile') {
    return (
      <div data-viewport="mobile" className="flex min-h-screen flex-col">
        {nav ? <nav data-mobile-nav="true">{nav}</nav> : null}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }
  if (viewport === 'tablet') {
    return (
      <div data-viewport="tablet" className="flex min-h-screen flex-col">
        {nav ? <nav data-mobile-nav="true">{nav}</nav> : null}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    );
  }
  return (
    <div data-viewport="desktop" className="flex min-h-screen">
      {sidebar ? (
        <aside className="w-64 border-r">{sidebar}</aside>
      ) : null}
      <div className="flex flex-1 flex-col">
        {nav ? <nav>{nav}</nav> : null}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
