/**
 * Custom Error Hierarchy for NeureCore Backend
 *
 * A comprehensive error class hierarchy following SOLID principles:
 * - Single Responsibility: Each error class handles a specific error type
 * - Open/Closed: New error types can be added through extension
 * - Liskov Substitution: All error classes are interchangeable through base class
 *
 * These errors provide:
 * - Type-safe error handling
 * - Proper HTTP status code mapping
 * - Detailed error context for logging
 */

import { HttpException, HttpStatus } from '@nestjs/common';

// ============================================
// ERROR CODE ENUMERATION (DUPLICATED FROM SHARED FOR BACKEND)
// ============================================

export const ErrorCode = {
  // Validation Errors (1xxx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Authentication Errors (2xxx)
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  CREDENTIALS_INVALID: 'CREDENTIALS_INVALID',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_INVALID: 'MFA_INVALID',

  // Authorization Errors (3xxx)
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',

  // Not Found Errors (4xxx)
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',

  // Conflict Errors (5xxx)
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  VERSION_CONFLICT: 'VERSION_CONFLICT',

  // Rate Limiting (6xxx)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Business Logic Errors (7xxx)
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  PLAN_LIMIT_REACHED: 'PLAN_LIMIT_REACHED',
  TIER_LIMIT_EXCEEDED: 'TIER_LIMIT_EXCEEDED',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',

  // External Service Errors (8xxx)
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  THIRD_PARTY_API_ERROR: 'THIRD_PARTY_API_ERROR',
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',

  // Database Errors (9xxx)
  DATABASE_ERROR: 'DATABASE_ERROR',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  UNIQUE_CONSTRAINT_VIOLATION: 'UNIQUE_CONSTRAINT_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',

  // Server Errors (10xxx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  FEATURE_NOT_IMPLEMENTED: 'FEATURE_NOT_IMPLEMENTED',

  // Circuit Breaker (11xxx)
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
  CIRCUIT_BREAKER_HALF_OPEN: 'CIRCUIT_BREAKER_HALF_OPEN',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// Error categories
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  DATABASE = 'DATABASE',
  INTERNAL = 'INTERNAL',
}

// Maps error codes to their categories
const ErrorCodeCategoryMap: Record<ErrorCodeType, ErrorCategory> = {
  [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_REQUEST]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_PARAMETER]: ErrorCategory.VALIDATION,
  [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_FORMAT]: ErrorCategory.VALIDATION,
  [ErrorCode.AUTHENTICATION_FAILED]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.TOKEN_INVALID]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.REFRESH_TOKEN_EXPIRED]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.CREDENTIALS_INVALID]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.ACCOUNT_LOCKED]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.ACCOUNT_DISABLED]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.MFA_REQUIRED]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.MFA_INVALID]: ErrorCategory.AUTHENTICATION,
  [ErrorCode.PERMISSION_DENIED]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.FORBIDDEN]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.RESOURCE_ACCESS_DENIED]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.USER_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.RESOURCE_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.ENDPOINT_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.CONFLICT]: ErrorCategory.CONFLICT,
  [ErrorCode.DUPLICATE_ENTRY]: ErrorCategory.CONFLICT,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: ErrorCategory.CONFLICT,
  [ErrorCode.VERSION_CONFLICT]: ErrorCategory.CONFLICT,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: ErrorCategory.RATE_LIMIT,
  [ErrorCode.QUOTA_EXCEEDED]: ErrorCategory.RATE_LIMIT,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: ErrorCategory.BUSINESS_LOGIC,
  [ErrorCode.INSUFFICIENT_BALANCE]: ErrorCategory.BUSINESS_LOGIC,
  [ErrorCode.PLAN_LIMIT_REACHED]: ErrorCategory.BUSINESS_LOGIC,
  [ErrorCode.TIER_LIMIT_EXCEEDED]: ErrorCategory.BUSINESS_LOGIC,
  [ErrorCode.OPERATION_NOT_ALLOWED]: ErrorCategory.BUSINESS_LOGIC,
  [ErrorCode.WORKFLOW_ERROR]: ErrorCategory.BUSINESS_LOGIC,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.THIRD_PARTY_API_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.PAYMENT_GATEWAY_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.EMAIL_SERVICE_ERROR]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.DATABASE_ERROR]: ErrorCategory.DATABASE,
  [ErrorCode.RECORD_NOT_FOUND]: ErrorCategory.DATABASE,
  [ErrorCode.UNIQUE_CONSTRAINT_VIOLATION]: ErrorCategory.DATABASE,
  [ErrorCode.FOREIGN_KEY_VIOLATION]: ErrorCategory.DATABASE,
  [ErrorCode.INTERNAL_ERROR]: ErrorCategory.INTERNAL,
  [ErrorCode.SERVICE_UNAVAILABLE]: ErrorCategory.INTERNAL,
  [ErrorCode.MAINTENANCE_MODE]: ErrorCategory.INTERNAL,
  [ErrorCode.FEATURE_NOT_IMPLEMENTED]: ErrorCategory.INTERNAL,
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: ErrorCategory.EXTERNAL_SERVICE,
  [ErrorCode.CIRCUIT_BREAKER_HALF_OPEN]: ErrorCategory.EXTERNAL_SERVICE,
};

