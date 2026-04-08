/**
 * NocoDB API Integration Examples
 * Reference implementations for connecting repositories to NocoDB via @nocodb/sdk
 * 
 * Purpose: Show how to replace TODO comments with actual NocoDB SDK calls
 * This file serves as documentation + copy-paste reference
 *
 * @author NeureCore Development
 * @version 1.0.0
 * @date 2026-04-07
 */

/**
 * INSTALLATION (if not already done)
 * pnpm add @nocodb/sdk
 */

/**
 * ============================================================================
 * EXAMPLE 1: UserRepository Implementation with NocoDB
 * ============================================================================
 */
export const USER_REPOSITORY_EXAMPLE = `
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NocoDB } from '@nocodb/sdk'

export interface User {
  id: string
  email: string
  passwordHash: string
  tenantId: string
  role: 'admin' | 'agent_manager' | 'task_approver' | 'viewer'
  firstName?: string
  lastName?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name)
  private noco: NocoDB
  private usersTableId: string

  constructor(private configService: ConfigService) {
    this.initializeNocoDB()
  }

  /**
   * Initialize NocoDB client with API token
   */
  private async initializeNocoDB() {
    const baseUrl = this.configService.get('NOCO_BASE_URL')
    const apiToken = this.configService.get('NOCO_API_TOKEN')
    const baseId = this.configService.get('NOCO_BASE_ID')

    this.noco = new NocoDB({
      baseUrl,
      token: apiToken,
    })

    // For now, hardcoded table ID. In production, fetch from base metadata
    this.usersTableId = 'table_users_id'
  }

  /**
   * Find user by email
   * GET /api/v2/tables/{usersTableId}/records?where=(email,eq,{email})
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('users')
        .read({
          limit: 1,
          where: '(email,eq,' + email + ')',
        })

      if (records.list && records.list.length > 0) {
        return this.mapRecordToUser(records.list[0])
      }
      return null
    } catch (error) {
      this.logger.error(\`Error finding user by email: \${error.message}\`)
      throw error
    }
  }

  /**
   * Find user by ID
   * GET /api/v2/tables/{usersTableId}/records/{recordId}
   */
  async findById(userId: string): Promise<User | null> {
    try {
      const record = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('users')
        .read({ limit: 1 })
        .then(r => r.list.find(u => u.id === userId))

      if (record) {
        return this.mapRecordToUser(record)
      }
      return null
    } catch (error) {
      this.logger.error(\`Error finding user by ID: \${error.message}\`)
      throw error
    }
  }

  /**
   * Find users by tenant
   * GET /api/v2/tables/{usersTableId}/records?where=(tenantId,eq,{tenantId})
   */
  async findByTenant(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<User[]> {
    try {
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('users')
        .read({
          limit,
          offset,
          where: '(tenantId,eq,' + tenantId + ')',
        })

      return records.list.map(r => this.mapRecordToUser(r))
    } catch (error) {
      this.logger.error(\`Error finding users by tenant: \${error.message}\`)
      throw error
    }
  }

  /**
   * Create user
   * POST /api/v2/tables/{usersTableId}/records
   */
  async create(input: Partial<User>): Promise<User> {
    try {
      const newRecord = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('users')
        .create({
          email: input.email,
          passwordHash: input.passwordHash,
          tenantId: input.tenantId,
          role: input.role || 'viewer',
          firstName: input.firstName,
          lastName: input.lastName,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      return this.mapRecordToUser(newRecord)
    } catch (error) {
      this.logger.error(\`Error creating user: \${error.message}\`)
      throw error
    }
  }

  /**
   * Update user
   * PATCH /api/v2/tables/{usersTableId}/records/{recordId}
   */
  async update(userId: string, input: Partial<User>): Promise<User> {
    try {
      const updated = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('users')
        .update(userId, {
          ...input,
          updatedAt: new Date(),
        })

      return this.mapRecordToUser(updated)
    } catch (error) {
      this.logger.error(\`Error updating user: \${error.message}\`)
      throw error
    }
  }

  /**
   * Helper: Map NocoDB record to User interface
   */
  private mapRecordToUser(record: any): User {
    return {
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      tenantId: record.tenantId,
      role: record.role,
      firstName: record.firstName,
      lastName: record.lastName,
      isActive: record.isActive === true || record.isActive === 'true',
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }
  }
}
`

