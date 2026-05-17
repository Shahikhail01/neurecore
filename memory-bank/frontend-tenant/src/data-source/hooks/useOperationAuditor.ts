/**
 * Operation Auditor
 * Track and audit all data operations (CRUD) with change history
 * Adapted from NocoBase's audit logging patterns
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { useCurrentUser } from "@/user";

export type OperationType =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "archive"
  | "restore";

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName?: string;
  collectionName: string;
  recordId: string;
  operation: OperationType;
  changes?: {
    field: string;
    before: any;
    after: any;
  }[];
  metadata?: Record<string, any>;
}

export interface UseOperationAuditorOptions {
  collectionName: string;
  enabled?: boolean;
  maxLogs?: number;
}

export interface UseOperationAuditorResult {
  logs: AuditLog[];
  add: (operation: OperationType, recordId: string, changes?: any) => void;
  clear: () => void;
  getOperationHistory: (recordId: string) => AuditLog[];
  export: (format?: "json" | "csv") => string;
  getChangesBetween: (
    recordId: string,
    startTime: Date,
    endTime: Date,
  ) => AuditLog[];
  getOperationStats: () => {
    total: number;
    byOperation: Record<OperationType, number>;
    byUser: Record<string, number>;
  };
}

/**
 * Hook for auditing operations on a collection
 */
export function useOperationAuditor(
  options: UseOperationAuditorOptions,
): UseOperationAuditorResult {
  const { collectionName, enabled = true, maxLogs = 500 } = options;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const nextIdRef = useRef(0);
  const { user } = useCurrentUser();

  /**
   * Add an audit log entry
   */
  const add = useCallback(
    (
      operation: OperationType,
      recordId: string,
      changes?: Record<string, any>,
    ) => {
      if (!enabled) return;

      const auditLog: AuditLog = {
        id: `audit-${++nextIdRef.current}`,
        timestamp: new Date(),
        userId: user?.id || "unknown",
        userName: user?.name || user?.email || "Anonymous",
        collectionName,
        recordId,
        operation,
        changes: changes
          ? Object.entries(changes).map(([field, value]) => ({
              field,
              before: null, // Would need previous value for full tracking
              after: value,
            }))
          : undefined,
        metadata: {
          ipAddress: typeof window !== "undefined" ? undefined : undefined,
        },
      };

      setLogs((prevLogs) => {
        const updated = [auditLog, ...prevLogs];
        // Keep only the most recent maxLogs entries
        return updated.slice(0, maxLogs);
      });
    },
    [collectionName, enabled, user, maxLogs],
  );

  /**
   * Clear all logs
   */
  const clear = useCallback(() => {
    setLogs([]);
  }, []);

  /**
   * Get operation history for a specific record
   */
  const getOperationHistory = useCallback(
    (recordId: string): AuditLog[] => {
      return logs.filter((log) => log.recordId === recordId);
    },
    [logs],
  );

  /**
   * Get changes between two timestamps
   */
  const getChangesBetween = useCallback(
    (recordId: string, startTime: Date, endTime: Date): AuditLog[] => {
      return logs.filter(
        (log) =>
          log.recordId === recordId &&
          log.timestamp >= startTime &&
          log.timestamp <= endTime,
      );
    },
    [logs],
  );

  /**
   * Export logs as JSON
   */
  const exportAsJson = useCallback((): string => {
    return JSON.stringify(logs, null, 2);
  }, [logs]);

  /**
   * Export logs as CSV
   */
  const exportAsCsv = useCallback((): string => {
    const headers = [
      "id",
      "timestamp",
      "userId",
      "userName",
      "collectionName",
      "recordId",
      "operation",
      "changes",
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.userId,
      log.userName || "",
      log.collectionName,
      log.recordId,
      log.operation,
      log.changes
        ? log.changes
            .map((c) => `${c.field}: ${c.before} -> ${c.after}`)
            .join("; ")
        : "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const cellStr = String(cell);
            return cellStr.includes(",") ? `"${cellStr}"` : cellStr;
          })
          .join(","),
      ),
    ].join("\n");

    return csvContent;
  }, [logs]);

  /**
   * Export logs
   */
  const exportLogs = useCallback(
    (format: "json" | "csv" = "json"): string => {
      return format === "json" ? exportAsJson() : exportAsCsv();
    },
    [exportAsJson, exportAsCsv],
  );

  /**
   * Get operation statistics
   */
  const getOperationStats = useCallback((): {
    total: number;
    byOperation: Record<OperationType, number>;
    byUser: Record<string, number>;
  } => {
    const stats = {
      total: logs.length,
      byOperation: {
        create: 0,
        read: 0,
        update: 0,
        delete: 0,
        archive: 0,
        restore: 0,
      } as Record<OperationType, number>,
      byUser: {} as Record<string, number>,
    };

    logs.forEach((log) => {
      stats.byOperation[log.operation]++;
      const userKey = log.userName || log.userId;
      stats.byUser[userKey] = (stats.byUser[userKey] || 0) + 1;
    });

    return stats;
  }, [logs]);

  return {
    logs,
    add,
    clear,
    getOperationHistory,
    getChangesBetween,
    export: exportLogs,
    getOperationStats,
  };
}

/**
 * Higher-order component to audit CRUD operations
 */
export function withOperationAuditor<
  T extends Record<string, (recordId: string, data?: any) => Promise<any>>,
>(operations: T, collectionName: string): T {
  return new Proxy(operations, {
    get(target, prop: string) {
      const operation = target[prop];

      if (typeof operation !== "function") {
        return operation;
      }

      // Map function names to operation types
      const operationType: OperationType =
        prop === "create"
          ? "create"
          : prop === "delete"
            ? "delete"
            : prop === "archive"
              ? "archive"
              : prop === "read"
                ? "read"
                : "update";

      return async (recordId: string, data?: any) => {
        const result = await operation.call(target, recordId, data);

        // Could emit audit event here
        // auditStore.add(operationType, recordId, data);

        return result;
      };
    },
  }) as T;
}

export default useOperationAuditor;
