// ─── RestClient.ts ────────────────────────────────────────────────────────────
// DIP: Implements IApiClient — all feature services depend on this interface.
// SRP: Handles HTTP transport, auth injection, token refresh, error wrapping.
// OCP: Interceptors are pluggable; new auth strategies extend without modifying.

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import type { IApiClient, RequestConfig, ApiResponse } from '@/core/services/api/interfaces/IApiClient';
import type { ITokenManager } from '@/core/services/api/interfaces/ITokenManager';
import type { IErrorHandler } from '@/core/services/api/interfaces/IErrorHandler';

export class RestClient implements IApiClient {
  private readonly axios: AxiosInstance;
  private refreshInFlight: Promise<void> | null = null;

  constructor(
    baseUrl: string,
    private readonly tokenManager: ITokenManager,
    private readonly errorHandler: IErrorHandler,
  ) {
    this.axios = axios.create({
      baseURL: baseUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    });

    this.attachRequestInterceptor();
    this.attachResponseInterceptor();
  }

  // ─── Public HTTP methods ────────────────────────────────────────────────────

  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.get<ApiResponse<T>>(endpoint, this.mapConfig(config));
    return res.data;
  }

  async post<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.post<ApiResponse<T>>(endpoint, data, this.mapConfig(config));
    return res.data;
  }

  async patch<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.patch<ApiResponse<T>>(endpoint, data, this.mapConfig(config));
    return res.data;
  }

  async put<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.put<ApiResponse<T>>(endpoint, data, this.mapConfig(config));
    return res.data;
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.delete<ApiResponse<T>>(endpoint, this.mapConfig(config));
    return res.data;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private mapConfig(config?: RequestConfig): Record<string, unknown> {
    return {
      params: config?.params,
      headers: config?.headers,
      signal: config?.signal,
    };
  }

  private attachRequestInterceptor(): void {
    this.axios.interceptors.request.use((req: InternalAxiosRequestConfig) => {
      const token = this.tokenManager.getAccessToken();
      if (token && req.headers) {
        req.headers['Authorization'] = `Bearer ${token}`;
      }
      return req;
    });
  }

  private attachResponseInterceptor(): void {
    this.axios.interceptors.response.use(
      (res) => res,
      async (error: AxiosError<ApiResponse>) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;

          // Serialise parallel refresh attempts into a single request
          if (!this.refreshInFlight) {
            this.refreshInFlight = this.doRefresh().finally(() => {
              this.refreshInFlight = null;
            });
          }

          try {
            await this.refreshInFlight;
            // Retry original request with new token
            const newToken = this.tokenManager.getAccessToken();
            if (original.headers) original.headers['Authorization'] = `Bearer ${newToken}`;
            return this.axios(original);
          } catch {
            this.tokenManager.clearTokens();
            if (typeof window !== 'undefined') window.location.href = '/login';
          }
        }

        const appError = this.errorHandler.fromStatus(
          error.response?.status ?? 0,
          (error.response?.data as ApiResponse)?.error?.message,
        );
        this.errorHandler.handle(appError);
        return Promise.reject(appError);
      },
    );
  }

  private async doRefresh(): Promise<void> {
    const refreshToken = this.tokenManager.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token available');

    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${this.axios.defaults.baseURL}/auth/refresh`,
      { refreshToken },
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error('Token refresh failed');
    }

    this.tokenManager.setTokens(res.data.data.accessToken, res.data.data.refreshToken);
  }
}

// ─── App-wide singleton ───────────────────────────────────────────────────────
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';
import { errorHandler } from '@/core/infrastructure/ErrorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const restClient = new RestClient(API_URL, tokenManager, errorHandler);
