// ─── services/api.ts ─────────────────────────────────────────────────────────
// Legacy Axios instance kept for backward compatibility with existing stores.
// ✅ New feature code: import { restClient } from '@/core/services/api/clients/RestClient'
// ✅ New repositories: import { agentRepository } from '@/core/repositories/AgentRepository'
//
// Token lifecycle is now delegated to TokenManager (DIP).
// ErrorHandler normalises all errors consistently.

import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import type { ApiResponse } from "@/types/api.types";

// ─── Infrastructure singletons ───────────────────────────────────────────────
import { tokenManager } from "@/core/infrastructure/auth/TokenManager";
import { errorHandler } from "@/core/infrastructure/ErrorHandler";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
  timeout: 15000,
});

// ─── Refresh mutex ───────────────────────────────────────────────────────────
// Prevents multiple concurrent 401 responses from each trying to refresh
// the token independently (which burns the rotation window).
let isRefreshing = false;
type PendingEntry = {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
};
let pendingRefreshQueue: PendingEntry[] = [];

// Inject token via TokenManager (single source of truth)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenManager.getAccessToken();
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResponse>) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // If a refresh is already in flight, queue this request until it resolves
      if (isRefreshing) {
        return new Promise<typeof error.config>((resolve, reject) => {
          pendingRefreshQueue.push({
            resolve: (newToken: string) => {
              if (original.headers) {
                original.headers["Authorization"] = `Bearer ${newToken}`;
              }
              resolve(api(original));
            },
            reject,
          });
        });
      }

      isRefreshing = true;
      try {
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        const resp = await axios.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >(`${API_URL}/auth/refresh`, { refreshToken });

        const data = resp.data?.data;
        if (!data) throw new Error("Failed to refresh");

        tokenManager.setTokens(data.accessToken, data.refreshToken);

        // Unblock all queued requests with the new token
        pendingRefreshQueue.forEach(({ resolve }) => resolve(data.accessToken));
        pendingRefreshQueue = [];
        isRefreshing = false;

        if (original.headers) {
          original.headers["Authorization"] = `Bearer ${data.accessToken}`;
        }
        return api(original);
      } catch (refreshError) {
        // Reject all queued requests and clear auth state
        pendingRefreshQueue.forEach(({ reject }) => reject(refreshError));
        pendingRefreshQueue = [];
        isRefreshing = false;
        tokenManager.clearTokens();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    const appError = errorHandler.fromStatus(
      error.response?.status ?? 0,
      (error.response?.data as ApiResponse)?.error?.message,
    );
    errorHandler.handle(appError);
    return Promise.reject(error);
  },
);

export default api;

// ─── Export new SOLID client for use in new feature code ─────────────────────
export { restClient } from "@/core/services/api/clients/RestClient";
