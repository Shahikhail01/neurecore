'use client';

/**
 * Phase 29 — Live-region announcer (CR-AI-1304).
 *
 * WCAG 4.1.3 "Status Messages": a status change that does not move
 * focus must still reach a screen-reader user. This replaces the
 * Phase 18 `LiveAnnouncer`, whose imperative API was unreachable — it
 * kept the `announce` function in a ref that no consumer could get to.
 *
 * The announcer now lives in a React context, so any component can
 * call `useAnnouncer().announce('Customer saved')`.
 *
 * SOLID
 *   SRP — owns ONLY the live region and its message queue.
 *   ISP — consumers depend on one method (`announce`).
 *   DIP — components depend on the hook, not on a DOM id.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { A11Y_LIVE_REGION_ID, srOnlyStyle } from './index';

export type AnnouncePoliteness = 'polite' | 'assertive';

export interface AnnouncerApi {
  announce: (message: string, politeness?: AnnouncePoliteness) => void;
}

const NOOP_ANNOUNCER: AnnouncerApi = { announce: () => undefined };

const AnnouncerContext = createContext<AnnouncerApi>(NOOP_ANNOUNCER);

export function AnnouncerProvider({
  children,
}: {
  readonly children: React.ReactNode;
}): React.ReactElement {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  const announce = useCallback(
    (message: string, politeness: AnnouncePoliteness = 'polite') => {
      if (politeness === 'assertive') setAssertive(message);
      else setPolite(message);
    },
    [],
  );

  const api = useMemo<AnnouncerApi>(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={api}>
      {children}
      <div
        id={A11Y_LIVE_REGION_ID}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnlyStyle}
      >
        {polite}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={srOnlyStyle}
      >
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerApi {
  return useContext(AnnouncerContext);
}
