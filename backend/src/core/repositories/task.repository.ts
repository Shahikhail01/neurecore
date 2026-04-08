/**
 * Task Repository Implementation
 * SOLID: Liskov Substitution - Truly substitutable for ITaskRepository
 * Location: src/core/repositories/task.repository.ts
 */

import { Injectable } from '@nestjs/common';
import { NocoDB } from 'nocodb/sdk';
import {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskStatus,
} from '../domain/models';
import { ITaskRepository } from '../domain/interfaces';

@Injectable()
export class NocoBaseTaskRepository implements ITaskRepository {
  private collection: any;

  constructor(private noco: NocoDB) {
    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    try {
      this.collection = await this.noco.db().collection('tasks');
    } catch (error) {
      console.error('Failed to initialize tasks collection:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Task | null> {
    try {
      const record = await this.collection.repository().findOne({
        where: { id },
      });
      return record || null;
    } catch (error) {
      console.error('Error finding task by id:', error);
      return null;
    }
  }

  async findAll(filters: TaskFilters): Promise<Task[]> {
    try {
      const query: any = { where: {} };

      if (filters.agentId) {
        query.where.agentId = filters.agentId;
      }

      if (filters.status) {
        query.where.status = filters.status;
      }

      if (filters.priority) {
        query.where.priority = filters.priority;
      }

      if (filters.assignedTo) {
        query.where.assignedTo = filters.assignedTo;
      }

      return this.collection.repository().find(query);
    } catch (error) {
      console.error('Error finding all tasks:', error);
      return [];
    }
  }

  async findByAgentId(agentId: string): Promise<Task[]> {
    try {
      return this.collection.repository().find({
        where: { agentId },
      });
    } catch (error) {
      console.error('Error finding tasks by agent:', error);
      return [];
    }
  }

  async create(input: CreateTaskInput): Promise<Task> {
    try {
      return await this.collection.repository().create({
        ...input,
        status: input.status || TaskStatus.PENDING,
        cost: input.cost || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    try {
      return await this.collection.repository().update({
        id,
        ...input,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.repository().delete({ id });
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }
}
