/**
 * Approval Repository Implementation
 * SOLID: Liskov Substitution - Truly substitutable for IApprovalRepository
 * Location: src/core/repositories/approval.repository.ts
 */

import { Injectable } from '@nestjs/common';
import { NocoDB } from 'nocodb/sdk';
import {
  Approval,
  CreateApprovalInput,
  UpdateApprovalInput,
  ApprovalFilters,
  ApprovalStatus,
} from '../domain/models';
import { IApprovalRepository } from '../domain/interfaces';

@Injectable()
export class NocoBaseApprovalRepository implements IApprovalRepository {
  private collection: any;

  constructor(private noco: NocoDB) {
    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      this.collection = await this.noco.db().collection('approvals');
    } catch (error) {
      console.error('Failed to initialize approvals collection:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Approval | null> {
    try {
      const record = await this.collection.repository().findOne({
        where: { id },
      });
      return record || null;
    } catch (error) {
      console.error('Error finding approval by id:', error);
      return null;
    }
  }

  async findAll(filters: ApprovalFilters): Promise<Approval[]> {
    try {
      const query: any = { where: {} };

      if (filters.requestedBy) {
        query.where.requestedBy = filters.requestedBy;
      }

      if (filters.status) {
        query.where.status = filters.status;
      }

      if (filters.priority) {
        query.where.priority = filters.priority;
      }

      return this.collection.repository().find(query);
    } catch (error) {
      console.error('Error finding all approvals:', error);
      return [];
    }
  }

  async findExpiredApprovals(): Promise<Approval[]> {
    try {
      const now = new Date().toISOString();
      return this.collection.repository().find({
        where: {
          expiresAt: { lt: now },
          status: ApprovalStatus.PENDING,
        },
      });
    } catch (error) {
      console.error('Error finding expired approvals:', error);
      return [];
    }
  }

  async create(input: CreateApprovalInput): Promise<Approval> {
    try {
      return await this.collection.repository().create({
        ...input,
        status: ApprovalStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating approval:', error);
      throw error;
    }
  }

  async update(id: string, input: UpdateApprovalInput): Promise<Approval> {
    try {
      return await this.collection.repository().update({
        id,
        ...input,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating approval:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.repository().delete({ id });
    } catch (error) {
      console.error('Error deleting approval:', error);
      throw error;
    }
  }
}
