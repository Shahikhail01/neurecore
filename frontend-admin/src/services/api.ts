import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosError,
} from "axios";
import { unwrapItem } from "./unwrap";
import { parseApiError, logError, AppError } from "@/lib/errors";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3000/api/v1";

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Request interceptor for adding auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  try {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_accessToken");
      if (token) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }

      // Add correlation ID header if available
      try {
        const cid =
          globalThis.crypto && (globalThis.crypto as any).randomUUID
            ? (globalThis.crypto as any).randomUUID()
            : undefined;
        if (cid) {
          config.headers = config.headers || {};
          config.headers["X-Correlation-ID"] = cid;
        }
      } catch (e) {
        // ignore correlation id failure
      }
    }
  } catch (e) {
    // In unusual environments, don't break requests
  }

  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original =
      (error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      }) || {};

    // Log all errors for debugging
    try {
      logError(error, {
        url: original?.url,
        method: original?.method,
        status: error.response?.status,
      });
    } catch (e) {
      /* noop */
    }

    // Network / connectivity fallback
    if (!error.response) {
      const netErr = new AppError(
        "Network error or backend unreachable",
        "NETWORK_ERROR",
        503,
      );
      return Promise.reject(netErr);
    }

    // Handle 401 - Unauthorized with one retry using refresh token
    if (error.response.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken =
          typeof window !== "undefined"
            ? localStorage.getItem("admin_refreshToken")
            : null;
        if (!refreshToken) throw new Error("No refresh token");

        const refreshRes = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 5000 },
        );
        const tokens = unwrapItem(refreshRes) as {
          accessToken: string;
          refreshToken: string;
        } | null;

        if (!tokens || !tokens.accessToken) throw new Error("Refresh failed");

        if (typeof window !== "undefined") {
          localStorage.setItem("admin_accessToken", tokens.accessToken);
          if (tokens.refreshToken)
            localStorage.setItem("admin_refreshToken", tokens.refreshToken);
        }

        // Attach new token and retry original request
        original.headers = original.headers || {};
        original.headers["Authorization"] = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch (refreshError) {
        // Clear tokens and redirect to login safely
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("admin_accessToken");
            localStorage.removeItem("admin_refreshToken");
            // Redirect to absolute login path to avoid basePath issues
            const origin = window.location.origin || "";
            window.location.href = origin + "/login";
          }
        } catch (e) {
          /* noop */
        }

        return Promise.reject(refreshError);
      }
    }

    // Convert to AppError for consistent handling
    const appError = parseApiError(error);

    // If token-related, ensure we clear tokens and redirect
    if (
      ["TOKEN_EXPIRED", "TOKEN_INVALID", "REFRESH_TOKEN_EXPIRED"].includes(
        appError.code,
      )
    ) {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("admin_accessToken");
          localStorage.removeItem("admin_refreshToken");
          const origin = window.location.origin || "";
          if (!window.location.pathname.includes("/login"))
            window.location.href = origin + "/login";
        }
      } catch (e) {
        /* noop */
      }
    }

    return Promise.reject(appError);
  },
);

/**
 * Type-safe API caller with error handling
 *
 * @example
 * const result = await apiCall(() => api.get('/users'));
 */
export async function apiCall<T>(
  requestFn: () => Promise<{ data: T }>,
): Promise<T> {
  try {
    const response = await requestFn();
    return response.data;
  } catch (error) {
    // Error is already handled by interceptor
    throw error;
  }
}

export { AppError };
export default api;
