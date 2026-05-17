// ─── ErrorHandler.ts ─────────────────────────────────────────────────────────
// SRP: One class owns all error classification and reporting.
// OCP: Add new HTTP code mappings without changing existing normalisation logic.

import type { IErrorHandler, AppError, AppErrorCode } from '@/core/services/api/interfaces/IErrorHandler';

const STATUS_TO_CODE: Record<number, AppErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'TIMEOUT',
  422: 'VALIDATION_ERROR',
  429: 'SERVER_ERROR',
  500: 'SERVER_ERROR',
  502: 'SERVER_ERROR',
  503: 'SERVER_ERROR',
  504: 'TIMEOUT',
};

export class ErrorHandler implements IErrorHandler {
  normalise(error: unknown): AppError {
    if (this.isAppError(error)) return error;

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return { code: 'NETWORK_ERROR', message: 'Unable to reach the server. Check your connection.', originalError: error };
    }

    if (error instanceof Error) {
      return { code: 'UNKNOWN', message: error.message, originalError: error };
    }

    return { code: 'UNKNOWN', message: 'An unexpected error occurred.', originalError: error };
  }

  handle(error: AppError): void {
    // Non-critical errors are logged; callers decide whether to rethrow.
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[HQ Error] ${error.code}: ${error.message}`, error.details ?? '');
    }
  }

  fromStatus(status: number, message?: string): AppError {
    const code: AppErrorCode = STATUS_TO_CODE[status] ?? 'UNKNOWN';
    const defaultMessages: Record<AppErrorCode, string> = {
      NETWORK_ERROR: 'Network error.',
      UNAUTHORIZED: 'Your session has expired. Please log in again.',
      FORBIDDEN: 'You do not have permission to perform this action.',
      NOT_FOUND: 'The requested resource was not found.',
      VALIDATION_ERROR: 'Please check your input and try again.',
      SERVER_ERROR: 'A server error occurred. Please try again later.',
      TIMEOUT: 'The request timed out.',
      UNKNOWN: 'An unexpected error occurred.',
    };
    return { code, message: message ?? defaultMessages[code] };
  }

  private isAppError(value: unknown): value is AppError {
    return (
      typeof value === 'object' &&
      value !== null &&
      'code' in value &&
      'message' in value
    );
  }
}

export const errorHandler = new ErrorHandler();
