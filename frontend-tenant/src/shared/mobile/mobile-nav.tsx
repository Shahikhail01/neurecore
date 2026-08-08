'use client';

/**
 * MobileNav — Phase 28 (P28) — CR-AI-1107.
 *
 * Renders the actions that are allowed on the current viewport
 * according to the `MobileActionGate`. Mobile-only actions are
 * surfaced on top; actions blocked by the matrix are hidden.
 *
 * SRP — render-only nav; the gate decides what is allowed.
 */

import { useMobileActionGate } from './mobile-provider';

export interface MobileNavItem {
  readonly action: string;
  readonly label: string;
  readonly href?: string;
  readonly onSelect?: () => void;
}

export interface MobileNavProps {
  readonly items: ReadonlyArray<MobileNavItem>;
  readonly emptyLabel?: string;
}

export function MobileNav({ items, emptyLabel = 'No actions available' }: MobileNavProps) {
  const gate = useMobileActionGate();
  const allowed = items.filter((item) => gate.isAllowed(item.action));
  if (allowed.length === 0) {
    return (
      <div data-mobile-nav-empty="true" className="text-sm text-gray-500">
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul data-mobile-nav="true" className="flex flex-wrap gap-2">
      {allowed.map((item) => (
        <li key={item.action}>
          {item.href ? (
            <a
              href={item.href}
              data-mobile-nav-action={item.action}
              className="rounded bg-blue-600 px-3 py-1 text-white"
            >
              {item.label}
            </a>
          ) : (
            <button
              type="button"
              data-mobile-nav-action={item.action}
              onClick={item.onSelect}
              className="rounded bg-blue-600 px-3 py-1 text-white"
            >
              {item.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