// Maps error codes to HTTP status codes
const ErrorCodeToStatusCode: Record<ErrorCodeType, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.INVALID_PARAMETER]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.AUTHENTICATION_FAILED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.REFRESH_TOKEN_EXPIRED]: 401,
  [ErrorCode.CREDENTIALS_INVALID]: 401,
  [ErrorCode.ACCOUNT_LOCKED]: 401,
  [ErrorCode.ACCOUNT_DISABLED]: 401,
  [ErrorCode.MFA_REQUIRED]: 401,
  [ErrorCode.MFA_INVALID]: 401,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.RESOURCE_ACCESS_DENIED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.ENDPOINT_NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_ENTRY]: 409,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.VERSION_CONFLICT]: 409,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  [ErrorCode.BUSINESS_RULE_VIOLATION]: 400,
  [ErrorCode.INSUFFICIENT_BALANCE]: 400,
  [ErrorCode.PLAN_LIMIT_REACHED]: 400,
  [ErrorCode.TIER_LIMIT_EXCEEDED]: 422,
  [ErrorCode.OPERATION_NOT_ALLOWED]: 400,
  [ErrorCode.WORKFLOW_ERROR]: 400,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.THIRD_PARTY_API_ERROR]: 502,
  [ErrorCode.PAYMENT_GATEWAY_ERROR]: 502,
  [ErrorCode.EMAIL_SERVICE_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.RECORD_NOT_FOUND]: 500,
  [ErrorCode.UNIQUE_CONSTRAINT_VIOLATION]: 500,
  [ErrorCode.FOREIGN_KEY_VIOLATION]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.MAINTENANCE_MODE]: 503,
  [ErrorCode.FEATURE_NOT_IMPLEMENTED]: 501,
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: 503,
  [ErrorCode.CIRCUIT_BREAKER_HALF_OPEN]: 503,
};

// ============================================
// DETAILED API ERROR INTERFACE
// ============================================

export interface DetailedApiError {
  code: ErrorCodeType;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  requestId?: string;
  category: ErrorCategory;
  statusCode: number;
  isOperational: boolean;
  stack?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// BASE APPLICATION ERROR
// ============================================

/**
 * Base class for all application errors
 * Provides common functionality for all custom errors
 */
export abstract class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly category: ErrorCategory;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly correlationId?: string;
  public readonly userId?: string;
  public readonly tenantId?: string;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      details?: Record<string, unknown>;
      statusCode?: number;
      isOperational?: boolean;
      correlationId?: string;
      userId?: string;
      tenantId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.category = ErrorCodeCategoryMap[code];
    this.statusCode = options?.statusCode ?? ErrorCodeToStatusCode[code];
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;
    this.timestamp = new Date().toISOString();
    this.correlationId = options?.correlationId;
    this.userId = options?.userId;
    this.tenantId = options?.tenantId;
    this.metadata = options?.metadata;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts error to a detailed API error object
   */
  toDetailedApiError(): DetailedApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      category: this.category,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      stack: this.stack,
      correlationId: this.correlationId,
      userId: this.userId,
      tenantId: this.tenantId,
      metadata: this.metadata,
    };
  }

  /**
   * Creates a basic error object for API responses
   */
  toApiError() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ============================================
