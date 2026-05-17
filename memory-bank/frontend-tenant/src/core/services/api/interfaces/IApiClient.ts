// ─── IApiClient.ts ────────────────────────────────────────────────────────────
// ISP: Only the methods a caller needs — no fat, monolithic HTTP wrapper.
// DIP: All higher-level services depend on this abstraction, not Axios/fetch.

export interface RequestConfig {
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string; requestId: string };
}

// Paginated wrapper returned by list endpoints
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IApiClient {
  get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>>;
  post<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>>;
  patch<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>>;
  put<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>>;
  delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>>;
}
