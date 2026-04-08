/**
 * useResource Hook
 * Provides CRUD operations for a collection
 */

import { useCallback } from "react";
import {
  useRequest,
  ResourceActionOptions,
  UseRequestResult,
} from "@/api-client";
import { useCollection } from "@/data-source/collection/useCollections";

interface UseResourceOptions {
  collection: string;
  pageSize?: number;
}

export interface ResourceActions<T = any> {
  list: (params?: any) => Promise<any>;
  get: (id: string) => Promise<T>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  delete: (id: string | string[]) => Promise<void>;
  refresh?: () => Promise<void>;
}

/**
 * Hook to access resource CRUD operations
 *
 * @example
 * const resource = useResource({ collection: 'agents' });
 * const { data: agents, loading } = resource.list();
 * const agent = await resource.get('agent-123');
 * const newAgent = await resource.create({ name: 'Agent Name' });
 */
export const useResource = ({
  collection,
  pageSize = 20,
}: UseResourceOptions): ResourceActions => {
  const collectionDef = useCollection(collection);

  const listRequest = useRequest<any>(
    {
      resource: collection,
      action: "list",
      params: { limit: pageSize },
    } as ResourceActionOptions,
    { manual: true },
  );

  // List action
  const list = useCallback(
    async (params = {}) => {
      return listRequest.run({ limit: pageSize, ...params });
    },
    [listRequest, pageSize],
  );

  // Get single record
  const get = useCallback(
    async (id: string) => {
      const { data } = await useRequest(
        {
          url: `/${collection}/${id}`,
        } as ResourceActionOptions,
        { manual: false },
      ).data;
      return data;
    },
    [collection],
  );

  // Create record
  const create = useCallback(
    async (record: any) => {
      const { data } = await useRequest(
        {
          resource: collection,
          action: "create",
        } as ResourceActionOptions,
        { manual: false },
      ).data;
      return data;
    },
    [collection],
  );

  // Update record
  const update = useCallback(
    async (id: string, record: any) => {
      const { data } = await useRequest(
        {
          resource: collection,
          action: "update",
          params: { filterByTk: id },
        } as ResourceActionOptions,
        { manual: false },
      ).data;
      return data;
    },
    [collection],
  );

  // Delete record(s)
  const del = useCallback(
    async (ids: string | string[]) => {
      const idArray = Array.isArray(ids) ? ids : [ids];
      await useRequest(
        {
          resource: collection,
          action: "delete",
          params: { filterByTk: idArray },
        } as ResourceActionOptions,
        { manual: false },
      );
    },
    [collection],
  );

  return {
    list,
    get,
    create,
    update,
    delete: del,
    refresh: list,
  };
};

export default useResource;
