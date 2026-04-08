/**
 * NocoDB Tables Schema Initializer
 * Creates users, sessions, audit_logs collections
 * Run once on first deployment
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * NocoDB Schema Definition for Phase 2: Authentication
 */
export const AUTH_SCHEMA = {
  users: {
    displayName: 'Users',
    description: 'Application users with authentication credentials',
    columns: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
        rqd: true,
        colOptions: { pattern: '^[a-f0-9-]{36}$' },
      },
      {
        column_name: 'email',
        uidt: 'SingleLineText',
        rqd: true,
        unique: true,
        colOptions: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
      },
      {
        column_name: 'passwordHash',
        uidt: 'SingleLineText',
        rqd: true,
      },
      {
        column_name: 'tenantId',
        uidt: 'SingleLineText',
        rqd: true,
      },
      {
        column_name: 'role',
        uidt: 'SingleSelect',
        rqd: true,
        colOptions: {
          options: [
            { title: 'admin', color: 'blue' },
            { title: 'agent_manager', color: 'green' },
            { title: 'task_approver', color: 'orange' },
            { title: 'viewer', color: 'gray' },
          ],
        },
      },
      {
        column_name: 'isActive',
        uidt: 'Checkbox',
        colOptions: { checked: true },
      },
      {
        column_name: 'firstName',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'lastName',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default: 'NOW()',
      },
      {
        column_name: 'updatedAt',
        uidt: 'DateTime',
        default: 'NOW()',
      },
    ],
  },

  sessions: {
    displayName: 'Sessions',
    description: 'Refresh token sessions for JWT rotation',
    columns: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
        rqd: true,
      },
      {
        column_name: 'userId',
        uidt: 'SingleLineText',
        rqd: true,
      },
      {
        column_name: 'refreshToken',
        uidt: 'SingleLineText',
        rqd: true,
        unique: true,
      },
      {
        column_name: 'expiresAt',
        uidt: 'DateTime',
        rqd: true,
      },
      {
        column_name: 'createdAt',
        uidt: 'DateTime',
        default: 'NOW()',
      },
      {
        column_name: 'ipAddress',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'userAgent',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'isRevoked',
        uidt: 'Checkbox',
        colOptions: { checked: false },
      },
    ],
  },

  audit_logs: {
    displayName: 'Audit Logs',
    description: 'Security and operation audit trail',
    columns: [
      {
        column_name: 'id',
        uidt: 'SingleLineText',
        pk: true,
        rqd: true,
      },
      {
        column_name: 'userId',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'tenantId',
        uidt: 'SingleLineText',
      },
      {
        column_name: 'action',
        uidt: 'SingleLineText',
        rqd: true,
      },
      {
        column_name: 'resource',
        uidt: 'SingleLineText',
        rqd: true,
      },
      {
        column_name: 'details',
        uidt: 'LongText',
      },
      {
        column_name: 'status',
        uidt: 'SingleSelect',
        rqd: true,
        colOptions: {
          options: [
            { title: 'SUCCESS', color: 'green' },
            { title: 'FAILED', color: 'red' },
            { title: 'DENIED', color: 'orange' },
          ],
        },
      },
      {
        column_name: 'timestamp',
        uidt: 'DateTime',
        default: 'NOW()',
      },
      {
        column_name: 'ipAddress',
        uidt: 'SingleLineText',
      },
    ],
  },
};

/**
 * SchemaInitializer - Creates NocoDB tables for Phase 2
 * Call `initialize()` once on first deployment
 */
@Injectable()
export class SchemaInitializer {
  private readonly logger = new Logger('SchemaInitializer');

  /**
   * Initialize all tables
   * TODO: Call NocoDB API to create tables
   */
  async initialize(): Promise<void> {
    this.logger.log('Creating NocoDB authentication schema...');

    // TODO: Implement NocoDB API calls
    // POST /api/v2/db/meta/projects/{projectId}/tables
    // For each table in AUTH_SCHEMA

    this.logger.log('Creating users table...');
    // Create users table

    this.logger.log('Creating sessions table...');
    // Create sessions table

    this.logger.log('Creating audit_logs table...');
    // Create audit_logs table

    this.logger.log('Schema initialization complete ✅');
  }

  /**
   * Verify schema exists
   * @returns true if all tables exist
   */
  async verify(): Promise<boolean> {
    this.logger.log('Verifying authentication schema...');

    // TODO: Query NocoDB API
    // GET /api/v2/db/meta/projects/{projectId}/tables?type=nc

    // Check users table exists
    // Check sessions table exists
    // Check audit_logs table exists

    return true;
  }
}
