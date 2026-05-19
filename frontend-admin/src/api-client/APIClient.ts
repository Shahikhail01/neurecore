/**
 * NeureCore API Client
 * Based on NocoBase's APIClient pattern
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { notification } from "antd";
import {
  clearStoredAuthSession,
  extractAuthSessionPayload,
  getStoredRefreshToken,
  setStoredAccessToken,
  setStoredAuthSession,
} from "@/lib/auth-session";

export class APIClient {
  public axios: AxiosInstance;
  public token: string | null = null;
  public baseURL: string;
  services: Record<string, any> = {};

  constructor(options: { baseURL?: string; token?: string } = {}) {
    this.baseURL =
      options.baseURL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:3000";
    this.token = options.token || null;

    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: any) => {
        const skipNotify = error.config?.skipNotify;
        if (!skipNotify && error.response?.status !== 401) {
          notification.error({
            message: "Error",
            description: error.response?.data?.message || error.message,
          });
        }

        const originalConfig =
          (error.config as InternalAxiosRequestConfig & { _retry?: boolean }) ||
          undefined;
        const skipAuth = originalConfig?.skipAuth;

        if (error.response?.status === 401) {
          if (originalConfig && !originalConfig._retry) {
            originalConfig._retry = true;

            try {
              const refreshToken = getStoredRefreshToken();

              if (!refreshToken) {
                throw new Error("No refresh token available");
              }

              const refreshResponse = await axios.post(
                `${this.baseURL}/auth/refresh`,
                { refreshToken },
                {
                  timeout: 5000,
                  headers: {
                    "Content-Type": "application/json",
                  },
                },
              );
              const session = extractAuthSessionPayload(refreshResponse);

              if (!session?.accessToken) {
                throw new Error("Refresh response missing access token");
              }

              setStoredAuthSession(session);
              this.token = session.accessToken;
              originalConfig.headers = originalConfig.headers || {};
              originalConfig.headers.Authorization =
                `Bearer ${session.accessToken}`;

              return this.axios.request(originalConfig);
            } catch {
              // Fall through to the shared unauthenticated cleanup path.
            }
          }

          this.setToken(null);
          clearStoredAuthSession({ includeUser: true });
          if (skipAuth) {
            // Caller handles unauthenticated state — suppress the error silently
            return Promise.resolve({ data: null });
          }
          // Redirect to login only if not already there
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = "/login";
          }
          return Promise.reject(error);
        }
        throw error;
      },
    );
  }

  public setToken(token: string | null) {
    this.token = token;
    setStoredAccessToken(token);
  }

  public getToken() {
    return this.token;
  }

  public async request<T = any>(
    config: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axios.request<T>(config);
  }

  public async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axios.get<T>(url, config);
  }

  public async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axios.post<T>(url, data, config);
  }

  public async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axios.put<T>(url, data, config);
  }

  public async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axios.patch<T>(url, data, config);
  }

  public async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axios.delete<T>(url, config);
  }

  public service(uid: string) {
    return this.services[uid];
  }
}

export default APIClient;
