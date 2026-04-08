/**
 * API Error Handler Utility
 * Transform API errors into user-friendly messages
 */

export interface APIErrorResponse {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp?: string;
}

export class APIError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Record<string, any>,
  ) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  public isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  public isValidationError(): boolean {
    return this.status === 400;
  }

  public isNotFoundError(): boolean {
    return this.status === 404;
  }

  public isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Get user-friendly error message based on status code
 */
export function getErrorMessage(error: any): string {
  // Handle APIError instances
  if (error instanceof APIError) {
    switch (error.status) {
      case 400:
        return (
          error.details?.message || "Invalid request. Please check your input."
        );
      case 401:
        return "Your session has expired. Please login again.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 409:
        return "This resource already exists.";
      case 422:
        return "Validation failed. Please check your input.";
      case 429:
        return "Too many requests. Please try again later.";
      case 500:
        return "Server error. Please try again later.";
      case 502:
      case 503:
      case 504:
        return "Server is temporarily unavailable. Please try again later.";
      default:
        return error.message || "An unexpected error occurred.";
    }
  }

  // Handle axios errors
  if (error?.response?.status) {
    return getErrorMessage(
      new APIError(
        error.response.data?.message || error.message,
        error.response.status,
        error.response.data?.code,
        error.response.data?.details,
      ),
    );
  }

  // Handle network errors
  if (error?.message?.includes("Network")) {
    return "Network connection error. Please check your internet connection.";
  }

  // Handle timeout errors
  if (error?.code === "ECONNABORTED") {
    return "Request timeout. Please try again.";
  }

  // Default error message
  return error?.message || "An unexpected error occurred.";
}

/**
 * Parse error response from API
 */
export function parseErrorResponse(data: any): APIErrorResponse {
  return {
    status: data?.status || 500,
    message: data?.message || "Unknown error",
    code: data?.code,
    details: data?.details,
    timestamp: data?.timestamp,
  };
}

/**
 * Get validation error messages from response
 */
export function getValidationErrors(data: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (data?.details?.errors) {
    Object.entries(data.details.errors).forEach(([field, messages]) => {
      if (Array.isArray(messages)) {
        errors[field] = messages[0];
      } else if (typeof messages === "string") {
        errors[field] = messages;
      }
    });
  }

  return errors;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof APIError) {
    return (
      error.status === 408 || // Request Timeout
      error.status === 429 || // Too Many Requests
      error.status >= 500 // Server errors
    );
  }

  // Network errors are retryable
  if (error?.code === "ECONNABORTED" || error?.code === "ENOTFOUND") {
    return true;
  }

  return false;
}

/**
 * Retry failed request with exponential backoff
 */
export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
