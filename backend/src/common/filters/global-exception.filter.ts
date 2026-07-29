/**
 * Global Exception Filter for NeureCore Backend
 *
 * A comprehensive exception filter following SOLID principles:
 * - Single Responsibility: Handles all unhandled exceptions
 * - Open/Closed: Easy to extend with new error types
 *
 * Features:
 * - Proper HTTP status code mapping
 * - Detailed error logging
 * - User-friendly error messages
 * - Correlation ID tracking
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  AppError,
  ErrorCode,
  ErrorCodeType,
  ErrorCategory,
} from '../errors/app-errors';
import { LoggingService, LogLevel } from '../logging';

// ============================================
// ERROR RESPONSE TYPES
// ============================================

interface ApiErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

// ============================================
// GLOBAL EXCEPTION FILTER
// ============================================

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;

  // Maps HTTP status to error codes
  private static readonly STATUS_TO_ERROR_CODE: Record<number, ErrorCodeType> =
    {
      [HttpStatus.BAD_REQUEST]: ErrorCode.INVALID_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTHENTICATION_FAILED,
      [HttpStatus.FORBIDDEN]: ErrorCode.PERMISSION_DENIED,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMIT_EXCEEDED,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
    };

  constructor(
    @Optional() @Inject(LoggingService) private loggingService?: LoggingService,
  ) {
    this.logger = new Logger(GlobalExceptionFilter.name);
  }

  /**
   * Catch and handle any unhandled exception
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate request ID for tracking
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    // Determine the error and response
    const { status, code, message, details, isOperational } =
      this.determineError(exception, requestId);

    // Log the error with full context
    this.logError(exception, {
      requestId,
      method: request.method,
      url: request.url,
      status,
      isOperational,
    });

    // Build the error response
    const errorResponse: ApiErrorResponse = {
      status: 'error',
      error: {
        code,
        message: this.getUserFriendlyMessage(code, message, exception),
        details: this.isProduction() ? undefined : details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    // Send the response
    response.status(status).json(errorResponse);
  }

  /**
   * Determine the error type and extract relevant information
   */
  private determineError(
    exception: unknown,
    requestId: string,
  ): {
    status: number;
    code: ErrorCodeType;
    message: string;
    details?: Record<string, unknown>;
    isOperational: boolean;
  } {
    // Handle our custom AppError
    if (exception instanceof AppError) {
      return {
        status: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        isOperational: exception.isOperational,
      };
    }

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: Record<string, unknown> | undefined;
      let code:
        | ErrorCodeType
        | undefined;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        // SRP/OCP: domain exceptions can embed their own `error.code`
        // (see TierLimitExceededException). When present we trust it
        // over the generic status→code table so consumers can branch
        // on `error.code === 'TIER_LIMIT_EXCEEDED'` rather than just
        // `error.code === 'VALIDATION_ERROR'`. The status→code table
        // remains the fallback for ad-hoc HttpException throw sites
        // that pass raw `{ message, errors }` validation shapes.
        //
        // FIX-CSRF-ERROR-CODE: also accept `code` at the top level of
        // the response object. Many guards (CsrfProtectionMiddleware,
        // RolesGuard, EntityLifecycleGuard) throw
        //   ForbiddenException({ code: 'CSRF_TOKEN_MISSING', message: '…' })
        // directly — without the nested `{ error: { code } }` wrapper
        // the TierLimitExceededException uses. Before this fix, every
        // CSRF rejection surfaced as opaque `{ code: 'PERMISSION_DENIED' }`
        // which made it impossible for the FE / scripted clients to
        // distinguish "you forgot the X-CSRF-Token header" from "your
        // role lacks permission". Now we honour any top-level `code`.
        const nestedError = res.error as
          | { code?: string; details?: Record<string, unknown> }
          | undefined;
        const topLevelCode = typeof res.code === 'string' ? (res.code as string) : undefined;
        if (nestedError?.code && typeof nestedError.code === 'string') {
          code = nestedError.code as ErrorCodeType;
          if (nestedError.details) {
            details = nestedError.details;
          }
          message =
            (res.message as string) ?? (exception.message ?? code);
        } else if (topLevelCode) {
          code = topLevelCode as ErrorCodeType;
          message =
            (res.message as string) ?? (exception.message ?? code);
        } else {
          message = Array.isArray(res.message)
            ? 'Validation failed'
            : ((res.message as string) ?? exception.message);

          // Handle validation errors
          if (Array.isArray(res.message)) {
            details = { errors: res.message };
          }
        }
      } else {
        message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exception.message;
      }

      return {
        status: httpStatus,
        code:
          code ??
          GlobalExceptionFilter.STATUS_TO_ERROR_CODE[httpStatus] ??
          ErrorCode.INTERNAL_ERROR,
        message,
        details,
        isOperational: true,
      };
    }

    // Handle standard JavaScript errors
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: this.isProduction()
          ? 'An unexpected error occurred'
          : exception.message,
        details: this.isProduction() ? undefined : { stack: exception.stack },
        isOperational: false,
      };
    }

    // Handle unknown errors
    this.logger.error(`Unknown exception: ${String(exception)}`, undefined);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      isOperational: false,
    };
  }

  /**
   * Log the error with full context
   */
  private logError(
    exception: unknown,
    context: {
      requestId: string;
      method: string;
      url: string;
      status: number;
      isOperational: boolean;
    },
  ): void {
    // Use our custom logging service if available
    if (this.loggingService) {
      if (exception instanceof AppError) {
        this.loggingService.logError(exception, {
          correlationId: context.requestId,
          metadata: {
            method: context.method,
            url: context.url,
            httpStatus: context.status,
          },
        });
      } else if (exception instanceof Error) {
        this.loggingService.logError(exception, {
          correlationId: context.requestId,
          metadata: {
            method: context.method,
            url: context.url,
            httpStatus: context.status,
            isOperational: context.isOperational,
          },
        });
      }
    } else {
      // Fall back to NestJS logger
      const level = context.status >= 500 ? 'error' : 'warn';
      this.logger[level](
        `[${context.requestId}] ${context.method} ${context.url} - ${context.status}`,
      );
    }
  }

  /**
   * Get user-friendly message for the error code
   */
  private getUserFriendlyMessage(
    code: ErrorCodeType,
    originalMessage: string,
    exception?: unknown,
  ): string {
    // Surface validation error details to clients (user-input related, not sensitive)
    if (code === ErrorCode.INVALID_REQUEST) {
      const message = this.extractValidationMessage(exception);
      if (message) return message;

      // Fallback: class-transformer / class-validator sometimes produce a
      // BadRequestException whose .response.message is a STRING (e.g. the
      // generic "Bad Request Exception" literal). In that case we still want
      // to give the user a useful hint instead of the opaque
      // "An unexpected error occurred" message — their request was malformed,
      // and we can describe what was wrong in client-friendly terms.
      const fallback = this.extractGenericBadRequestHint(exception, originalMessage);
      if (fallback) return fallback;

      return 'The request was invalid. Please check your input and try again.';
    }

    // If not in production, include original message for debugging
    if (!this.isProduction()) {
      // Domain exceptions (e.g. TierLimitExceededException) embed a
      // user-facing `error.message` in `getResponse()`. Prefer it over
      // the raw exception.message so the dev wire matches production
      // output for these structured payloads.
      if (exception instanceof HttpException) {
        const response = exception.getResponse();
        if (
          typeof response === 'object' &&
          response !== null &&
          !Array.isArray(response)
        ) {
          const nestedError = (response as Record<string, unknown>).error as
            | { message?: string }
            | undefined;
          if (nestedError?.message) return nestedError.message;
        }
      }
      return originalMessage;
    }

    // User-friendly messages for common errors
    const userFriendlyMessages: Partial<Record<ErrorCodeType, string>> = {
      [ErrorCode.AUTHENTICATION_FAILED]:
        'Invalid credentials. Please check your email and password.',
      [ErrorCode.TOKEN_EXPIRED]:
        'Your session has expired. Please log in again.',
      [ErrorCode.TOKEN_INVALID]: 'Session invalid. Please log in again.',
      [ErrorCode.REFRESH_TOKEN_EXPIRED]:
        'Your session has expired. Please log in again.',
      [ErrorCode.CREDENTIALS_INVALID]: 'Invalid email or password.',
      [ErrorCode.ACCOUNT_LOCKED]:
        'Your account has been locked. Please contact support.',
      [ErrorCode.ACCOUNT_DISABLED]:
        'Your account has been disabled. Please contact support.',
      [ErrorCode.PERMISSION_DENIED]:
        "You don't have permission to perform this action.",
      [ErrorCode.FORBIDDEN]: 'Access denied.',
      [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
      [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
      [ErrorCode.DUPLICATE_ENTRY]: 'This item already exists.',
      [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'This resource already exists.',
      [ErrorCode.RATE_LIMIT_EXCEEDED]:
        'Too many requests. Please try again later.',
      [ErrorCode.INSUFFICIENT_BALANCE]:
        'Insufficient balance for this operation.',
      [ErrorCode.PLAN_LIMIT_REACHED]: 'You have reached your plan limit.',
      [ErrorCode.TIER_LIMIT_EXCEEDED]:
        "This selection exceeds your plan's tier limits. Upgrade or pick a smaller option.",
      // FIX-CSRF-ERROR-CODE: surface a clear CSRF-specific message so
      // scripted clients (and humans) know to attach X-CSRF-Token.
      [ErrorCode.CSRF_TOKEN_MISSING]:
        'Your request is missing the required CSRF token. Include the X-CSRF-Token header matching your __Host-nc_csrf cookie, then retry.',
      [ErrorCode.CSRF_TOKEN_INVALID]:
        'The CSRF token provided does not match the session cookie. Refresh the page and try again.',
      [ErrorCode.INTERNAL_ERROR]:
        'Something went wrong. Please try again later.',
      [ErrorCode.SERVICE_UNAVAILABLE]:
        'Service temporarily unavailable. Please try again later.',
    };

    return (
      userFriendlyMessages[code] ||
      'An unexpected error occurred. Please try again.'
    );
  }

  /**
   * Extract a hint from a BadRequestException whose .response.message is a
   * string (not the class-validator array shape). Many upstream sources emit
   * a non-descript message like "Bad Request Exception" — in those cases we
   * surface the underlying transport-level reason when available (e.g. an
   * empty body), but never the opaque literal.
   */
  private extractGenericBadRequestHint(
    exception: unknown,
    originalMessage: string,
  ): string | null {
    if (!exception || typeof exception !== 'object') return null;
    const response = (exception as { response?: unknown }).response;
    if (!response || typeof response !== 'object') return null;

    const message = (response as { message?: unknown }).message;
    if (Array.isArray(message)) return null;
    if (typeof message !== 'string') return null;

    // Ignore the default NestJS literal — it's meaningless to end users.
    if (/^bad request/i.test(message.trim())) {
      // If we have a non-literal originalMessage, prefer it.
      if (
        originalMessage &&
        !/^bad request/i.test(originalMessage.trim()) &&
        originalMessage !== message
      ) {
        return originalMessage;
      }
      return null;
    }

    // Any other meaningful string message is OK to surface.
    return message;
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Extract the validation message array from a class-validator HttpException.
   * Returns the joined string when the exception carries a message array
   * (the canonical class-validator shape), otherwise returns null.
   *
   * Replaces the previous `(exception as any)?.response?.message` cast.
   */
  private extractValidationMessage(exception: unknown): string | null {
    if (!exception || typeof exception !== 'object') return null;

    // 1. Canonical NestJS BadRequestException shape:
    //    exception.response === { statusCode, message: string[], error }
    const response = (exception as { response?: unknown }).response;
    if (response && typeof response === 'object') {
      const responseMessage = (response as { message?: unknown }).message;
      if (Array.isArray(responseMessage) && responseMessage.length > 0) {
        return responseMessage.join('; ');
      }
    }

    // 2. Fallback: some Nest versions / class-transformer store the array on
    //    exception.message itself (a stringified JSON or a joined string).
    //    Handle the joined-string case.
    const exceptionMessage = (exception as { message?: unknown }).message;
    if (typeof exceptionMessage === 'string') {
      // If it looks like a JSON array, parse it.
      const trimmed = exceptionMessage.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
            return parsed.join('; ');
          }
        } catch {
          /* not JSON */
        }
      }
    }

    return null;
  }
}
