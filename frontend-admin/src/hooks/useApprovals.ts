/**
 * useApprovals Hook
 * Manages approvals state and API calls
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import approvalService, { Approval } from "@/services/approvalService";
import { useAuth } from "./useAuth";

export function useApprovals() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = user?.tenantId;

  const fetchApprovals = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await approvalService.getApprovals(tenantId);
      setApprovals(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await approvalService.getPendingApprovals(tenantId);
      setPendingApprovals(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const approve = useCallback(
    async (approvalId: string, comments?: string) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const updated = await approvalService.approve(tenantId, approvalId, {
          comments: comments || "",
        });
        setApprovals((prev) =>
          prev.map((a) => (a.id === approvalId ? updated : a)),
        );
        setPendingApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        return updated;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const reject = useCallback(
    async (approvalId: string, reason: string) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const updated = await approvalService.reject(tenantId, approvalId, {
          reason,
        });
        setApprovals((prev) =>
          prev.map((a) => (a.id === approvalId ? updated : a)),
        );
        setPendingApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        return updated;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  const requestChanges = useCallback(
    async (approvalId: string, feedback: string) => {
      if (!tenantId) throw new Error("No tenant ID");

      setError(null);
      try {
        const updated = await approvalService.requestChanges(
          tenantId,
          approvalId,
          {
            feedback,
          },
        );
        setApprovals((prev) =>
          prev.map((a) => (a.id === approvalId ? updated : a)),
        );
        return updated;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [tenantId],
  );

  useEffect(() => {
    fetchApprovals();
    fetchPendingApprovals();
  }, [fetchApprovals, fetchPendingApprovals]);

  return {
    approvals,
    pendingApprovals,
    loading,
    error,
    fetchApprovals,
    fetchPendingApprovals,
    approve,
    reject,
    requestChanges,
  };
}
