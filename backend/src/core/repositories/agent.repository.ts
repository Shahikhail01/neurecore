/**
 * Agent Repository Implementation
 * SOLID: Liskov Substitution - Truly substitutable for IAgentRepository
 * Uses NocoDB SDK directly (no rebuilding)
 * Location: src/core/repositories/agent.repository.ts
 */

import { Injectable } from '@nestjs/common';
import { NocoDB } from 'nocodb/sdk';
import {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  AgentFilters,
  AgentStatus,
} from '../domain/models';
import { IAgentRepository } from '../domain/interfaces';

@Injectable()
export class NocoBaseAgentRepository implements IAgentRepository {
  private collection: any; // NocoDB collection

  constructor(private noco: NocoDB) {
    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      this.collection = await this.noco.db().collection('agents');
    } catch (error) {
      console.error('Failed to initialize agents collection:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Agent | null> {
    try {
      const record = await this.collection.repository().findOne({
        where: { id },
      });
      return record || null;
    } catch (error) {
      console.error('Error finding agent by id:', error);
      return null;
    }
  }

  async findAll(filters: AgentFilters): Promise<Agent[]> {
    try {
      const query: any = { where: { tenantId: filters.tenantId } };

      if (filters.status) {
        query.where.status = filters.status;
      }

      if (filters.departmentId) {
        query.where.departmentId = filters.departmentId;
      }

      if (filters.search) {
        query.where = {
          ...query.where,
          name: { like: `%${filters.search}%` },
        };
      }

      return this.collection.repository().find(query);
    } catch (error) {
      console.error('Error finding all agents:', error);
      return [];
    }
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    try {
      return await this.collection.repository().create({
        ...input,
        status: input.status || AgentStatus.ACTIVE,
        mood: input.mood || 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async update(id: string, input: UpdateAgentInput): Promise<Agent> {
    try {
      return await this.collection.repository().update({
        id,
        ...input,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating agent:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.repository().delete({ id });
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }
}
