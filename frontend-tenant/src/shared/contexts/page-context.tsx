// ─── page-context.tsx ──────────────────────────────────────────────────────────
// Single canonical React context for the typed PageContext used by the chat
// panel, contextual actions, and skill composer. P1 of the Creatio AI parity
// plan moves the untyped `string` pageContext to a typed object with
// server-validated fields, user locale/timezone, and an explicit allow-list
// of client-visible actions.
//
// The provider reads the URL + the current user profile and exposes a
// `setPageContext` mutator that pages use to declare typed context
// (e.g. /projects/[id] sets entityType=Project, recordId=id).
//
// LLM output is untrusted. PageContext is *only* produced by the trusted
// client (URL match + user me lookup) and re-validated server-side on
// every chat request. No field is ever sourced from a model reply.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

export interface PageContext {
  /** Stable entity type — e.g. "Project", "Customer", "Task". */
  entityType?: string;
  /** Authorized record id (UUID). */
  recordId?: string;
  /** Subset of field paths the user has explicitly selected on the page. */
  selectedFields?: string[];
  /** ISO locale string from the authenticated user profile, e.g. "en-US". */
  userLocale: string;
  /** IANA timezone, e.g. "America/New_York". */
  userTimeZone: string;
  /** Action ids the current page exposes to the chat. */
  allowedActions: string[];
  /** Current application path, for audit + traceability. */
  pagePath: string;
}

export interface PageContextPatch {
  entityType?: string;
  recordId?: string;
  selectedFields?: string[];
  allowedActions?: string[];
}

const EMPTY: PageContext = {
  entityType: undefined,
  recordId: undefined,
  selectedFields: undefined,
  userLocale: 'en-US',
  userTimeZone: 'UTC',
  allowedActions: [],
  pagePath: '/',
};

interface PageContextValue {
  pageContext: PageContext;
  setPageContext: (patch: PageContextPatch) => void;
  clearPageContext: () => void;
  setUserLocale: (locale: string) => void;
  setUserTimeZone: (tz: string) => void;
}

const Ctx = createContext<PageContextValue | null>(null);

/**
 * Infer a coarse entityType from a Next.js pathname. Pages SHOULD still call
 * `useSetPageContext` to publish the authoritative entityType / recordId —
 * the URL inference is only a baseline so the chat always has *some*
 * context to ground in.
 */
function inferEntityTypeFromPath(pathname: string): { entityType?: string; recordId?: string } {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return {};
  const head = segments[0]?.toLowerCase() ?? '';
  const candidate: Record<string, string> = {
    projects: 'Project',
    customers: 'Customer',
    tasks: 'Task',
    reviews: 'Review',
    goals: 'Goal',
    strategies: 'Strategy',
    cases: 'Case',
    tickets: 'Ticket',
    engagements: 'Engagement',
    documents: 'Document',
    orders: 'Order',
    contracts: 'Contract',
  };
  const entityType = candidate[head];
  if (!entityType) return {};
  // The second segment is conventionally the record id (UUID or slug).
  const recordId = segments[1] && segments[1] !== 'new' ? segments[1] : undefined;
  return { entityType, recordId };
}

export function PageContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [userLocale, setUserLocaleState] = useState<string>('en-US');
  const [userTimeZone, setUserTimeZoneState] = useState<string>('UTC');
  const [entityType, setEntityType] = useState<string | undefined>(undefined);
  const [recordId, setRecordId] = useState<string | undefined>(undefined);
  const [selectedFields, setSelectedFields] = useState<string[] | undefined>(undefined);
  const [allowedActions, setAllowedActions] = useState<string[]>([]);

  // Track the last path that produced an inference so we only re-infer when
  // the URL actually changes (and pages have a chance to publish their own
  // authoritative context first).
  const lastInferredPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastInferredPath.current === pathname) return;
    lastInferredPath.current = pathname;
    const inferred = inferEntityTypeFromPath(pathname);
    if (inferred.entityType) setEntityType(inferred.entityType);
    if (inferred.recordId) setRecordId(inferred.recordId);
  }, [pathname]);

  // Lazy-load the user profile so we can read locale/timezone. We avoid
  // pinning this to the provider's mount-time fetch so the chat panel works
  // before the profile resolves; the default is "en-US / UTC".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@/services/me.service');
        const profile = await mod.meService.profile.get();
        if (cancelled || !profile) return;
        if (profile.locale) setUserLocaleState(profile.locale);
        if (profile.timezone) setUserTimeZoneState(profile.timezone);
      } catch {
        // Network/parse error — keep defaults. Chat still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPageContext = useCallback((patch: PageContextPatch) => {
    if (patch.entityType !== undefined) setEntityType(patch.entityType);
    if (patch.recordId !== undefined) setRecordId(patch.recordId);
    if (patch.selectedFields !== undefined) setSelectedFields(patch.selectedFields);
    if (patch.allowedActions !== undefined) setAllowedActions(patch.allowedActions);
  }, []);

  const clearPageContext = useCallback(() => {
    setEntityType(undefined);
    setRecordId(undefined);
    setSelectedFields(undefined);
    setAllowedActions([]);
  }, []);

  const value = useMemo<PageContextValue>(
    () => ({
      pageContext: {
        entityType,
        recordId,
        selectedFields,
        userLocale,
        userTimeZone,
        allowedActions,
        pagePath: pathname,
      },
      setPageContext,
      clearPageContext,
      setUserLocale: setUserLocaleState,
      setUserTimeZone: setUserTimeZoneState,
    }),
    [
      entityType,
      recordId,
      selectedFields,
      userLocale,
      userTimeZone,
      allowedActions,
      pathname,
      setPageContext,
      clearPageContext,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageContext(): PageContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fall back to a static empty context so SSR/Storybook never crash.
    return {
      pageContext: { ...EMPTY, pagePath: '/' },
      setPageContext: () => undefined,
      clearPageContext: () => undefined,
      setUserLocale: () => undefined,
      setUserTimeZone: () => undefined,
    };
  }
  return ctx;
}

/**
 * Convenience hook for pages to publish their authoritative context.
 * Returns the current context and an updater bound to the provider.
 */
export function useSetPageContext(): {
  pageContext: PageContext;
  setPageContext: (patch: PageContextPatch) => void;
  clearPageContext: () => void;
} {
  const { pageContext, setPageContext, clearPageContext } = usePageContext();
  return { pageContext, setPageContext, clearPageContext };
}
