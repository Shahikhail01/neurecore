/**
 * useAssociation Hook
 * Manage nested relationships and eager loading for associated collections
 * Pattern adapted from NocoBase's AssociationProvider & association handling
 */

"use client";

import { createContext, useContext, useMemo, ReactNode, FC } from "react";
import { useCollectionResource } from "./useCollectionResource";
import { collectionRegistry } from "../CollectionRegistry";

export interface AssociationContextValue {
  associationName: string;
  parentCollectionName: string;
  parentRecordId: string;
  targetCollectionName: string;
  targetField: string;
  loading: boolean;
  data: any[];
}

const AssociationContext = createContext<AssociationContextValue | null>(null);

export interface AssociationProviderProps {
  name: string; // e.g., 'agents.tasks'
  parentRecordId: string;
  children: ReactNode;
}

/**
 * Provider for association context - wraps nested collection data
 */
export const AssociationProvider: FC<AssociationProviderProps> = ({
  name,
  parentRecordId,
  children,
}) => {
  const [parentCollectionName, targetField] = name.split(".");

  const parentCollection = useMemo(
    () => collectionRegistry.get(parentCollectionName),
    [parentCollectionName]
  );

  const fieldMeta = useMemo(
    () =>
      parentCollection?.fields.find(f => f.name === targetField),
    [parentCollection, targetField]
  );

  const targetCollectionName = useMemo(
    () => fieldMeta?.title?.toLowerCase() || targetField,
    [fieldMeta, targetField]
  );

  const { records, loading } = useCollectionResource({
    collection: targetCollectionName,
    resource: `/api/v1/${parentCollectionName}/${parentRecordId}/${targetField}`,
  });

  const value = useMemo(
    () => ({
      associationName: name,
      parentCollectionName,
      parentRecordId,
      targetCollectionName,
      targetField,
      loading,
      data: records,
    }),
    [
      name,
      parentCollectionName,
      parentRecordId,
      targetCollectionName,
      targetField,
      loading,
      records,
    ]
  );

  return (
    <AssociationContext.Provider value={value}>
      {children}
    </AssociationContext.Provider>
  );
};

/**
 * Hook to get association context
 */
export function useAssociationContext(): AssociationContextValue {
  const context = useContext(AssociationContext);
  if (!context) {
    throw new Error(
      "useAssociationContext must be used within AssociationProvider"
    );
  }
  return context;
}

/**
 * Hook to get association name
 */
export function useAssociationName(): string | null {
  const context = useContext(AssociationContext);
  return context?.associationName || null;
}

/**
 * Hook to get parent collection name
 */
export function useParentCollectionName(): string | null {
  const context = useContext(AssociationContext);
  return context?.parentCollectionName || null;
}

/**
 * Hook to get parent record ID
 */
export function useParentRecordId(): string | null {
  const context = useContext(AssociationContext);
  return context?.parentRecordId || null;
}

/**
 * Hook to get target collection data
 */
export function useAssociationData<T = any>(): T[] {
  const context = useContext(AssociationContext);
  if (!context) {
    return [];
  }
  return (context.data || []) as T[];
}

/**
 * Hook for eager loading related records
 */
export function useEagerLoad<T = any>(
  collectionName: string,
  parentId: string,
  relationField: string
) {
  const { records: data, loading } = useCollectionResource<T>({
    collection: collectionName,
    resource: `/api/v1/${collectionName}/${parentId}/${relationField}`,
  });

  return {
    data,
    loading,
    isEmpty: data.length === 0,
  };
}

/**
 * Hook to load nested associations recursively
 */
export function useNestedAssociation<T = any>(
  path: string, // e.g., 'agents.tasks.approvals'
  parentId: string
) {
  const parts = path.split(".");
  const [parentCollection, ...relationFields] = parts;

  const parentMeta = useMemo(
    () => collectionRegistry.get(parentCollection),
    [parentCollection]
  );

  // Load first level association
  const { records: level1Data, loading: level1Loading } =
    useCollectionResource<T>({
      collection: relationFields[0],
      resource: `/api/v1/${parentCollection}/${parentId}/${relationFields[0]}`,
    });

  // Loading state for nested data
  const isLoading = level1Loading;

  return {
    data: level1Data,
    loading: isLoading,
    path,
    levels: relationFields.length,
  };
}

/**
 * Hook to check if field is an association
 */
export function useIsAssociation(
  collectionName: string,
  fieldName: string
): boolean {
  const collection = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName]
  );

  const field = useMemo(
    () => collection?.fields.find(f => f.name === fieldName),
    [collection, fieldName]
  );

  return field?.type === "association" || field?.type === "belongsTo" || false;
}

/**
 * Hook to get association target collection
 */
export function useAssociationTarget(
  collectionName: string,
  fieldName: string
): string | null {
  const collection = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName]
  );

  const field = useMemo(
    () => collection?.fields.find(f => f.name === fieldName),
    [collection, fieldName]
  );

  return field?.title?.toLowerCase() || null;
}

/**
 * Hook to list all associations in a collection
 */
export function useCollectionAssociations(
  collectionName: string
): Array<{ name: string; target: string; type: string }> {
  const collection = useMemo(
    () => collectionRegistry.get(collectionName),
    [collectionName]
  );

  return useMemo(() => {
    return (collection?.fields || [])
      .filter(
        f =>
          f.type === "association" ||
          f.type === "belongsTo" ||
          f.type === "hasMany"
      )
      .map(f => ({
        name: f.name,
        target:
          (f.title?.toLowerCase() || f.name.slice(0, -1)) as string,
        type: f.type,
      }));
  }, [collection]);
}

export default useAssociation;
