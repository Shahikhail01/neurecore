/**
 * Audit Logging Service
 * Logs all authenticated actions and security events
 * SOLID: Single Responsibility - Audit logging only
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import { Injectable, Logger } from '@nestjs/common';
import { ILogger } from '../../domain/interfaces';

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',

  // Authorization events
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  ACCESS_DENIED = 'ACCESS_DENIED',

  // Security events
  AUTH_MISSING_TOKEN = 'AUTH_MISSING_TOKEN',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

  // Data operations
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',

  // Admin operations
  USER_CREATED = 'USER_CREATED',
  USER_DELETED = 'USER_DELETED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  TENANT_MODIFIED = 'TENANT_MODIFIED',
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  id?: string;
  userId: string | null;
  tenantId?: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  status: 'SUCCESS' | 'FAILED' | 'DENIED';
  timestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Security event (subset of audit log)
 */
export interface SecurityEvent {
  userId: string | null;
  action: string;
  resource: string;
  details: Record<string, any>;
  status: 'SUCCESS' | 'FAILED' | 'DENIED';
}

/**
 * AuditLogService - Centralized audit logging
 * All authentication and data operations logged
 *
 * SOLID Principles:
 * - S: Only responsible for audit logging
 * - O: Can extend with new log targets without changing
 * - L: ILogger interface substitutable
 * - I: Depends on ILogger interface, not concrete logger
 * - D: Logger injected via constructor
 */
@Injectable()
export class AuditLogService {
  private readonly logger: Logger;
  private readonly auditLogs: AuditLogEntry[] = []; // In-memory storage for demo

  constructor(private readonly nLogger: ILogger) {
    this.logger = new Logger('AuditLog');
  }

  /**
   * Log security event (authentication/authorization)
   * @param event Security event details
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const entry: AuditLogEntry = {
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      details: event.details,
      status: event.status,
      timestamp: new Date(),
    };

    await this.log(entry);

    // Alert on suspicious activity
    if (event.status === 'DENIED' || event.status === 'FAILED') {
      this.nLogger.warn(
        `Security Event: ${event.action} - ${event.status}`,
        entry.details,
      );
    }
  }

  /**
   * Log data operation (CRUD)
   * @param userId User ID performing operation
   * @param action Operation type (CREATE, READ, UPDATE, DELETE)
   * @param resource Resource name (e.g., 'agents', 'tasks')
   * @param recordId ID of affected record
   * @param changes What changed (for updates)
   * @param status Operation status
   */
  async logDataOperation(
    userId: string | null,
    action: AuditEventType,
    resource: string,
    recordId: string,
    changes?: Record<string, any>,
    status: 'SUCCESS' | 'FAILED' = 'SUCCESS',
  ): Promise<void> {
    const entry: AuditLogEntry = {
      userId,
      action: action.toString(),
      resource,
      details: {
        recordId,
        changes,
      },
      status,
      timestamp: new Date(),
    };

    await this.log(entry);
  }

  /**
   * Log authentication event
   * @param userId User ID
   * @param action LOGIN, LOGOUT, TOKEN_REFRESH
   * @param status Operation status
   * @param details Additional context
   */
  async logAuthEvent(
    userId: string,
    action: AuditEventType,
    status: 'SUCCESS' | 'FAILED',
    details?: Record<string, any>,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      userId,
      action: action.toString(),
      resource: 'authentication',
      details: details || {},
      status,
      timestamp: new Date(),
    };

    await this.log(entry);

    if (status === 'SUCCESS') {
      this.nLogger.log(
        `User ${userId} ${action.toLowerCase()} at ${new Date().toISOString()}`,
      );
    } else {
      this.nLogger.warn(
        `Failed ${action.toLowerCase()} for user ${userId}`,
        details,
      );
    }
  }

  /**
   * Internal log function
   * In production, would write to database/external system
   * @param entry Audit log entry
   */
  private async log(entry: AuditLogEntry): Promise<void> {
    // Store in memory (demo)
    this.auditLogs.push(entry);

    // In production:
    // 1. Write to NocoDB audit_logs collection
    // 2. Send to external logging service (e.g., DataDog, Splunk)
    // 3. Archive old logs

    this.logger.debug(
      `[${entry.action}] User: ${entry.userId} | Resource: ${entry.resource} | Status: ${entry.status}`,
    );
  }

  /**
   * Get audit logs (with pagination)
   * @param userId Filter by user (optional)
   * @param action Filter by action (optional)
   * @param limit Number of records
   * @param offset Pagination offset
   * @returns Array of audit logs
   */
  async getLogs(
    userId?: string,
    action?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<AuditLogEntry[]> {
    let filtered = this.auditLogs;

    if (userId) {
      filtered = filtered.filter((log) => log.userId === userId);
    }

    if (action) {
      filtered = filtered.filter((log) => log.action === action);
    }

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get logs for specific resource
   * @param resource Resource name (agents, tasks, approvals)
   * @param limit Number of records
   * @returns Recent logs for resource
   */
  async getResourceLogs(
    resource: string,
    limit: number = 50,
  ): Promise<AuditLogEntry[]> {
    return this.auditLogs
      .filter((log) => log.resource === resource)
      .slice(-limit);
  }

  /**
   * Clear audit logs (for testing only)
   */
  clearLogs(): void {
    this.auditLogs.length = 0;
  }
}
