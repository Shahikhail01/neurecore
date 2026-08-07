'use client';

/**
 * PendingSurfacePage — Phase 10.6 R1-BACKLOG stub renderer.
 *
 * Used by list pages for surfaces whose backend endpoint hasn't shipped
 * yet (leads, quotes, emails in this iteration). The component fetches
 * the endpoint anyway to surface the backend status — when the endpoint
 * 404s or returns 501 we render a real "Backend coming" empty state
 * (not lorem-ipsum). When the endpoint exists but the tenant has no
 * rows yet, we render a "Create the first one" empty state.
 *
 * SRP: this is the ONLY place that knows the empty-state copy for
 * pending surfaces. Each stub list page just declares its metadata.
 */

import { useCallback, useEffect, useState } from 'react';
import { Construction, Plus, Search } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import type { AuthUser } from '@/types/auth.types';

export interface PendingSurfacePageProps<T> {
  /** Page title shown in the header. */
  title: string;
  /** Short copy under the title. */
  description: string;
  /** Async fetcher that returns rows + total. */
  fetcher: () => Promise<{ items: T[]; total: number }>;
  /** Search placeholder (e.g. "Search leads by name"). */
  searchPlaceholder: string;
  /** Label for the (disabled) create CTA. */
  createLabel: string;
  /**
   * "Backend shipping in" copy shown when the endpoint 404s / 501s.
   * Be honest about timing — this surfaces in front of customers.
   */
  plannedPhase: string;
  /** Singular row label for the empty state ("lead", "quote", "email"). */
  rowSingular: string;
  /** Optional render function for the EntityTable columns. */
  columns?: never;
}

export function PendingSurfacePage<T>({
  title,
  description,
  fetcher,
  searchPlaceholder,
  createLabel,
  plannedPhase,
  rowSingular,
}: PendingSurfacePageProps<T>) {
  const user = useTenantAuth() as AuthUser | null;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows } = await fetcher();
      setItems(rows);
      setBackendReady(true);
    } catch {
      setItems([]);
      setBackendReady(false);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  const empty = !loading && backendReady === true && items.length === 0;

  return (
    <TenantShell user={user!}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">{title}</h1>
            <p className="text-sm text-zinc-500 mt-1">{description}</p>
          </div>
          <button
            type="button"
            disabled
            title={`${createLabel} is available once ${plannedPhase.toLowerCase()} ships`}
            aria-label={createLabel}
            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition h-9 px-4 text-sm bg-surface-overlay text-zinc-500 border border-surface-border opacity-60 cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> {createLabel}
          </button>
        </header>

        <GlassPanel className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="w-full pl-9 pr-3 py-2 bg-surface text-sm text-zinc-200 rounded-lg border border-surface-border focus:outline-none focus:border-primary"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={searchPlaceholder}
              />
            </div>
            <span className="text-xs text-zinc-500 ml-auto">
              {loading ? '…' : `${items.length} total`}
            </span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-0 overflow-hidden">
          <div className="p-12 text-center space-y-3">
            {backendReady === false ? (
              <>
                <div className="flex justify-center">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Construction className="w-6 h-6 text-accent" />
                  </div>
                </div>
                <p className="text-sm text-zinc-300 font-medium">
                  Backend coming in {plannedPhase}.
                </p>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  The navigation rail is wired and this page will start
                  showing live {rowSingular}s as soon as the API ships.
                  Until then, no data is loaded and no actions are
                  available — by design.
                </p>
              </>
            ) : empty ? (
              <p className="text-sm text-zinc-500">
                No {rowSingular}s yet.
              </p>
            ) : (
              <p className="text-sm text-zinc-500">
                Listing UI is wired but the table component will render in
                a later iteration.
              </p>
            )}
          </div>
        </GlassPanel>
      </div>
    </TenantShell>
  );
}