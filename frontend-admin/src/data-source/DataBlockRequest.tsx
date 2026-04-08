/**
 * Data Block Request Manager
 * Manages data fetching and request lifecycle for data blocks
 * Pattern adapted from NocoBase's DataBlockRequestProvider with useRequest integration
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  FC,
  useEffect,
} from "react";
import { useAPIClient } from "@/api-client";
import { useRequest } from "@/api-client/hooks/useRequest";

export interface BlockRequestOptions {
  resource: string;
  action?: string;
  params?: Record<string, any>;
  method?: "get" | "post" | "put" | "delete" | "patch";
  uid?: string; // For caching via uid
}

export interface BlockRequestState {
  data?: any;
  loading: boolean;
  error?: Error;
  params?: Record<string, any>;
}

export interface DataBlockRequestContextValue {
  // State
  state: BlockRequestState;
  loading: boolean;
  error?: Error;
  data?: any;
  params?: Record<string, any>;

  // Operations
  fetch: (options: BlockRequestOptions) => Promise<any>;
  refetch: () => Promise<any>;
  setParams: (params: Record<string, any>) => void;
  setData: (data: any) => void;
  setError: (error?: Error) => void;
  setLoading: (loading: boolean) => void;
  
  // Last request info
  lastRequest?: BlockRequestOptions;
}

const DataBlockRequestContext = createContext<DataBlockRequestContextValue | null>(null);

export interface DataBlockRequestProviderProps {
  initialOptions?: BlockRequestOptions;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
}

/**
 * Provider for data block request management
 */
export const DataBlockRequestProvider: FC<DataBlockRequestProviderProps> = ({
  initialOptions,
  onSuccess,
  onError,
  children,
}) => {
  const apiClient = useAPIClient();
  const [state, setState] = useState<BlockRequestState>({
    data: undefined,
    loading: false,
    error: undefined,
    params: initialOptions?.params,
  });
  const [lastRequest, setLastRequest] = useState<BlockRequestOptions | undefined>(
    initialOptions
  );

  /**
   * Fetch data using options
   */
  const fetch = useCallback(
    async (options: BlockRequestOptions): Promise<any> => {
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      setLastRequest(options);

      try {
        const { resource, action = "list", method = "get", params, uid } = options;

        let endpoint = resource;
        if (action && action !== "list") {
          endpoint = `${resource}/${action}`;
        }

        const response = await apiClient[method as keyof typeof apiClient](
          endpoint,
          method === "get" ? { params } : params || {},
          uid ? { uid } : {}
        );

        const data = response?.data || response;
        setState(prev => ({
          ...prev,
          data,
          loading: false,
          params: params || prev.params,
        }));

        if (onSuccess) {
          onSuccess(data);
        }

        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState(prev => ({
          ...prev,
          error: err,
          loading: false,
        }));

        if (onError) {
          onError(err);
        }

        throw err;
      }
    },
    [apiClient, onSuccess, onError]
  );

  /**
   * Refetch using last request
   */
  const refetch = useCallback(async (): Promise<any> => {
    if (!lastRequest) {
      throw new Error("No previous request to refetch");
    }
    return fetch(lastRequest);
  }, [fetch, lastRequest]);

  /**
   * Set request parameters
   */
  const setParams = useCallback((params: Record<string, any>) => {
    setState(prev => ({
      ...prev,
      params,
    }));

    if (lastRequest) {
      setLastRequest({
        ...lastRequest,
        params,
      });
    }
  }, [lastRequest]);

  /**
   * Set response data
   */
  const setData = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      data,
    }));
  }, []);

  /**
   * Set error state
   */
  const setError = useCallback((error?: Error) => {
    setState(prev => ({
      ...prev,
      error,
    }));
  }, []);

  /**
   * Set loading state
   */
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({
      ...prev,
      loading,
    }));
  }, []);

  const value = useMemo<DataBlockRequestContextValue>(
    () => ({
      state,
      loading: state.loading,
      error: state.error,
      data: state.data,
      params: state.params,
      fetch,
      refetch,
      setParams,
      setData,
      setError,
      setLoading,
      lastRequest,
    }),
    [state, fetch, refetch, setParams, setData, setError, setLoading, lastRequest]
  );

  return (
    <DataBlockRequestContext.Provider value={value}>
      {children}
    </DataBlockRequestContext.Provider>
  );
};

/**
 * Hook to use data block request context
 */
export function useDataBlockRequest(): DataBlockRequestContextValue {
  const context = useContext(DataBlockRequestContext);
  if (!context) {
    throw new Error(
      "useDataBlockRequest must be used within DataBlockRequestProvider"
    );
  }
  return context;
}

/**
 * Hook for data fetching with automatic caching
 */
export function useBlockData(options: BlockRequestOptions & { auto?: boolean } = {}) {
  const { fetch, state, refetch } = useDataBlockRequest();
  const [autoFetch] = useState(options.auto !== false);

  useEffect(() => {
    if (autoFetch && options.resource) {
      fetch(options);
    }
  }, [options.resource, autoFetch, fetch, options]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    fetch: () => fetch(options),
    refetch,
  };
}

/**
 * Hook for list block data
 */
export function useListBlockData(
  resource: string,
  params?: Record<string, any>,
  options?: { auto?: boolean; uid?: string }
) {
  const { state, fetch, setParams } = useDataBlockRequest();

  useEffect(() => {
    if (options?.auto !== false) {
      fetch({
        resource,
        action: "list",
        params,
        uid: options?.uid,
      });
    }
  }, [resource, fetch, params, options?.auto, options?.uid]);

  return {
    records: Array.isArray(state.data?.data) ? state.data.data : [],
    total: state.data?.total || 0,
    loading: state.loading,
    error: state.error,
    params: state.params,
    setParams,
  };
}

/**
 * Hook for detail block data
 */
export function useDetailBlockData(
  resource: string,
  recordId?: string,
  options?: { auto?: boolean }
) {
  const { state, fetch } = useDataBlockRequest();

  useEffect(() => {
    if (options?.auto !== false && recordId) {
      fetch({
        resource: `${resource}/${recordId}`,
        action: "get",
      });
    }
  }, [resource, recordId, fetch, options?.auto]);

  return {
    record: state.data,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * Hook for form block data
 */
export function useFormBlockData(
  resource: string,
  recordId?: string,
  isCreate?: boolean
) {
  const { state, fetch, setData } = useDataBlockRequest();

  useEffect(() => {
    if (!isCreate && recordId) {
      fetch({
        resource: `${resource}/${recordId}`,
        action: "get",
      });
    }
  }, [resource, recordId, isCreate, fetch]);

  return {
    initialValues: state.data || {},
    loading: state.loading,
    error: state.error,
    setData,
  };
}

/**
 * Hook for request deferred resolution
 */
export function useDeferredBlockData<T = any>(
  options: BlockRequestOptions,
  dependencies?: any[]
) {
  const { fetch, state } = useDataBlockRequest();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const result = await fetch(options);
        if (mounted) {
          setResolved(true);
        }
      } catch (error) {
        // Error handled in provider
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, dependencies || [options.resource]);

  return {
    data: state.data as T,
    loading: state.loading,
    error: state.error,
    resolved,
  };
}

export default DataBlockRequestProvider;
