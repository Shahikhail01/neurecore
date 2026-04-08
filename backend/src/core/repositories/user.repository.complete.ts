/**
 * UserRepository - Complete NocoDB Implementation
 * Production-ready data access layer for user management
 * Fully integrated with @nocodb/sdk
 *
 * @author NeureCore Development
 * @version 1.1.0 (Complete Implementation)
 * @date 2026-04-07
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NocoDB } from '@nocodb/sdk';

/**
 * User interface - matches NocoDB users table schema
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  role: 'admin' | 'agent_manager' | 'task_approver' | 'viewer';
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserRepository - Complete implementation with NocoDB SDK
 * SOLID Principles:
 *   - S: Only user data access responsibility
 *   - O: Easy to add new query methods
 *   - L: Uses standard NocoDB SDK patterns
 *   - I: Minimal, focused interface
 *   - D: Injected ConfigService, not hardcoded
 */
@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);
  private noco: NocoDB;
  private baseId: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {}

  /**
   * Initialize NocoDB client - called on first use
   * Lazy initialization to avoid connection issues at startup
   */
  private async ensureInitialized(): Promise<void> {
    if (this.noco) return;

    try {
      this.baseUrl = this.configService.get<string>('NOCO_BASE_URL');
      this.baseId = this.configService.get<string>('NOCO_BASE_ID');
      const apiToken = this.configService.get<string>('NOCO_API_TOKEN');

      if (!this.baseUrl || !this.baseId || !apiToken) {
        throw new Error(
          'Missing NocoDB configuration: NOCO_BASE_URL, NOCO_BASE_ID, NOCO_API_TOKEN',
        );
      }

      this.noco = new NocoDB({
        baseUrl: this.baseUrl,
        token: apiToken,
      });

      this.logger.log('NocoDB client initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize NocoDB: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find user by email address
   * Query: GET /api/v2/tables/{usersTableId}/records?where=(email,eq,{email})
   *
   * @param email User email to search for
   * @returns User if found, null otherwise
   */
  async findByEmail(email: string): Promise<User | null> {
    await this.ensureInitialized();

    try {
      const records = await this.noco.db
        .base(this.baseId)
        .table('users')
        .where({ email })
        .limit(1)
        .read();

      if (!records || records.length === 0) {
        return null;
      }

      return this.mapRecordToUser(records[0]);
    } catch (error) {
      this.logger.error(
        `Error finding user by email ${email}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Find user by ID
   * Query: GET /api/v2/tables/{usersTableId}/records/{recordId}
   *
   * @param userId User ID to search for
   * @returns User if found, throws NotFoundException otherwise
   */
  async findById(userId: string): Promise<User> {
    await this.ensureInitialized();

    try {
      const record = await this.noco.db
        .base(this.baseId)
        .table('users')
        .where({ id: userId })
        .limit(1)
        .read();

      if (!record || record.length === 0) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      return this.mapRecordToUser(record[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error finding user by ID ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find users by tenant with pagination
   * Query: GET /api/v2/tables/{usersTableId}/records?where=(tenantId,eq,{tenantId})&limit={limit}&offset={offset}
   *
   * @param tenantId Tenant ID to filter by
   * @param limit Number of records to return (default 50)
   * @param offset Pagination offset (default 0)
   * @returns Array of users for the tenant
   */
  async findByTenant(
    tenantId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<User[]> {
    await this.ensureInitialized();

    try {
      const records = await this.noco.db
        .base(this.baseId)
        .table('users')
        .where({ tenantId })
        .limit(limit)
        .offset(offset)
        .read();

      if (!records) {
        return [];
      }

      return records.map((r) => this.mapRecordToUser(r));
    } catch (error) {
      this.logger.error(
        `Error finding users by tenant ${tenantId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create new user
   * Query: POST /api/v2/tables/{usersTableId}/records
   *
   * @param input User data to create
   * @returns Created user with ID
   */
  async create(input: Partial<User>): Promise<User> {
    await this.ensureInitialized();

    // Check if email already exists
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new ConflictException(
        `User with email ${input.email} already exists`,
      );
    }

    try {
      const now = new Date().toISOString();

      const newRecord = await this.noco.db
        .base(this.baseId)
        .table('users')
        .insert({
          email: input.email,
          passwordHash: input.passwordHash,
          tenantId: input.tenantId,
          role: input.role || 'viewer',
          firstName: input.firstName || '',
          lastName: input.lastName || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

      this.logger.log(`Created user: ${input.email}`);
      return this.mapRecordToUser(newRecord);
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Error creating user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update user
   * Query: PATCH /api/v2/tables/{usersTableId}/records/{recordId}
   *
   * @param userId User ID to update
   * @param input Fields to update (partial)
   * @returns Updated user
   */
  async update(userId: string, input: Partial<User>): Promise<User> {
    await this.ensureInitialized();

    try {
      const now = new Date().toISOString();

      const updated = await this.noco.db
        .base(this.baseId)
        .table('users')
        .update(userId, {
          ...input,
          updatedAt: now,
        });

      this.logger.log(`Updated user: ${userId}`);
      return this.mapRecordToUser(updated);
    } catch (error) {
      this.logger.error(`Error updating user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if email already exists
   * @param email Email to check
   * @returns true if email exists, false otherwise
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  /**
   * Deactivate user (soft delete)
   * Sets isActive to false instead of deleting record
   * @param userId User ID to deactivate
   */
  async deactivate(userId: string): Promise<void> {
    await this.update(userId, { isActive: false });
    this.logger.log(`Deactivated user: ${userId}`);
  }

  /**
   * Delete user (hard delete)
   * Query: DELETE /api/v2/tables/{usersTableId}/records/{recordId}
   *
   * @param userId User ID to delete
   */
  async delete(userId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.noco.db.base(this.baseId).table('users').delete(userId);

      this.logger.log(`Deleted user: ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get count of users in tenant
   * @param tenantId Tenant ID
   * @returns Number of active users
   */
  async countByTenant(tenantId: string): Promise<number> {
    await this.ensureInitialized();

    try {
      const records = await this.noco.db
        .base(this.baseId)
        .table('users')
        .where({ tenantId, isActive: true })
        .read();

      return records ? records.length : 0;
    } catch (error) {
      this.logger.error(
        `Error counting users by tenant ${tenantId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Helper: Map NocoDB record to User interface
   * Handles type conversions from NocoDB JSON response
   */
  private mapRecordToUser(record: any): User {
    return {
      id: record.id || record.pk_user_id, // NocoDB may use different ID field names
      email: record.email,
      passwordHash: record.passwordHash || record.password_hash,
      tenantId: record.tenantId || record.tenant_id,
      role: record.role || 'viewer',
      firstName: record.firstName || record.first_name || '',
      lastName: record.lastName || record.last_name || '',
      isActive:
        record.isActive === true ||
        record.isActive === 'true' ||
        record.is_active === true,
      createdAt: new Date(record.createdAt || record.created_at),
      updatedAt: new Date(record.updatedAt || record.updated_at),
    };
  }
}
