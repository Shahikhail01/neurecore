"use client";

/**
 * usePoolList — generic hook over IPoolAdminService.
 *
 * Phase 10 — Admin Business Composition (DIP). Pages depend on this hook,
 * never on axios directly. Tests can mock the service implementation.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IPoolAdminService, PoolListOptions, PoolPage } from '@/lib/pool/IPoolAdminService';

export function usePoolList<T, C>(
  service: IPoolAdminService<T, C>,
  initialOpts: PoolListOptions = {},
) {
  const [opts, setOpts] = useState<PoolListOptions>(initialOpts);
  const [page, setPage] = useState<PoolPage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next?: PoolListOptions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await service.list(next ?? opts);
      setPage(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [service, opts]);

  useEffect(() => {
    void load(opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  const refresh = useCallback(() => load(opts), [load, opts]);

  const items = useMemo(() => page?.items ?? [], [page]);
  const total = page?.total ?? 0;

  return {
    items,
    total,
    page: page?.page ?? 1,
    totalPages: page?.totalPages ?? 1,
    limit: page?.limit ?? (initialOpts.limit ?? 20),
    loading,
    error,
    opts,
    setOpts,
    setPage,
    refresh,
  };
}
