// ─── RestClient.ts (cookie-only, F1) ─────────────────────────────────────────
//
// DIP: Implements IApiClient — all feature services depend on this interface.
// SRP: Handles HTTP transport, auth cookie injection, token refresh, error wrapping.
// OCP: Interceptors are pluggable; new auth strategies extend without modifying.
//
// FIX-020: hard-redirect on 401 replaced with authService.reportAuthFailure()
// so the user lands on the SessionExpiredScreen instead of a redirect loop.

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import type { IApiClient, RequestConfig, ApiResponse } from '@/core/services/api/interfaces/IApiClient';
import type { ITokenManager } from '@/core/services/api/interfaces/ITokenManager';
import type { IErrorHandler } from '@/core/services/api/interfaces/IErrorHandler';
import { authService } from '@/auth';

const CSRF_COOKIE = '__Host-nc_csrf';
const CSRF_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google'];
const REFRESH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];

function shouldAttemptRefresh(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.split('?')[0];
  return !REFRESH_EXEMPT_PATHS.some((p) => path.endsWith(p));
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const raw of cookies) {
    const eq = raw.indexOf('=');
    if (eq < 0) continue;
    const key = raw.slice(0, eq);
    if (key === name) {
      const v = raw.slice(eq + 1);
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

function csrfToken(): string | null {
  return readCookie(CSRF_COOKIE);
}

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
      withCredentials: true,
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
      timeout: config?.timeoutMs,
    };
  }

  private attachRequestInterceptor(): void {
    this.axios.interceptors.request.use((req: InternalAxiosRequestConfig) => {
      if (typeof window === 'undefined') return req;

      // F1: no Authorization header. Cookies travel via withCredentials.
      // F6: echo __Host-nc_csrf as X-CSRF-Token on all state-changing
      //     calls, except the explicitly exempted ones.
      const method = (req.method ?? '').toUpperCase();
      const url = req.url ?? '';
      const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const isExempt = CSRF_EXEMPT_PATHS.some((p) => url.endsWith(p));
      if (isStateChanging && !isExempt) {
        const csrf = csrfToken();
        if (csrf) {
          req.headers = req.headers ?? {};
          req.headers['X-CSRF-Token'] = csrf;
        }
      }

      return req;
    });
  }

  private attachResponseInterceptor(): void {
    this.axios.interceptors.response.use(
      (res) => res,
      async (error: AxiosError<ApiResponse>) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !original._retry && shouldAttemptRefresh(original.url)) {
          original._retry = true;

          // F21: serialise parallel refresh attempts into a single request.
          if (!this.refreshInFlight) {
            this.refreshInFlight = this.doRefresh().finally(() => {
              this.refreshInFlight = null;
            });
          }

          try {
            await this.refreshInFlight;
            // Retry — the browser picked up the new __Host-nc_at via Set-Cookie.
            return this.axios(original);
          } catch {
            // FIX-020: report the failure to the AuthService, never redirect.
            authService.reportAuthFailure({ type: 'session_expired' });
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
    // Cookie-only: no body. The server rotates __Host-nc_at + __Host-nc_rt
    // via Set-Cookie on the response.
    const res = await axios.post<ApiResponse<{ accessToken: string }>>(
      `${this.axios.defaults.baseURL}/auth/refresh`,
      {},
      {
        withCredentials: false,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken() ?? '',
        },
        timeout: 5000,
      },
    );

    if (res.data.status !== 'success' || !res.data.data) {
      throw new Error('Token refresh failed');
    }
    // Server has already rotated cookies via Set-Cookie. No client-side
    // token storage needed — the browser jar is the source of truth.
  }
}

// ─── App-wide singleton ───────────────────────────────────────────────────────
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';
import { errorHandler } from '@/core/infrastructure/ErrorHandler';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export const restClient = new RestClient(API_URL, tokenManager, errorHandler);