// VALIDATION ERRORS
// ============================================

/**
 * Validation error for request validation failures
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    options?: {
      details?: Record<string, unknown>;
      correlationId?: string;
      tenantId?: string;
    },
  ) {
    super(message, ErrorCode.VALIDATION_ERROR, {
      statusCode: HttpStatus.BAD_REQUEST,
      isOperational: true,
      ...options,
    });
  }

  /**
   * Creates a validation error from class-validator errors
   */
  static fromValidationErrors(
    errors: Record<string, string[]>,
    correlationId?: string,
  ): ValidationError {
    const flattenedErrors: Record<string, unknown> = {};

    for (const [field, messages] of Object.entries(errors)) {
      flattenedErrors[field] = messages;
    }

    return new ValidationError('Validation failed', {
      details: { errors: flattenedErrors },
      correlationId,
    });
  }
}

/**
 * Error for invalid request parameters
 */
export class InvalidParameterError extends AppError {
  public readonly parameter: string;

  constructor(
    parameter: string,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      correlationId?: string;
    },
  ) {
    super(message, ErrorCode.INVALID_PARAMETER, {
      statusCode: HttpStatus.BAD_REQUEST,
      details: { parameter, ...options?.details },
      ...options,
    });
    this.parameter = parameter;
  }
}

/**
 * Error for missing required fields
 */
export class MissingRequiredFieldError extends AppError {
  public readonly field: string;

  constructor(
    field: string,
    options?: {
      correlationId?: string;
    },
  ) {
    super(
      `Missing required field: ${field}`,
      ErrorCode.MISSING_REQUIRED_FIELD,
      {
        statusCode: HttpStatus.BAD_REQUEST,
        details: { field },
        ...options,
      },
    );
    this.field = field;
  }
}

// ============================================
// AUTHENTICATION ERRORS
// ============================================

/**
 * Base authentication error
 */
export abstract class AuthenticationError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType,
    options?: { userId?: string; correlationId?: string },
  ) {
    super(message, code, {
      statusCode: HttpStatus.UNAUTHORIZED,
      isOperational: true,
      userId: options?.userId,
      correlationId: options?.correlationId,
    });
  }
}

/**
 * Error for failed authentication
 */
export class AuthenticationFailedError extends AuthenticationError {
  constructor(options?: { correlationId?: string }) {
    super('Authentication failed', ErrorCode.AUTHENTICATION_FAILED, options);
  }
}

/**
 * Error for expired tokens
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(options?: { correlationId?: string }) {
    super('Token has expired', ErrorCode.TOKEN_EXPIRED, options);
  }
}

/**
 * Error for invalid tokens
 */
export class TokenInvalidError extends AuthenticationError {
  constructor(options?: { correlationId?: string }) {
    super('Invalid token', ErrorCode.TOKEN_INVALID, options);
  }
}

/**
 * Error for invalid credentials
 */
export class InvalidCredentialsError extends AuthenticationError {
  constructor(options?: { correlationId?: string }) {
    super('Invalid email or password', ErrorCode.CREDENTIALS_INVALID, options);
  }
}

/**
 * Error for locked accounts
 */
export class AccountLockedError extends AuthenticationError {
  constructor(reason?: string, options?: { correlationId?: string }) {
    super(reason ?? 'Account is locked', ErrorCode.ACCOUNT_LOCKED, options);
  }
}

/**
 * Error for disabled accounts
 */
