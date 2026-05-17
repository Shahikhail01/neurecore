/**
 * useCollectionResource Hook
 * Extended resource management based on NocoBase's useResource pattern
 * Provides CRUD operations with mutation handling and state management
 */

"use client";

import { useState, useCallback } from "react";
import { useRequest, useAPIClient } from "@/api-client";

export interface UseCollectionResourceOptions {
  collection: string;
  resource?: string;
  action?: string;
  filter?: Record<string, any>;
  sort?: Record<string, "asc" | "desc">;
  pagination?: { page: number; pageSize: number };
}

export function useCollectionResource<T = any>(
  options: UseCollectionResourceOptions,
) {
  const api = useAPIClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<T | null>(null);

  // Build resource URL
  const resource = options.resource || `/api/v1/${options.collection}`;
  const action = options.action || "list";
  const fullUrl = action === "list" ? resource : `${resource}/:id/${action}`;

  // Fetch list of records
  const {
    data: records,
    loading,
    refresh,
  } = useRequest(
    {
      url: resource,
      method: "GET",
      params: {
        filter: options.filter,
        sort: options.sort,
        page: options.pagination?.page || 1,
        pageSize: options.pagination?.pageSize || 20,
      },
    },
    { cacheKey: `collection-${options.collection}-list` },
  );

  // Create record
  const create = useCallback(
    async (data: Partial<T>) => {
      try {
        const response = await api.post(resource, data);
        refresh();
        return response.data?.data || response.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message ||
            `Failed to create ${options.collection}`,
        );
      }
    },
    [api, resource, refresh, options.collection],
  );

  // Read single record
  const read = useCallback(
    async (id: string) => {
      try {
        const response = await api.get(`${resource}/${id}`);
        return response.data?.data || response.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message ||
            `Failed to read ${options.collection}`,
        );
      }
    },
    [api, resource, options.collection],
  );

  // Update record
  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      try {
        const response = await api.put(`${resource}/${id}`, data);
        refresh();
        return response.data?.data || response.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message ||
            `Failed to update ${options.collection}`,
        );
      }
    },
    [api, resource, refresh, options.collection],
  );

  // Delete record
  const remove = useCallback(
    async (id: string) => {
      try {
        await api.delete(`${resource}/${id}`);
        refresh();
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message ||
            `Failed to delete ${options.collection}`,
        );
      }
    },
    [api, resource, refresh, options.collection],
  );

  // Batch operations
  const batch = useCallback(
    async (
      ids: string[],
      action: "delete" | "archive" | "restore",
      data?: Record<string, any>,
    ) => {
      try {
        const response = await api.post(`${resource}/batch/${action}`, {
          ids,
          ...data,
        });
        refresh();
        return response.data?.data || response.data;
      } catch (error: any) {
        throw new Error(
          error.response?.data?.message || `Failed to perform batch ${action}`,
        );
      }
    },
    [api, resource, refresh],
  );

  // Selection management
  const selectRecord = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
  }, []);

  // Edit mode management
  const startEdit = useCallback((record: T) => {
    setEditingRecord(record);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRecord(null);
  }, []);

  return {
    // Data
    records: records?.data || [],
    total: records?.total || 0,
    loading,

    // Operations
    create,
    read,
    update,
    remove,
    batch,

    // Selection
    selectedId,
    selectRecord,
    clearSelection,

    // Edit mode
    editingRecord,
    startEdit,
    cancelEdit,

    // Refresh
    refresh,
  };
}

export default useCollectionResource;
