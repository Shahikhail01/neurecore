/**
 * Error Handling Utilities for NeureCore Frontend (Tenant)
 *
 * Provides comprehensive error handling following SOLID principles:
 * - Single Responsibility: Handles specific error types
 * - Open/Closed: Easy to extend with new error handlers
 *
 * Features:
 * - API error parsing
 * - User-friendly error messages
 * - Error logging
 * - Error state management
 */

// ============================================
// ERROR TYPES
// ============================================

/**
 * API Error response from backend
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API Error response wrapper
 */
export interface ApiErrorResponse {
  status: "error";
  error: ApiError;
  meta: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * Error codes from backend
 */
export const ErrorCode = {
  // Validation Errors (1xxx)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Authentication Errors (2xxx)
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  REFRESH_TOKEN_EXPIRED: "REFRESH_TOKEN_EXPIRED",
  CREDENTIALS_INVALID: "CREDENTIALS_INVALID",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  MFA_REQUIRED: "MFA_REQUIRED",
  MFA_INVALID: "MFA_INVALID",

  // Authorization Errors (3xxx)
  PERMISSION_DENIED: "PERMISSION_DENIED",
  FORBIDDEN: "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  RESOURCE_ACCESS_DENIED: "RESOURCE_ACCESS_DENIED",

  // Not Found Errors (4xxx)
  NOT_FOUND: "NOT_FOUND",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  ENDPOINT_NOT_FOUND: "ENDPOINT_NOT_FOUND",

  // Conflict Errors (5xxx)
  CONFLICT: "CONFLICT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  VERSION_CONFLICT: "VERSION_CONFLICT",

  // Rate Limiting (6xxx)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",

  // Business Logic Errors (7xxx)
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",
  WORKFLOW_ERROR: "WORKFLOW_ERROR",

  // External Service Errors (8xxx)
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  THIRD_PARTY_API_ERROR: "THIRD_PARTY_API_ERROR",
  PAYMENT_GATEWAY_ERROR: "PAYMENT_GATEWAY_ERROR",
  EMAIL_SERVICE_ERROR: "EMAIL_SERVICE_ERROR",

  // Database Errors (9xxx)
  DATABASE_ERROR: "DATABASE_ERROR",
  RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
  UNIQUE_CONSTRAINT_VIOLATION: "UNIQUE_CONSTRAINT_VIOLATION",
  FOREIGN_KEY_VIOLATION: "FOREIGN_KEY_VIOLATION",

  // Server Errors (10xxx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
  FEATURE_NOT_IMPLEMENTED: "FEATURE_NOT_IMPLEMENTED",

  // Circuit Breaker (11xxx)
  CIRCUIT_BREAKER_OPEN: "CIRCUIT_BREAKER_OPEN",
  CIRCUIT_BREAKER_HALF_OPEN: "CIRCUIT_BREAKER_HALF_OPEN",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================
// USER-FRIENDLY MESSAGES
// ============================================

/**
 * User-friendly error messages for display
 */
const UserFriendlyMessages: Partial<Record<ErrorCodeType, string>> = {
  // Authentication
  [ErrorCode.AUTHENTICATION_FAILED]:
    "Invalid credentials. Please check your email and password.",
  [ErrorCode.TOKEN_EXPIRED]: "Your session has expired. Please log in again.",
  [ErrorCode.TOKEN_INVALID]: "Session invalid. Please log in again.",
  [ErrorCode.REFRESH_TOKEN_EXPIRED]:
    "Your session has expired. Please log in again.",
  [ErrorCode.CREDENTIALS_INVALID]: "Invalid email or password.",
  [ErrorCode.ACCOUNT_LOCKED]:
    "Your account has been locked. Please contact support.",
  [ErrorCode.ACCOUNT_DISABLED]:
    "Your account has been disabled. Please contact support.",

  // Authorization
  [ErrorCode.PERMISSION_DENIED]:
    "You don't have permission to perform this action.",
  [ErrorCode.FORBIDDEN]: "Access denied.",
  [ErrorCode.INSUFFICIENT_PERMISSIONS]:
    "You don't have the required permissions.",

  // Not Found
  [ErrorCode.NOT_FOUND]: "The requested resource was not found.",
  [ErrorCode.USER_NOT_FOUND]: "User not found.",
  [ErrorCode.RESOURCE_NOT_FOUND]: "The requested resource was not found.",

  // Conflict
  [ErrorCode.DUPLICATE_ENTRY]: "This item already exists.",
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: "This resource already exists.",

  // Rate Limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: "Too many requests. Please try again later.",
  [ErrorCode.QUOTA_EXCEEDED]: "You have exceeded your quota.",

  // Business Logic
  [ErrorCode.INSUFFICIENT_BALANCE]: "Insufficient balance for this operation.",
  [ErrorCode.PLAN_LIMIT_REACHED]: "You have reached your plan limit.",
  [ErrorCode.OPERATION_NOT_ALLOWED]: "This operation is not allowed.",

  // Server Errors
  [ErrorCode.INTERNAL_ERROR]: "Something went wrong. Please try again later.",
  [ErrorCode.SERVICE_UNAVAILABLE]:
    "Service temporarily unavailable. Please try again later.",
  [ErrorCode.MAINTENANCE_MODE]:
    "System is under maintenance. Please try again later.",
};

// ============================================
// APP ERROR CLASS
// ============================================

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    options?: {
      details?: Record<string, unknown>;
      requestId?: string;
      isOperational?: boolean;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = options?.details;
    this.requestId = options?.requestId;
    this.isOperational = options?.isOperational ?? true;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get user-friendly message
   */
  getUserFriendlyMessage(): string {
    return UserFriendlyMessages[this.code as ErrorCodeType] || this.message;
  }
}

// ============================================
// ERROR PARSING
// ============================================

/**
 * Parse error from axios response
 */
export function parseApiError(error: unknown): AppError {
  // Check if it's an axios error with response
  if (error && typeof error === "object" && "response" in error) {
    const axiosError = error as {
      response?: { data?: ApiErrorResponse; status?: number };
    };
    const response = axiosError.response;

    if (response?.data) {
      const { error: apiError, meta } = response.data;
      return new AppError(
        apiError.message,
        apiError.code,
        response.status || 500,
        {
          details: apiError.details,
          requestId: meta?.requestId,
        },
      );
    }
  }

  // Check if it's already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Handle standard errors
  if (error instanceof Error) {
    return new AppError(error.message, ErrorCode.INTERNAL_ERROR, 500, {
      isOperational: false,
    });
  }

  // Unknown error
  return new AppError(
    "An unexpected error occurred",
    ErrorCode.INTERNAL_ERROR,
    500,
  );
}

/**
 * Get user-friendly message for error
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.getUserFriendlyMessage();
  }

  // Try to parse axios error
  const parsed = parseApiError(error);
  return parsed.getUserFriendlyMessage();
}

// ============================================
// ERROR LOGGING
// ============================================

/**
 * Log error to console (and potentially to a logging service)
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const parsed = parseApiError(error);

  console.error("Error occurred:", {
    code: parsed.code,
    message: parsed.message,
    statusCode: parsed.statusCode,
    details: parsed.details,
    requestId: parsed.requestId,
    stack: parsed.stack,
    context,
  });
}

// ============================================
// ERROR HANDLER HOOK
// ============================================

/**
 * React hook for handling errors in components
 */
export function useErrorHandler() {
  const handleError = (error: unknown) => {
    const appError = parseApiError(error);

    // Handle specific error codes
    if (
      appError.code === ErrorCode.TOKEN_EXPIRED ||
      appError.code === ErrorCode.TOKEN_INVALID ||
      appError.code === ErrorCode.REFRESH_TOKEN_EXPIRED
    ) {
      // Redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("tenant_accessToken");
        localStorage.removeItem("tenant_refreshToken");
        window.location.href = "/login";
      }
    }

    return appError;
  };

  return { handleError, parseApiError, getUserFriendlyMessage, logError };
}

// ============================================
// EXPORTS
// ============================================

export default {
  ErrorCode,
  AppError,
  parseApiError,
  getUserFriendlyMessage,
  logError,
  useErrorHandler,
};