/**
 * ============================================================================
 * EXAMPLE 2: SessionRepository Implementation with NocoDB
 * ============================================================================
 */
export const SESSION_REPOSITORY_EXAMPLE = `
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NocoDB } from '@nocodb/sdk'

export interface Session {
  id: string
  userId: string
  refreshToken: string
  expiresAt: Date
  createdAt: Date
  ipAddress?: string
  userAgent?: string
  isRevoked: boolean
}

@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name)
  private noco: NocoDB
  private sessionsTableId: string

  constructor(private configService: ConfigService) {
    this.initializeNocoDB()
  }

  private async initializeNocoDB() {
    const baseUrl = this.configService.get('NOCO_BASE_URL')
    const apiToken = this.configService.get('NOCO_API_TOKEN')

    this.noco = new NocoDB({
      baseUrl,
      token: apiToken,
    })

    this.sessionsTableId = 'table_sessions_id'
  }

  /**
   * Create session
   * POST /api/v2/tables/{sessionsTableId}/records
   */
  async create(session: Partial<Session>): Promise<Session> {
    try {
      const newRecord = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('sessions')
        .create({
          userId: session.userId,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          createdAt: new Date(),
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          isRevoked: false,
        })

      return this.mapRecordToSession(newRecord)
    } catch (error) {
      this.logger.error(\`Error creating session: \${error.message}\`)
      throw error
    }
  }

  /**
   * Find by refresh token
   * GET /api/v2/tables/{sessionsTableId}/records?where=(refreshToken,eq,{token})
   */
  async findByRefreshToken(token: string): Promise<Session | null> {
    try {
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('sessions')
        .read({
          limit: 1,
          where: '(refreshToken,eq,' + token + ')',
        })

      if (records.list && records.list.length > 0) {
        return this.mapRecordToSession(records.list[0])
      }
      return null
    } catch (error) {
      this.logger.error(\`Error finding session: \${error.message}\`)
      throw error
    }
  }

  /**
   * Get active sessions for user
   * GET /api/v2/tables/{sessionsTableId}/records?where=(userId,eq,{userId})&where=(isRevoked,eq,false)
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    try {
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('sessions')
        .read({
          where: '(userId,eq,' + userId + ')~and(isRevoked,eq,false)',
        })

      return records.list.map(r => this.mapRecordToSession(r))
    } catch (error) {
      this.logger.error(\`Error getting active sessions: \${error.message}\`)
      throw error
    }
  }

  /**
   * Revoke session
   * PATCH /api/v2/tables/{sessionsTableId}/records/{recordId}
   */
  async revoke(sessionId: string): Promise<void> {
    try {
      await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('sessions')
        .update(sessionId, { isRevoked: true })
    } catch (error) {
      this.logger.error(\`Error revoking session: \${error.message}\`)
      throw error
    }
  }

  /**
   * Revoke all user sessions
   * PATCH /api/v2/tables/{sessionsTableId}/records (bulk)
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getActiveSessions(userId)
      
      for (const session of sessions) {
        await this.revoke(session.id)
      }
    } catch (error) {
      this.logger.error(\`Error revoking all user sessions: \${error.message}\`)
      throw error
    }
  }

  /**
   * Delete expired sessions
   * DELETE /api/v2/tables/{sessionsTableId}/records/{recordId} (multiple)
   */
  async deleteExpired(): Promise<number> {
    try {
      const now = new Date()
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('sessions')
        .read({
          where: '(expiresAt,lt,' + now.toISOString() + ')',
        })

      let deletedCount = 0
      for (const record of records.list) {
        await this.noco.db
          .base(this.configService.get('NOCO_BASE_ID'))
          .table('sessions')
          .delete(record.id)
        deletedCount++
      }

      return deletedCount
    } catch (error) {
      this.logger.error(\`Error deleting expired sessions: \${error.message}\`)
      throw error
    }
  }

  private mapRecordToSession(record: any): Session {
    return {
      id: record.id,
      userId: record.userId,
      refreshToken: record.refreshToken,
      expiresAt: new Date(record.expiresAt),
      createdAt: new Date(record.createdAt),
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      isRevoked: record.isRevoked === true || record.isRevoked === 'true',
    }
  }
}
`

