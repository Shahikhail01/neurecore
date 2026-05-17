/**
 * Audit Logs Hook
 *
 * Single Responsibility: Only handles Audit logs data fetching and state management
 */

import { useState, useEffect, useCallback } from "react";
import { getAuditLogsService } from "@/services/settings";
import type { AuditLog, PaginatedAuditLogs } from "@/types/settings.types";

interface UseAuditLogsState {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
  summary: {
    total: number;
    byLevel: Record<AuditLog["level"], number>;
    byCategory: Record<AuditLog["category"], number>;
    byActor: { actorId: string; count: number }[];
  } | null;
}

interface UseAuditLogsActions {
  refresh: (params?: AuditLogsParams) => Promise<void>;
  loadMore: () => Promise<void>;
  exportLogs: (format: "csv" | "json" | "pdf") => Promise<void>;
  getSummary: () => Promise<void>;
}

export interface AuditLogsParams {
  page?: number;
  limit?: number;
  level?: AuditLog["level"];
  category?: AuditLog["category"];
  actorId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useAuditLogs(
  initialParams?: AuditLogsParams,
): UseAuditLogsState & UseAuditLogsActions {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    byLevel: Record<AuditLog["level"], number>;
    byCategory: Record<AuditLog["category"], number>;
    byActor: { actorId: string; count: number }[];
  } | null>(null);
  const [params, setParams] = useState<AuditLogsParams>(initialParams ?? {});

  const service = getAuditLogsService();

  const refresh = useCallback(
    async (newParams?: AuditLogsParams) => {
      setLoading(true);
      setError(null);

      const searchParams = newParams ?? params;
      if (newParams) {
        setParams(newParams);
        if (newParams.page !== undefined) setPage(newParams.page);
      }

      try {
        const data = await service.getLogs({
          page: searchParams.page ?? page,
          limit: searchParams.limit ?? limit,
          level: searchParams.level,
          category: searchParams.category,
          actorId: searchParams.actorId,
          action: searchParams.action,
          resource: searchParams.resource,
          startDate: searchParams.startDate,
          endDate: searchParams.endDate,
          search: searchParams.search,
        });
        setLogs(data.items);
        setTotal(data.total);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load audit logs",
        );
      } finally {
        setLoading(false);
      }
    },
    [service, page, limit, params],
  );

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    try {
      const data = await service.getLogs({
        page: nextPage,
        limit,
        ...params,
      });
      setLogs((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more logs");
    }
  }, [service, page, limit, params]);

  const exportLogs = useCallback(
    async (format: "csv" | "json" | "pdf") => {
      try {
        const blob = await service.exportLogs({
          format,
          level: params.level,
          category: params.category,
          startDate: params.startDate,
          endDate: params.endDate,
        });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to export logs");
      }
    },
    [service, params],
  );

  const getSummary = useCallback(async () => {
    try {
      const data = await service.getLogSummary({
        startDate: params.startDate,
        endDate: params.endDate,
      });
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
    }
  }, [service, params.startDate, params.endDate]);

  useEffect(() => {
    void refresh();
    void getSummary();
  }, []);

  return {
    logs,
    total,
    page,
    limit,
    loading,
    error,
    summary,
    refresh,
    loadMore,
    exportLogs,
    getSummary,
  };
}
