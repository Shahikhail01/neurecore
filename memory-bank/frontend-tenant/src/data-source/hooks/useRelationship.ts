/**
 * useRelationship Hook
 * Manage relationships between collections (HasMany, BelongsTo, BelongsToMany)
 * Adapted from NocoBase's relationship patterns
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAPIClient } from "@/api-client";
import { collectionRegistry } from "../CollectionRegistry";
import { QueryBuilder } from "../QueryBuilder";

export type RelationType = "hasMany" | "belongsTo" | "belongsToMany";

export interface RelationshipConfig {
  collectionName: string;
  relationField: string;
  relationType: RelationType;
  targetCollection?: string;
  targetKey?: string;
  sourceKey?: string;
  throughCollection?: string; // for belongsToMany
  foreignKey?: string;
}

export interface RelationRecord {
  id: string;
  displayName: string;
  [key: string]: any;
}

export interface UseRelationshipResult {
  // Data
  records: RelationRecord[];
  loading: boolean;
  error?: Error;
  total: number;

  // Operations
  fetch: (
    sourceId: string,
    options?: { skip?: number; take?: number },
  ) => Promise<RelationRecord[]>;
  add: (sourceId: string, targetIds: string | string[]) => Promise<void>;
  remove: (sourceId: string, targetIds: string | string[]) => Promise<void>;
  update: (sourceId: string, targetId: string, data: any) => Promise<void>;
  clear: (sourceId: string) => Promise<void>;

  // Query
  query: () => QueryBuilder;
  search: (term: string, searchFields: string[]) => Promise<RelationRecord[]>;

  // Bulk operations
  batch: {
    add: (sourceId: string, targetIds: string[]) => Promise<void>;
    remove: (sourceId: string, targetIds: string[]) => Promise<void>;
    replace: (sourceId: string, targetIds: string[]) => Promise<void>;
  };
}

/**
 * Hook for managing collection relationships
 */
