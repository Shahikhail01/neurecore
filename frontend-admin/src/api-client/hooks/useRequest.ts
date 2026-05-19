/**
 * useRequest Hook
 * Generic data fetching hook based on NocoBase pattern
 */

"use client";

import { useRequest as useReq, useSetState } from "ahooks";
import { Options, Result } from "ahooks/es/useRequest/src/types";
import { SetState } from "ahooks/lib/useSetState";
import { AxiosRequestConfig } from "axios";
import cloneDeep from "lodash/cloneDeep";
import merge from "lodash/merge";
import { useMemo } from "react";
import { useAPIClient } from "./useAPIClient";

const API_BASE_PATH = (() => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    return "";
  }

  try {
    return new URL(apiUrl, "http://localhost").pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
})();

const stripResourceIdentifier = (value: Record<string, any>) => {
  const { filterByTk, id, ...rest } = value;
  return rest;
};

const normalizeResourcePath = (resource: string) => {
  if (!resource) {
    return resource;
  }

  if (/^https?:\/\//i.test(resource)) {
    return resource;
  }

  let normalizedPath = resource.startsWith("/") ? resource : `/${resource}`;

  if (API_BASE_PATH && normalizedPath.startsWith(`${API_BASE_PATH}/`)) {
    normalizedPath = normalizedPath.slice(API_BASE_PATH.length);
  }

  return normalizedPath;
};

const buildResourceRequestConfig = (
  service: ResourceActionOptions,
  params: Record<string, any>,
): AxiosRequestConfig => {
  const {
    resource = "",
    action = "list",
    skipAuth,
    skipNotify,
  } = service;
  const normalizedPath = normalizeResourcePath(resource);
  const requestParams = { ...service.params, ...params };
  const recordId = requestParams.filterByTk ?? requestParams.id;

  const config: AxiosRequestConfig = {
    skipAuth,
    skipNotify,
  } as AxiosRequestConfig;

  switch (action) {
    case "list":
      config.url = normalizedPath;
      config.method = "get";
      config.params = requestParams;
      return config;
    case "get":
    case "read":
      config.url =
        recordId && !normalizedPath.endsWith(`/${recordId}`)
          ? `${normalizedPath}/${recordId}`
          : normalizedPath;
      config.method = "get";
      config.params = stripResourceIdentifier(requestParams);
      return config;
    case "create":
      config.url = normalizedPath;
      config.method = "post";
      config.data = requestParams;
      return config;
    case "update":
      config.url =
        recordId && !normalizedPath.endsWith(`/${recordId}`)
          ? `${normalizedPath}/${recordId}`
          : normalizedPath;
      config.method = "patch";
      config.data = stripResourceIdentifier(requestParams);
      return config;
    case "delete":
    case "destroy":
      config.url =
        recordId && !Array.isArray(recordId) && !normalizedPath.endsWith(`/${recordId}`)
          ? `${normalizedPath}/${recordId}`
          : normalizedPath;
      config.method = "delete";
      config.data = Array.isArray(recordId)
        ? { ids: recordId }
        : stripResourceIdentifier(requestParams);
      return config;
    default:
      config.url = `${normalizedPath}/${action}`;
      config.method = "get";
      config.params = requestParams;
      return config;
  }
};

type FunctionService = (...args: any[]) => Promise<any>;

export type ReturnTypeOfUseRequest<TData = any> = ReturnType<
  typeof useRequest<TData>
>;

export type ResourceActionOptions<P = any> = {
  resource?: string;
  resourceOf?: any;
  action?: string;
  params?: P;
  url?: string;
  skipNotify?: boolean | ((error: any) => boolean);
  skipAuth?: boolean;
};

export type UseRequestService<P = any> =
  | AxiosRequestConfig<P>
  | ResourceActionOptions<P>
  | FunctionService;
export type UseRequestOptions = Options<any, any> & { uid?: string };

export interface UseRequestResult<P = any> extends Result<P, any> {
  state: any;
  setState: SetState<Record<string, any>>;
}

/**
 * Generic hook for data fetching
 *
 * @example
 * // For list operations
 * const { data, loading, error, run } = useRequest({
 *   resource: 'agents',
 *   action: 'list',
 *   params: { limit: 20, offset: 0 }
 * });
 *
 * @example
 * // For manual operations (create, update, delete)
 * const { run: createAgent } = useRequest({
 *   resource: 'agents',
 *   action: 'create'
 * }, { manual: true });
 *
 * // Then call it manually
 * createAgent({ name: 'New Agent' })
 */
export function useRequest<P = any>(
  service: UseRequestService<P>,
  options: UseRequestOptions = {},
): UseRequestResult<P> {
  const [state, setState] = useSetState({});
  const api = useAPIClient();

  let tempService: FunctionService;

  if (typeof service === "function") {
    tempService = service;
  } else if (service) {
    tempService = async (params = {}) => {
      const { resource, url, skipAuth, skipNotify } =
        service as ResourceActionOptions;

      // Build the request config
      let config: AxiosRequestConfig = {
        skipAuth,
        skipNotify,
      } as AxiosRequestConfig;

      if (resource) {
        config = buildResourceRequestConfig(
          service as ResourceActionOptions,
          params as Record<string, any>,
        );
      } else if (url) {
        // Direct URL
        config.url = url;
        config.method = "get";
        config.params = { ...service.params, ...params };
      } else {
        // Standard axios config
        config = merge(cloneDeep(service), params) as AxiosRequestConfig;
      }

      const response = await api.request(config);
      return response?.data;
    };
  } else {
    tempService = async () => ({});
  }

  const tempOptions = {
    ...options,
    onSuccess(...args: any[]) {
      options.onSuccess?.(...args);
      if (options.uid) {
        api.services[options.uid] = result;
      }
    },
  };

  const result = useReq<P, any>(tempService, tempOptions);

  return useMemo(
    () => ({
      ...result,
      state,
      setState,
    }),
    [result, setState, state],
  );
}

export default useRequest;