export class AccountDisabledError extends AuthenticationError {
  constructor(options?: { correlationId?: string }) {
    super('Account is disabled', ErrorCode.ACCOUNT_DISABLED, options);
  }
}

// ============================================
// AUTHORIZATION ERRORS
// ============================================

/**
 * Base authorization error
 */
export abstract class AuthorizationError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      userId?: string;
      tenantId?: string;
      correlationId?: string;
      resourceId?: string;
    },
  ) {
    super(message, code, {
      statusCode: HttpStatus.FORBIDDEN,
      isOperational: true,
      userId: options?.userId,
      tenantId: options?.tenantId,
      correlationId: options?.correlationId,
      metadata: options?.resourceId
        ? { resourceId: options.resourceId }
        : undefined,
    });
  }
}

/**
 * Error for permission denied
 */
export class PermissionDeniedError extends AuthorizationError {
  constructor(
    action: string,
    options?: {
      userId?: string;
      tenantId?: string;
      correlationId?: string;
      resourceId?: string;
    },
  ) {
    super(
      `Permission denied for action: ${action}`,
      ErrorCode.PERMISSION_DENIED,
      options,
    );
  }
}

/**
 * Error for insufficient permissions
 */
export class InsufficientPermissionsError extends AuthorizationError {
  constructor(
    requiredPermission: string,
    options?: {
      userId?: string;
      tenantId?: string;
      correlationId?: string;
    },
  ) {
    super(
      `Insufficient permissions. Required: ${requiredPermission}`,
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      options,
    );
  }
}

// ============================================
// NOT FOUND ERRORS
// ============================================

/**
 * Base not found error
 */
export abstract class NotFoundError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      correlationId?: string;
      tenantId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, code, {
      statusCode: HttpStatus.NOT_FOUND,
      isOperational: true,
      ...options,
    });
  }
}

/**
 * Error for resource not found
 */
export class ResourceNotFoundError extends NotFoundError {
  public readonly resourceType: string;
  public readonly resourceId: string | number;

  constructor(
    resourceType: string,
    resourceId: string | number,
    options?: {
      correlationId?: string;
      tenantId?: string;
    },
  ) {
    super(
      `${resourceType} with ID ${resourceId} not found`,
      ErrorCode.RESOURCE_NOT_FOUND,
      {
        ...options,
        metadata: { resourceType, resourceId: String(resourceId) },
      },
    );
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Error for user not found
 */
export class UserNotFoundError extends NotFoundError {
  constructor(identifier: string, options?: { correlationId?: string }) {
    super(`User not found: ${identifier}`, ErrorCode.USER_NOT_FOUND, {
      ...options,
      metadata: { identifier },
    });
  }
}

// ============================================
// CONFLICT ERRORS
// ============================================

/**
 * Base conflict error
 */
export abstract class ConflictError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      correlationId?: string;
      tenantId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, code, {
      statusCode: HttpStatus.CONFLICT,
      isOperational: true,
      ...options,
    });
  }
}

/**
 * Error for duplicate entries
 */
export class DuplicateEntryError extends ConflictError {
  public readonly field: string;
  public readonly value: unknown;

  constructor(
    field: string,
    value: unknown,
    options?: {
      correlationId?: string;
      tenantId?: string;
    },
  ) {
    super(`Duplicate value for field: ${field}`, ErrorCode.DUPLICATE_ENTRY, {
      ...options,
      metadata: { field, value: String(value) },
    });
    this.field = field;
    this.value = value;
  }
}

/**
 * Error for resource already exists
 */
export class ResourceAlreadyExistsError extends ConflictError {
  constructor(
    resourceType: string,
    identifier: string,
    options?: {
      correlationId?: string;
      tenantId?: string;
    },
  ) {
    super(
      `${resourceType} already exists: ${identifier}`,
      ErrorCode.RESOURCE_ALREADY_EXISTS,
      {
        ...options,
        metadata: { resourceType, identifier },
      },
    );
  }
}

// ============================================
// RATE LIMITING ERRORS
// ============================================

