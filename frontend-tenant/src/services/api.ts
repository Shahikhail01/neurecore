// ─── services/api.ts ─────────────────────────────────────────────────────────
// Legacy Axios instance kept for backward compatibility with existing stores.
// ✅ New feature code: import { restClient } from '@/core/services/api/clients/RestClient'
// ✅ New repositories: import { agentRepository } from '@/core/repositories/AgentRepository'
//
// Token lifecycle is now delegated to TokenManager (DIP).
// ErrorHandler normalises all errors consistently.

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api.types';

// ─── Infrastructure singletons ───────────────────────────────────────────────
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';
import { errorHandler } from '@/core/infrastructure/ErrorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// Inject token via TokenManager (single source of truth)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenManager.getAccessToken();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResponse>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = tokenManager.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const resp = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${API_URL}/auth/refresh`,
          { refreshToken },
        );

        const data = resp.data?.data;
        if (!data) throw new Error('Failed to refresh');

        tokenManager.setTokens(data.accessToken, data.refreshToken);

        if (original.headers) {
          original.headers['Authorization'] = `Bearer ${data.accessToken}`;
        }
        return api(original);
      } catch {
        tokenManager.clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
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
export { restClient } from '@/core/services/api/clients/RestClient';
