/**
 * useDataSource Hook
 * Provides access to collection definitions and data source utilities
 */

import { useMemo } from "react";
import { collections, Collection, getCollection } from "./Collection";

export const useCollections = (): Collection[] => {
  return useMemo(() => collections, []);
};

export const useCollection = (name: string): Collection | undefined => {
  return useMemo(() => getCollection(name), [name]);
};

export const useCollectionField = (
  collectionName: string,
  fieldName: string,
) => {
  const collection = useCollection(collectionName);
  return useMemo(
    () => collection?.fields.find((f) => f.name === fieldName),
    [collection, fieldName],
  );
};

export default useCollections;
