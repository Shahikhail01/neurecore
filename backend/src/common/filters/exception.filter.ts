/**
 * Global Exception Filter
 * Catches all exceptions and formats them properly
 * SOLID: Single Responsibility - Exception handling
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ILogger } from '../../domain/interfaces';

/**
 * Error response format
 */
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  requestId: string;
  path: string;
  details?: Record<string, any>;
}

/**
 * GlobalExceptionFilter - Catches all exceptions
 * Converts to user-friendly error responses
 * Logs errors for debugging
 *
 * SOLID:
 * - S: Only handles exception formatting
 * - O: Can add new exception types without changing
 * - L: Implements ExceptionFilter interface
 * - I: Uses standard NestJS interfaces
 * - D: Logger injected
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: ILogger) {}

  /**
   * Catch and format exception
   * @param exception Thrown exception
   * @param host Execution context
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const requestId = this.generateRequestId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal Server Error';
    let error = 'INTERNAL_ERROR';
    let details: Record<string, any> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const objResponse = exceptionResponse as any;
        message = objResponse.message || exception.message;
        error = objResponse.error || 'HTTP_ERROR';
        details = objResponse.details || {};
      } else {
        message = exceptionResponse.toString();
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name || 'ERROR';

      // Validation errors
      if (error === 'BadRequestException') {
        status = HttpStatus.BAD_REQUEST;
      }

      // Unauthorized
      if (error === 'UnauthorizedException') {
        status = HttpStatus.UNAUTHORIZED;
      }

      // Forbidden
      if (error === 'ForbiddenException') {
        status = HttpStatus.FORBIDDEN;
      }

      // Not found
      if (error === 'NotFoundException') {
        status = HttpStatus.NOT_FOUND;
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      requestId,
      path: request.path,
      ...(details && { details }),
    };

    // Log error
    this.logError(exception, request, status, requestId);

    response.status(status).json(errorResponse);
  }

  /**
   * Log error with context
   * @param exception Exception caught
   * @param request Express request
   * @param status HTTP status
   * @param requestId Request ID
   */
  private logError(
    exception: unknown,
    request: any,
    status: number,
    requestId: string,
  ): void {
    const method = request.method;
    const path = request.path;
    const userId = request.user?.userId || 'anonymous';

    const errorInfo = {
      requestId,
      method,
      path,
      userId,
      status,
      message:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error(`[${status}] ${method} ${path}`, errorInfo);
    } else if (status >= 400) {
      this.logger.warn(`[${status}] ${method} ${path}`, {
        message: errorInfo.message,
        userId,
      });
    } else {
      this.logger.debug(`[${status}] ${method} ${path}`);
    }
  }

  /**
   * Generate unique request ID for tracking
   * Format: req_<timestamp>_<random>
   * @returns Request ID string
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  }
}

/**
 * HTTP Exception Factory
 * Creates properly formatted HTTP exceptions
 */
export class HttpExceptionFactory {
  /**
   * Create validation error
   * @param message Error message
   * @param details Validation details
   */
  static badRequest(
    message: string,
    details?: Record<string, any>,
  ): HttpException {
    return new HttpException(
      {
        message,
        error: 'BAD_REQUEST',
        details,
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  /**
   * Create unauthorized error
   * @param message Error message
   */
  static unauthorized(message: string = 'Unauthorized'): HttpException {
    return new HttpException(
      {
        message,
        error: 'UNAUTHORIZED',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  /**
   * Create forbidden error
   * @param message Error message
   */
  static forbidden(message: string = 'Forbidden'): HttpException {
    return new HttpException(
      {
        message,
        error: 'FORBIDDEN',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Create not found error
   * @param resource Resource name
   * @param id Resource ID
   */
  static notFound(resource: string, id: string): HttpException {
    return new HttpException(
      {
        message: `${resource} with ID ${id} not found`,
        error: 'NOT_FOUND',
      },
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Create conflict error
   * @param message Error message
   */
  static conflict(message: string): HttpException {
    return new HttpException(
      {
        message,
        error: 'CONFLICT',
      },
      HttpStatus.CONFLICT,
    );
  }

  /**
   * Create internal server error
   * @param message Error message
   */
  static internalServerError(
    message: string = 'Internal Server Error',
  ): HttpException {
    return new HttpException(
      {
        message,
        error: 'INTERNAL_SERVER_ERROR',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