/**
 * ============================================================================
 * EXAMPLE 3: AuditLogRepository Implementation with NocoDB
 * ============================================================================
 */
export const AUDIT_LOG_REPOSITORY_EXAMPLE = `
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NocoDB } from '@nocodb/sdk'

export interface AuditLogEntry {
  id: string
  userId?: string
  tenantId?: string
  action: string
  resource: string
  details?: Record<string, any>
  status: 'SUCCESS' | 'FAILED' | 'DENIED'
  timestamp: Date
  ipAddress?: string
}

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name)
  private noco: NocoDB

  constructor(private configService: ConfigService) {
    this.initializeNocoDB()
  }

  private async initializeNocoDB() {
    const baseUrl = this.configService.get('NOCO_BASE_URL')
    const apiToken = this.configService.get('NOCO_API_TOKEN')

    this.noco = new NocoDB({
      baseUrl,
      token: apiToken,
    })
  }

  /**
   * Create audit log entry
   * POST /api/v2/tables/{auditLogsTableId}/records
   */
  async create(entry: Partial<AuditLogEntry>): Promise<AuditLogEntry> {
    try {
      const newRecord = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('audit_logs')
        .create({
          userId: entry.userId,
          tenantId: entry.tenantId,
          action: entry.action,
          resource: entry.resource,
          details: JSON.stringify(entry.details || {}),
          status: entry.status,
          timestamp: new Date(),
          ipAddress: entry.ipAddress,
        })

      return this.mapRecordToAuditLog(newRecord)
    } catch (error) {
      this.logger.error(\`Error creating audit log: \${error.message}\`)
      throw error
    }
  }

  /**
   * Get logs for user
   * GET /api/v2/tables/{auditLogsTableId}/records?where=(userId,eq,{userId})
   */
  async getByUserId(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('audit_logs')
        .read({
          limit,
          where: '(userId,eq,' + userId + ')',
          sort: [{ field: 'timestamp', direction: 'desc' }],
        })

      return records.list.map(r => this.mapRecordToAuditLog(r))
    } catch (error) {
      this.logger.error(\`Error getting user audit logs: \${error.message}\`)
      throw error
    }
  }

  /**
   * Get logs for resource
   * GET /api/v2/tables/{auditLogsTableId}/records?where=(resource,eq,{resource})
   */
  async getByResource(resource: string, limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('audit_logs')
        .read({
          limit,
          where: '(resource,eq,' + resource + ')',
          sort: [{ field: 'timestamp', direction: 'desc' }],
        })

      return records.list.map(r => this.mapRecordToAuditLog(r))
    } catch (error) {
      this.logger.error(\`Error getting resource audit logs: \${error.message}\`)
      throw error
    }
  }

  /**
   * Delete old logs (retention policy)
   * Deletes logs older than retentionDays
   */
  async deleteOldLogs(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const records = await this.noco.db
        .base(this.configService.get('NOCO_BASE_ID'))
        .table('audit_logs')
        .read({
          where: '(timestamp,lt,' + cutoffDate.toISOString() + ')',
        })

      let deletedCount = 0
      for (const record of records.list) {
        await this.noco.db
          .base(this.configService.get('NOCO_BASE_ID'))
          .table('audit_logs')
          .delete(record.id)
        deletedCount++
      }

      return deletedCount
    } catch (error) {
      this.logger.error(\`Error deleting old audit logs: \${error.message}\`)
      throw error
    }
  }

  private mapRecordToAuditLog(record: any): AuditLogEntry {
    return {
      id: record.id,
      userId: record.userId,
      tenantId: record.tenantId,
      action: record.action,
      resource: record.resource,
      details: record.details ? JSON.parse(record.details) : {},
      status: record.status,
      timestamp: new Date(record.timestamp),
      ipAddress: record.ipAddress,
    }
  }
}
`

