// ─── ResponseTransformer.ts ───────────────────────────────────────────────────
// SRP: Unwrap backend ApiResponse envelope into typed data.
// The backend always returns { status, data, error, meta }.

import type { ApiResponse, PaginatedResponse } from '@/core/services/api/interfaces/IApiClient';

export class ResponseTransformer {
  /** Extract `.data` from a successful response, throw on error. */
  unwrapItem<T>(response: ApiResponse<T>): T {
    if (response.status !== 'success' || response.data === undefined) {
      throw {
        code: response.error?.code ?? 'SERVER_ERROR',
        message: response.error?.message ?? 'Unexpected server response',
      };
    }
    return response.data;
  }

  /** Extract `.data` as a list, normalise the pagination wrapper. */
  unwrapList<T>(response: ApiResponse<unknown>): { items: T[]; total: number; page: number; limit: number } {
    if (response.status !== 'success' || response.data === undefined) {
      throw {
        code: response.error?.code ?? 'SERVER_ERROR',
        message: response.error?.message ?? 'Unexpected server response',
      };
    }

    const raw = response.data as Record<string, unknown>;

    // Backend may return: { data: T[], total, page, limit, totalPages }
    // or directly: { items: T[], total, page, limit }
    const items = (raw['data'] ?? raw['items'] ?? []) as T[];
    const total = (raw['total'] ?? 0) as number;
    const page  = (raw['page']  ?? 1) as number;
    const limit = (raw['limit'] ?? 20) as number;

    return { items, total, page, limit };
  }

  /** Build a paginated response object from raw data */  
  toPaginated<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const responseTransformer = new ResponseTransformer();
