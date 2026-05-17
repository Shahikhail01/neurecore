// ─── IErrorHandler.ts ────────────────────────────────────────────────────────
// SRP: All error normalisation lives here — services don't parse raw errors.
// OCP: New error codes handled by extending, not modifying existing logic.

export type AppErrorCode =
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: unknown;
}

export interface IErrorHandler {
  /** Convert any thrown value into a normalised AppError */
  normalise(error: unknown): AppError;
  /** Decide whether to silently swallow or rethrow */
  handle(error: AppError): void;
  /** Create an AppError from an HTTP status code */
  fromStatus(status: number, message?: string): AppError;
}