/**
 * Error for rate limit exceeded
 */
export class RateLimitExceededError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    options?: {
      retryAfter?: number;
      correlationId?: string;
    },
  ) {
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      isOperational: true,
      ...options,
    });
    this.retryAfter = options?.retryAfter;
  }
}

// ============================================
// BUSINESS LOGIC ERRORS
// ============================================

/**
 * Base business logic error
 */
export abstract class BusinessLogicError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, code, {
      statusCode: HttpStatus.BAD_REQUEST,
      isOperational: true,
      ...options,
    });
  }
}

/**
 * Error for business rule violations
 */
export class BusinessRuleViolationError extends BusinessLogicError {
  public readonly rule: string;

  constructor(
    rule: string,
    message: string,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message, ErrorCode.BUSINESS_RULE_VIOLATION, {
      ...options,
      metadata: { rule, ...options?.details },
    });
    this.rule = rule;
  }
}

/**
 * Error for insufficient balance
 */
export class InsufficientBalanceError extends BusinessLogicError {
  public readonly currentBalance: number;
  public readonly requiredAmount: number;

  constructor(
    currentBalance: number,
    requiredAmount: number,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
    },
  ) {
    super(
      `Insufficient balance. Current: ${currentBalance}, Required: ${requiredAmount}`,
      ErrorCode.INSUFFICIENT_BALANCE,
      {
        ...options,
        metadata: { currentBalance, requiredAmount },
      },
    );
    this.currentBalance = currentBalance;
    this.requiredAmount = requiredAmount;
  }
}

/**
 * Error for plan limit reached
 */
export class PlanLimitReachedError extends BusinessLogicError {
  public readonly limit: number;
  public readonly current: number;
  public readonly resource: string;

  constructor(
    resource: string,
    current: number,
    limit: number,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
    },
  ) {
    super(
      `${resource} limit reached. Current: ${current}, Limit: ${limit}`,
      ErrorCode.PLAN_LIMIT_REACHED,
      {
        ...options,
        metadata: { resource, current, limit },
      },
    );
    this.limit = limit;
    this.current = current;
    this.resource = resource;
  }
}

// ============================================
// EXTERNAL SERVICE ERRORS
// ============================================

/**
 * Base external service error
 */
export abstract class ExternalServiceError extends AppError {
  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      serviceName?: string;
      correlationId?: string;
      tenantId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, code, {
      statusCode: HttpStatus.BAD_GATEWAY,
      isOperational: true,
      ...options,
    });
  }
}

/**
 * Error for external API failures
 */
export class ExternalApiError extends ExternalServiceError {
  public readonly serviceName: string;
  public readonly originalError?: string;

  constructor(
    serviceName: string,
    message: string,
    options?: {
      originalError?: string;
      correlationId?: string;
      tenantId?: string;
      statusCode?: number;
    },
  ) {
    super(message, ErrorCode.THIRD_PARTY_API_ERROR, {
      serviceName,
      ...options,
    });
    this.serviceName = serviceName;
    this.originalError = options?.originalError;
  }
}

/**
 * Error for database failures
 */
export class DatabaseError extends AppError {
  public readonly operation: string;
  public readonly originalError?: string;

  constructor(
    operation: string,
    message: string = 'Database operation failed',
    options?: {
      originalError?: string;
      correlationId?: string;
      tenantId?: string;
    },
  ) {
    super(message, ErrorCode.DATABASE_ERROR, {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      isOperational: true,
      ...options,
    });
    this.operation = operation;
    this.originalError = options?.originalError;
  }
}

/**
 * Error for circuit breaker open state
 */
export class CircuitBreakerError extends ExternalServiceError {
  public readonly serviceName: string;
  public readonly nextRetry?: number;

  constructor(
    serviceName: string,
    options?: {
      nextRetry?: number;
      correlationId?: string;
    },
  ) {
    super(
      `Circuit breaker is open for service: ${serviceName}`,
      ErrorCode.CIRCUIT_BREAKER_OPEN,
      {
        serviceName,
        ...options,
      },
    );
    this.serviceName = serviceName;
    this.nextRetry = options?.nextRetry;
  }
}

