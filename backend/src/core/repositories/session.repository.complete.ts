/**
 * SessionRepository - Complete NocoDB Implementation
 * Manages refresh token sessions and token rotation
 * Critical for secure token lifecycle management
 *
 * @author NeureCore Development
 * @version 1.1.0 (Complete Implementation)
 * @date 2026-04-07
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NocoDB } from '@nocodb/sdk';

/**
 * Session interface - matches NocoDB sessions table schema
 */
export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isRevoked: boolean;
}

/**
 * SessionRepository - Complete implementation with NocoDB SDK
 * Handles ALL session operations:
 *   - Create new session on login
 *   - Validate session before token refresh
 *   - Revoke single session on logout
 *   - Revoke all user sessions on password change
 *   - Cleanup expired sessions (maintenance)
 *   - Enforce max sessions per user
 *
 * SOLID:
 *   - S: Only session management
 *   - O: Easy to add new session queries
 *   - L: Standard NocoDB patterns
 *   - I: Focused, minimal interface
 *   - D: ConfigService injected
 */
@Injectable()
export class SessionRepository {
  private readonly logger = new Logger(SessionRepository.name);
  private noco: NocoDB;
  private baseId: string;
  private baseUrl: string;
  private readonly MAX_SESSIONS_PER_USER = 5;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize NocoDB client - lazy loading to avoid startup issues
   */
  private async ensureInitialized(): Promise<void> {
    if (this.noco) return;

    try {
      this.baseUrl = this.configService.get<string>('NOCO_BASE_URL');
      this.baseId = this.configService.get<string>('NOCO_BASE_ID');
      const apiToken = this.configService.get<string>('NOCO_API_TOKEN');

      if (!this.baseUrl || !this.baseId || !apiToken) {
        throw new Error('Missing NocoDB configuration');
      }

      this.noco = new NocoDB({
        baseUrl: this.baseUrl,
        token: apiToken,
      });

      this.logger.log('NocoDB client initialized for SessionRepository');
    } catch (error) {
      this.logger.error(`Failed to initialize NocoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create new session for user
   * Called on successful login
   * Query: POST /api/v2/tables/{sessionsTableId}/records
   *
   * @param userId User ID to create session for
   * @param refreshToken Refresh token to store
   * @param ipAddress Optional client IP for security tracking
   * @param userAgent Optional client user-agent for security tracking
   * @returns Created session record
   */
  async create(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Session> {
    await this.ensureInitialized();

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Enforce max sessions per user BEFORE creating new one
      await this.enforceMaxSessions(userId);

      const newRecord = await this.noco.db
        .base(this.baseId)
        .table('sessions')
        .insert({
          userId,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
          createdAt: now.toISOString(),
          ipAddress: ipAddress || '',
          userAgent: userAgent || '',
          isRevoked: false,
        });

      this.logger.log(`Created session for user: ${userId}`);
      return this.mapRecordToSession(newRecord);
    } catch (error) {
      this.logger.error(`Error creating session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find session by refresh token
   * Called on token refresh to validate session
   * Query: GET /api/v2/tables/{sessionsTableId}/records?where=(refreshToken,eq,{token})
   *
   * @param refreshToken Token to search for
   * @returns Session if found, null otherwise
   */
  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    await this.ensureInitialized();

    try {
      const records = await this.noco.db
        .base(this.baseId)
        .table('sessions')
        .where({ refreshToken })
        .limit(1)
        .read();

      if (!records || records.length === 0) {
        this.logger.debug(`Session not found for refresh token`);
        return null;
      }

      return this.mapRecordToSession(records[0]);
    } catch (error) {
      this.logger.error(
        `Error finding session by refresh token: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Validate session is active and not expired
   * Called before allowing token refresh
   *
   * @param sessionId Session ID to validate
   * @returns true if session is valid (not revoked, not expired), false otherwise
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const records = await this.noco.db
        .base(this.baseId)
        .table('sessions')
        .where({ id: sessionId })
        .limit(1)
        .read();

      if (!records || records.length === 0) {
        return false;
      }

      const session = this.mapRecordToSession(records[0]);
      const now = new Date();

      // Valid if: not revoked AND not expired
      return !session.isRevoked && session.expiresAt > now;
    } catch (error) {
      this.logger.error(`Error validating session: ${error.message}`);
      return false;
    }
  }

  /**
   * Revoke single session by ID
   * Called on logout or token refresh (old token revoked)
   * Query: PATCH /api/v2/tables/{sessionsTableId}/records/{recordId}
   *
   * @param sessionId Session ID to revoke
   */
  async revoke(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.noco.db.base(this.baseId).table('sessions').update(sessionId, {
        isRevoked: true,
      });

      this.logger.log(`Revoked session: ${sessionId}`);
    } catch (error) {
      this.logger.error(
        `Error revoking session ${sessionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   * Called on logout or password change to invalidate all devices
   * Query: PATCH /api/v2/tables/{sessionsTableId}/records (bulk update)
   *
   * @param userId User ID to revoke all sessions for
   * @returns Number of sessions revoked
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    await this.ensureInitialized();

    try {
      const sessions = await this.getActiveSessions(userId);

      let count = 0;
      for (const session of sessions) {
        await this.revoke(session.id);
        count++;
      }

      this.logger.log(`Revoked ${count} sessions for user: ${userId}`);
      return count;
    } catch (error) {
      this.logger.error(`Error revoking all user sessions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * Query: GET /api/v2/tables/{sessionsTableId}/records?where=(userId,eq,{userId})&where=(isRevoked,eq,false)
   *
   * @param userId User ID to get sessions for
   * @returns Array of active sessions
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    await this.ensureInitialized();

    try {
      const now = new Date();

      const records = await this.noco.db
        .base(this.baseId)
        .table('sessions')
        .where({ userId, isRevoked: false })
        .read();

      if (!records) {
        return [];
      }

      // Filter out expired sessions
      return records
        .map((r) => this.mapRecordToSession(r))
        .filter((s) => s.expiresAt > now);
    } catch (error) {
      this.logger.error(
        `Error getting active sessions for user ${userId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Count active sessions for a user
   * @param userId User ID
   * @returns Number of active sessions
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    const sessions = await this.getActiveSessions(userId);
    return sessions.length;
  }

  /**
   * Enforce max sessions per user
   * If user has >= MAX_SESSIONS_PER_USER, revoke oldest session
   * Called before creating new session
   *
   * @param userId User ID to enforce limit for
   */
  async enforceMaxSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getActiveSessions(userId);

      if (sessions.length >= this.MAX_SESSIONS_PER_USER) {
        // Sort by createdAt ascending (oldest first)
        sessions.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        // Revoke oldest session
        const oldest = sessions[0];
        await this.revoke(oldest.id);
        this.logger.log(
          `Enforced max sessions (${this.MAX_SESSIONS_PER_USER}): revoked oldest session for user ${userId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Error enforcing max sessions: ${error.message}`);
      // Don't throw - allow login to proceed but log issue
    }
  }

  /**
   * Delete all expired sessions
   * Called by maintenance job (e.g., daily cron)
   * Query: DELETE /api/v2/tables/{sessionsTableId}/records (multiple)
   *
   * @returns Number of sessions deleted
   */
  async deleteExpired(): Promise<number> {
    await this.ensureInitialized();

    try {
      const now = new Date();

      const records = await this.noco.db
        .base(this.baseId)
        .table('sessions')
        .read();

      if (!records) {
        return 0;
      }

      let deletedCount = 0;
      for (const record of records) {
        const session = this.mapRecordToSession(record);
        if (session.expiresAt <= now) {
          await this.noco.db
            .base(this.baseId)
            .table('sessions')
            .delete(record.id);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} expired sessions`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(`Error deleting expired sessions: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get all sessions for a user (including revoked)
   * Used for security audits
   * @param userId User ID
   * @param limit Max records to return
   * @returns All sessions (active and revoked)
   */
  async getAllSessions(
    userId: string,
    limit: number = 100,
  ): Promise<Session[]> {
    await this.ensureInitialized();

    try {
      const records = await this.noco.db
        .base(this.baseId)
        .table('sessions')
        .where({ userId })
        .limit(limit)
        .read();

      if (!records) {
        return [];
      }

      return records.map((r) => this.mapRecordToSession(r));
    } catch (error) {
      this.logger.error(
        `Error getting all sessions for user ${userId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Helper: Map NocoDB record to Session interface
   * Handles type conversions from NocoDB JSON response
   */
  private mapRecordToSession(record: any): Session {
    return {
      id: record.id || record.pk_session_id,
      userId: record.userId || record.user_id,
      refreshToken: record.refreshToken || record.refresh_token,
      expiresAt: new Date(record.expiresAt || record.expires_at),
      createdAt: new Date(record.createdAt || record.created_at),
      ipAddress: record.ipAddress || record.ip_address || '',
      userAgent: record.userAgent || record.user_agent || '',
      isRevoked:
        record.isRevoked === true ||
        record.isRevoked === 'true' ||
        record.is_revoked === true,
    };
  }
}