/**
 * ============================================================================
 * QUICK START: 3-STEP MIGRATION
 * ============================================================================
 *
 * STEP 1: Install NocoDB SDK
 *   pnpm add @nocodb/sdk
 *
 * STEP 2: Copy examples into your repository files
 *   - Copy USER_REPOSITORY_EXAMPLE into UserRepository class
 *   - Copy SESSION_REPOSITORY_EXAMPLE into SessionRepository class
 *   - Copy AUDIT_LOG_REPOSITORY_EXAMPLE into AuditLogRepository class
 *
 * STEP 3: Update environment variables
 *   NOCO_BASE_URL=http://localhost:8080
 *   NOCO_API_TOKEN=<your_api_token>
 *   NOCO_BASE_ID=<your_base_id>
 *
 * STEP 4: Initialize NocoDB schema
 *   Run: SchemaInitializer.initialize()
 *   This creates users, sessions, audit_logs tables
 *
 * STEP 5: Test with login endpoint
 *   POST http://localhost:3000/api/v1/auth/login
 *   Body: { "email": "admin@example.com", "password": "password123" }
 * ============================================================================
 */

export const IMPLEMENTATION_CHECKLIST = `
## NocoDB Repository Implementation Checklist

### UserRepository
- [ ] Install @nocodb/sdk
- [ ] Create UserRepository class with DI
- [ ] Implement findByEmail() with NocoDB SDK
- [ ] Implement findById() with NocoDB SDK
- [ ] Implement findByTenant() with NocoDB SDK
- [ ] Implement create() with NocoDB SDK
- [ ] Implement update() with NocoDB SDK
- [ ] Add error logging and retry logic
- [ ] Test with real NocoDB instance
- [ ] Update Phase2AuthModule to inject UserRepository

### SessionRepository
- [ ] Create SessionRepository class
- [ ] Implement create() - insert new session
- [ ] Implement findByRefreshToken() - lookup by token
- [ ] Implement getActiveSessions() - filter by userId + isRevoked=false
- [ ] Implement revoke() - set isRevoked=true
- [ ] Implement revokeAllUserSessions() - bulk update
- [ ] Implement deleteExpired() - cleanup old sessions
- [ ] Add error handling
- [ ] Update Phase2AuthModule to inject SessionRepository
- [ ] Test session creation and rotation

### AuditLogRepository
- [ ] Create AuditLogRepository class
- [ ] Implement create() - insert log entries
- [ ] Implement getByUserId() - filter by userId
- [ ] Implement getByResource() - filter by resource
- [ ] Implement deleteOldLogs() - retention policy (90 days)
- [ ] Add timestamp sorting (DESC)
- [ ] Update Phase2AuthModule to inject AuditLogRepository
- [ ] Test audit log creation on login/logout

### Schema Initialization
- [ ] Verify auth-schema.init.ts has table definitions
- [ ] Create SchemaInitializer.initialize() method call on app startup
- [ ] Confirm users table exists with all columns
- [ ] Confirm sessions table exists with isRevoked + expiresAt
- [ ] Confirm audit_logs table exists with timestamp + index

### Environment Setup
- [ ] Add NOCO_BASE_URL to .env
- [ ] Add NOCO_API_TOKEN to .env
- [ ] Add NOCO_BASE_ID to .env
- [ ] Set up database auto-initialization on first boot
- [ ] Verify connection with test query

### Testing
- [ ] Integration test: Register new user
- [ ] Integration test: Login returns tokens
- [ ] Integration test: Refresh token creates new session
- [ ] Integration test: Logout revokes all sessions
- [ ] Integration test: Audit log created for each operation
- [ ] Load test: 100 concurrent login attempts
- [ ] Verify session limit enforcement (max 5)
`;
