/**
 * Axios Interceptor
 * Handles JWT token injection and automatic refresh
 */

import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from "axios";
import {
  clearStoredAuthSession,
  extractAuthSessionPayload,
  getStoredAccessToken,
  getStoredRefreshToken,
  setStoredAuthSession,
} from "@/lib/auth-session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

let isRefreshing = false;
let failedQueue: PendingRequest[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  isRefreshing = false;
  failedQueue = [];
};

export function setupAxiosInterceptors(axiosInstance: AxiosInstance) {
  // Request interceptor - add JWT token
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getStoredAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor - handle token refresh on 401
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return axiosInstance(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = getStoredRefreshToken();

        if (!refreshToken) {
          // No refresh token available, logout
          clearStoredAuthSession({ includeUser: true });
          window.location.href = "/login";
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/v1/auth/refresh`,
            { refreshToken },
            { withCredentials: true },
          );

          const tokens = extractAuthSessionPayload(response);

          if (!tokens?.accessToken) {
            throw new Error("Refresh response missing access token");
          }

          setStoredAuthSession(tokens);

          axiosInstance.defaults.headers.common["Authorization"] =
            `Bearer ${tokens.accessToken}`;
          originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;

          processQueue(null, tokens.accessToken);

          return axiosInstance(originalRequest);
        } catch (err) {
          processQueue(err, null);
          clearStoredAuthSession({ includeUser: true });
          window.location.href = "/login";
          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    },
  );

  return axiosInstance;
}

// Create and export configured axios instance
export const apiClient = setupAxiosInterceptors(
  axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
  }),
);