export function useRelationship(
  config: RelationshipConfig,
): UseRelationshipResult {
  const {
    collectionName,
    relationField,
    relationType,
    targetCollection,
    targetKey = "id",
    sourceKey = "id",
    foreignKey,
  } = config;

  const apiClient = useAPIClient();
  const [records, setRecords] = useState<RelationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [total, setTotal] = useState(0);

  const metadata = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName],
  );

  const resource = metadata?.resource || `/api/v1/${collectionName}`;
  const relatedCollection =
    targetCollection || relationField.replace(/([A-Z])/g, "_$1").toLowerCase();

  /**
   * Fetch related records
   */
  const fetch = useCallback(
    async (sourceId: string, options?: { skip?: number; take?: number }) => {
      setLoading(true);
      setError(undefined);

      try {
        let url: string;
        const params = new URLSearchParams();

        if (options?.skip !== undefined) {
          params.append("skip", options.skip.toString());
        }
        if (options?.take !== undefined) {
          params.append("take", options.take.toString());
        }

        switch (relationType) {
          case "hasMany":
            // GET /api/v1/agents/{id}/tasks
            url = `${resource}/${sourceId}/${relationField}`;
            break;

          case "belongsTo":
            // GET /api/v1/tasks/{id}/agent
            url = `${resource}/${sourceId}/${relationField}`;
            break;

          case "belongsToMany":
            // GET /api/v1/agents/{id}/projects
            url = `${resource}/${sourceId}/${relationField}`;
            break;

          default:
            throw new Error(`Unknown relation type: ${relationType}`);
        }

        const response = await apiClient.get(url, { params });
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        setRecords(data);
        setTotal(response.data?.total || data.length);
        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, resource, relationField, relationType],
  );

  /**
   * Add related record(s)
   */
  const add = useCallback(
    async (sourceId: string, targetIds: string | string[]) => {
      setLoading(true);
      setError(undefined);

      try {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        const url = `${resource}/${sourceId}/${relationField}`;

        switch (relationType) {
          case "hasMany":
            // POST /api/v1/agents/{id}/tasks with { ids: [...] }
            await apiClient.post(url, { ids });
            break;

          case "belongsTo":
            // PUT /api/v1/tasks/{id}/agent with { id: targetId }
            await apiClient.put(url, { id: ids[0] });
            break;

          case "belongsToMany":
            // POST /api/v1/agents/{id}/projects with { ids: [...] }
            await apiClient.post(url, { ids });
            break;
        }

        // Refresh data after adding
        await fetch(sourceId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, resource, relationField, relationType, fetch],
  );

  /**
   * Remove related record(s)
   */
  const remove = useCallback(
    async (sourceId: string, targetIds: string | string[]) => {
      setLoading(true);
      setError(undefined);

      try {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        const url = `${resource}/${sourceId}/${relationField}`;

        switch (relationType) {
          case "hasMany":
            // DELETE /api/v1/agents/{id}/tasks/{targetId}
            for (const id of ids) {
              await apiClient.delete(`${url}/${id}`);
            }
            break;

          case "belongsTo":
            // DELETE /api/v1/tasks/{id}/agent
            await apiClient.delete(url);
            break;

          case "belongsToMany":
            // DELETE /api/v1/agents/{id}/projects with { ids: [...] }
            await apiClient.delete(url, { data: { ids } });
            break;
        }

        // Refresh data after removing
        await fetch(sourceId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, resource, relationField, relationType, fetch],
  );

  /**
   * Update a related record
   */
  const update = useCallback(
    async (sourceId: string, targetId: string, data: any) => {
      setLoading(true);
      setError(undefined);

      try {
        const url = `${resource}/${sourceId}/${relationField}/${targetId}`;
        await apiClient.patch(url, data);

        // Refresh data after updating
        await fetch(sourceId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, resource, relationField, fetch],
  );

  /**
   * Clear all related records
   */
  const clear = useCallback(
    async (sourceId: string) => {
      setLoading(true);
      setError(undefined);

      try {
        const url = `${resource}/${sourceId}/${relationField}`;
        await apiClient.delete(url);

        setRecords([]);
        setTotal(0);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, resource, relationField],
  );

  /**
   * Build a query for related records
   */
  const query = useCallback(() => {
    const qb = new QueryBuilder();
    qb.select(relationField);
    return qb;
  }, [relationField]);

  /**
   * Search in related records
   */
  const search = useCallback(
    async (term: string, searchFields: string[]) => {
      setLoading(true);
      setError(undefined);

      try {
        const qb = new QueryBuilder();
        searchFields.forEach((field, index) => {
          if (index > 0) {
            qb.setGroupLogic("or");
          }
          qb.contains(field, term);
        });

        const params = qb.toParams();
        const url = `${resource}/${relationField}/search`;
        const response = await apiClient.get(url, { params });

        return response.data || [];
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, resource, relationField],
  );

  /**
   * Batch operations
   */
  const batch = useMemo(
    () => ({
      add: async (sourceId: string, targetIds: string[]) => {
        return add(sourceId, targetIds);
      },
      remove: async (sourceId: string, targetIds: string[]) => {
        return remove(sourceId, targetIds);
      },
      replace: async (sourceId: string, targetIds: string[]) => {
        await clear(sourceId);
        await add(sourceId, targetIds);
      },
    }),
    [add, remove, clear],
  );

  return {
    records,
    loading,
    error,
    total,
    fetch,
    add,
    remove,
    update,
    clear,
    query,
    search,
    batch,
  };
}

/**
 * Hook for HasMany relationships
 */
export function useHasMany<T = any>(
  collectionName: string,
  relationField: string,
  targetCollection?: string,
) {
  return useRelationship({
    collectionName,
    relationField,
    relationType: "hasMany",
    targetCollection,
  });
}

/**
 * Hook for BelongsTo relationships
 */
export function useBelongsTo<T = any>(
  collectionName: string,
  relationField: string,
  targetCollection?: string,
) {
  return useRelationship({
    collectionName,
    relationField,
    relationType: "belongsTo",
    targetCollection,
  });
}

/**
 * Hook for BelongsToMany relationships
 */
export function useBelongsToMany<T = any>(
  collectionName: string,
  relationField: string,
  targetCollection?: string,
  throughCollection?: string,
) {
  return useRelationship({
    collectionName,
    relationField,
    relationType: "belongsToMany",
    targetCollection,
    throughCollection,
  });
}

export default useRelationship;
