/**
 * useCollection Hook
 * High-level collection management hook combining metadata & CRUD operations
 * Adapted from NocoBase's useCollection pattern
 */

"use client";

import { useCallback, useMemo } from "react";
import { useCollectionResource } from "./hooks/useCollectionResource";
import { collectionRegistry, CollectionMetadata } from "./CollectionRegistry";
import {
  QueryBuilder,
  FilterCondition,
  SortSpecification,
} from "./QueryBuilder";

export interface UseCollectionOptions {
  collectionName: string;
  pagination?: { page: number; pageSize: number };
  filters?: FilterCondition[];
  sorts?: SortSpecification[];
  search?: string;
  searchFields?: string[];
}

export interface UseCollectionResult<T = any> {
  // Data
  records: T[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error?: Error;

  // Metadata
  metadata: CollectionMetadata | undefined;
  displayField: string;
  primaryKey: string;

  // CRUD Operations
  create: (data: Partial<T>) => Promise<T>;
  read: (id: string) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
  batch: {
    delete: (ids: string[]) => Promise<void>;
    archive: (ids: string[]) => Promise<void>;
    restore: (ids: string[]) => Promise<void>;
  };

  // Query Management
  query: QueryBuilder;
  refresh: () => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilters: (filters: FilterCondition[]) => void;
  addFilter: (condition: FilterCondition) => void;
  setSorts: (sorts: SortSpecification[]) => void;
  addSort: (sort: SortSpecification) => void;
  search: (term: string) => void;

  // Permissions
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;

  // Selection & Editing
  selectedIds: string[];
  selectRecord: (id: string) => void;
  clearSelection: () => void;
  editingId?: string;
  startEdit: (id: string) => void;
  cancelEdit: () => void;
}

/**
 * Hook for collection-based data management with metadata awareness
 */
export function useCollection<T = any>(
  options: UseCollectionOptions,
): UseCollectionResult<T> {
  const {
    collectionName,
    pagination = { page: 1, pageSize: 20 },
    filters = [],
    sorts = [],
    search: searchTerm,
    searchFields = [],
  } = options;

  // Get metadata
  const metadata = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName],
  );

  const resource = metadata?.resource || `/api/v1/${collectionName}`;

  // Get base CRUD operations
  const {
    records,
    total,
    page,
    pageSize,
    loading,
    error,
    create,
    read,
    update,
    remove,
    batch,
    selectedIds,
    selectRecord,
    clearSelection,
    editingId,
    startEdit,
    cancelEdit,
  } = useCollectionResource<T>({
    collection: collectionName,
    resource,
    pagination,
  });

  // Build query
  const query = useMemo(() => {
    const qb = new QueryBuilder();
    qb.paginate(page, pageSize);

    // Add filters
    filters.forEach((filter) => {
      qb.addFilter(filter);
    });

    // Add search if provided
    if (searchTerm && searchFields.length > 0) {
      // Use OR logic for search across multiple fields
      const originalLogic = qb["groupLogic" as any];
      qb.setGroupLogic("or");
      searchFields.forEach((field) => {
        qb.contains(field, searchTerm);
      });
      if (originalLogic) {
        qb.setGroupLogic(originalLogic);
      }
    }

    // Add sorts
    sorts.forEach((sort) => {
      qb.sort(sort.field, sort.direction);
    });

    return qb;
  }, [page, pageSize, filters, searchTerm, searchFields, sorts]);

  // Permission checks
  const canCreate = metadata
    ? collectionRegistry.canAction(collectionName, "create")
    : false;
  const canRead = metadata
    ? collectionRegistry.canAction(collectionName, "read")
    : false;
  const canUpdate = metadata
    ? collectionRegistry.canAction(collectionName, "update")
    : false;
  const canDelete = metadata
    ? collectionRegistry.canAction(collectionName, "delete")
    : false;

  // Get field info
  const displayField = metadata
    ? collectionRegistry.getDisplayField(collectionName)
    : "id";
  const primaryKey = metadata
    ? collectionRegistry.getPrimaryKey(collectionName)
    : "id";

  // Pagination setters
  const setPage = useCallback((newPage: number) => {
    // This would trigger a re-fetch in real implementation
    // For now, return the method signature
  }, []);

  const setPageSize = useCallback((newPageSize: number) => {
    // Pagination change
  }, []);

  // Filter management
  const setFilters = useCallback((newFilters: FilterCondition[]) => {
    // Filter update
  }, []);

  const addFilter = useCallback((condition: FilterCondition) => {
    // Add single filter
  }, []);

  // Sort management
  const setSorts = useCallback((newSorts: SortSpecification[]) => {
    // Sort update
  }, []);

  const addSort = useCallback((sort: SortSpecification) => {
    // Add single sort
  }, []);

  // Search
  const handleSearch = useCallback((term: string) => {
    // Trigger search
  }, []);

  return {
    // Data
    records,
    total,
    page,
    pageSize,
    loading,
    error,

    // Metadata
    metadata,
    displayField,
    primaryKey,

    // CRUD
    create,
    read,
    update,
    remove,
    batch,

    // Queries
    query,
    refresh: async () => {
      // Refresh data from server
    },
    setPage,
    setPageSize,
    setFilters,
    addFilter,
    setSorts,
    addSort,
    search: handleSearch,

    // Permissions
    canCreate,
    canRead,
    canUpdate,
    canDelete,

    // Selection & Editing
    selectedIds,
    selectRecord,
    clearSelection,
    editingId,
    startEdit,
    cancelEdit,
  };
}

/**
 * Hook for working with a specific record in a collection
 */
export function useCollectionRecord<T = any>(
  collectionName: string,
  recordId: string,
) {
  const metadata = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName],
  );

  const resource = metadata?.resource || `/api/v1/${collectionName}`;

  const { read, update, remove } = useCollectionResource<T>({
    collection: collectionName,
    resource,
  });

  return {
    // Metadata
    metadata,
    primaryKey: metadata?.primaryKey || "id",

    // Operations
    read: () => read(recordId),
    update: (data: Partial<T>) => update(recordId, data),
    delete: () => remove(recordId),

    // Permissions
    canRead: metadata
      ? collectionRegistry.canAction(collectionName, "read")
      : false,
    canUpdate: metadata
      ? collectionRegistry.canAction(collectionName, "update")
      : false,
    canDelete: metadata
      ? collectionRegistry.canAction(collectionName, "delete")
      : false,
  };
}

/**
 * Hook for working with related records in a collection
 */
export function useCollectionRelation<T = any>(
  collectionName: string,
  relationField: string,
) {
  const metadata = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName],
  );

  const fieldMetadata = metadata?.fields.find((f) => f.name === relationField);

  return {
    fieldMetadata,
    relationField,
    isValidRelation: !!fieldMetadata,

    // Query builder for related records
    query: () => {
      const qb = new QueryBuilder();
      qb.select(relationField);
      return qb;
    },
  };
}

export default useCollection;