// ============================================
// INTERNAL SERVER ERRORS
// ============================================

/**
 * Internal server error - should not expose details to client
 */
export class InternalServerError extends AppError {
  public readonly internalMessage?: string;

  constructor(
    message: string = 'An unexpected error occurred',
    options?: {
      internalMessage?: string;
      correlationId?: string;
      tenantId?: string;
      userId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, ErrorCode.INTERNAL_ERROR, {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      isOperational: false,
      ...options,
    });
    this.internalMessage = options?.internalMessage;
  }

  /**
   * Creates an internal error with full context for logging
   */
  static fromError(
    error: Error,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
      additionalContext?: Record<string, unknown>;
    },
  ): InternalServerError {
    return new InternalServerError('An unexpected error occurred', {
      internalMessage: error.message,
      correlationId: options?.correlationId,
      tenantId: options?.tenantId,
      userId: options?.userId,
      metadata: {
        stack: error.stack,
        ...options?.additionalContext,
      },
    });
  }
}

/**
 * Error for service unavailable
 */
export class ServiceUnavailableError extends AppError {
  public readonly serviceName?: string;
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Service temporarily unavailable',
    options?: {
      serviceName?: string;
      retryAfter?: number;
      correlationId?: string;
    },
  ) {
    super(message, ErrorCode.SERVICE_UNAVAILABLE, {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      isOperational: true,
      ...options,
    });
    this.serviceName = options?.serviceName;
    this.retryAfter = options?.retryAfter;
  }
}

// ============================================
// ERROR FACTORY
// ============================================

/**
 * Factory for creating errors from various sources
 */
export class ErrorFactory {
  /**
   * Creates an appropriate error based on HTTP status
   */
  static fromHttpStatus(
    status: number,
    message: string,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
    },
  ): AppError {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return new ValidationError(message, options);
      case HttpStatus.UNAUTHORIZED:
        return new AuthenticationFailedError(options);
      case HttpStatus.FORBIDDEN:
        return new PermissionDeniedError(message, options);
      case HttpStatus.NOT_FOUND:
        return new ResourceNotFoundError('Resource', message, options);
      case HttpStatus.CONFLICT:
        return new DuplicateEntryError('resource', message, options);
      case HttpStatus.TOO_MANY_REQUESTS:
        return new RateLimitExceededError(message, options);
      case HttpStatus.SERVICE_UNAVAILABLE:
        return new ServiceUnavailableError(message, options);
      default:
        return new InternalServerError(message, options);
    }
  }

  /**
   * Wraps a standard error into an AppError
   */
  static fromStandardError(
    error: Error,
    options?: {
      correlationId?: string;
      tenantId?: string;
      userId?: string;
    },
  ): AppError {
    // Check if it's already an AppError
    if (error instanceof AppError) {
      return error;
    }

    // Handle known error types
    const message = error.message.toLowerCase();

    if (message.includes('not found') || message.includes('does not exist')) {
      return new ResourceNotFoundError('Resource', 'unknown', options);
    }

    if (message.includes('duplicate') || message.includes('already exists')) {
      return new DuplicateEntryError('field', 'value', options);
    }

    if (message.includes('permission') || message.includes('forbidden')) {
      return new PermissionDeniedError('action', options);
    }

    if (
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {
      return new AuthenticationFailedError(options);
    }

    // Default to internal server error
    return InternalServerError.fromError(error, options);
  }
}

// ============================================
// NESTJS HTTP EXCEPTION CONVERTER
// ============================================

/**
 * Converts AppError to NestJS HttpException
 */
export class AppErrorHttpException extends HttpException {
  constructor(error: AppError) {
    super(
      {
        status: 'error',
        error: error.toApiError(),
        meta: {
          timestamp: error.timestamp,
          requestId: error.correlationId,
        },
      },
      error.statusCode,
    );
  }
}
