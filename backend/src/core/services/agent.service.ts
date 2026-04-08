/**
 * Agent Service - Business logic for agent operations
 * SOLID: Single Responsibility - Only agent-related logic
 * SOLID: Dependency Inversion - Receives dependencies via constructor
 * Location: src/core/services/agent.service.ts
 */

import { Injectable } from '@nestjs/common';
import {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  AgentFilters,
} from '../domain/models';
import { IAgentRepository, IEventBus, ILogger } from '../domain/interfaces';

@Injectable()
export class AgentService {
  constructor(
    private agentRepository: IAgentRepository,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Create a new agent
   * All validation happens in repository layer (NocoDB enforces constraints)
   */
  async createAgent(input: CreateAgentInput): Promise<Agent> {
    this.logger.info('Creating agent', { input });

    const agent = await this.agentRepository.create(input);

    // Emit domain event (loosely couples other services)
    await this.eventBus.emit('agent.created', {
      agentId: agent.id,
      tenantId: agent.tenantId,
      timestamp: new Date().toISOString(),
    });

    this.logger.info('Agent created successfully', { agentId: agent.id });
    return agent;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: string,
    status: Agent['status'],
  ): Promise<Agent> {
    this.logger.info('Updating agent status', { agentId, status });

    const agent = await this.agentRepository.update(agentId, { status });

    await this.eventBus.emit('agent.status_changed', {
      agentId,
      newStatus: status,
      timestamp: new Date().toISOString(),
    });

    return agent;
  }

  /**
   * Update agent mood
   */
  async updateAgentMood(agentId: string, mood: number): Promise<Agent> {
    if (mood < 0 || mood > 100) {
      throw new Error('Mood must be between 0 and 100');
    }

    const agent = await this.agentRepository.update(agentId, { mood });

    await this.eventBus.emit('agent.mood_updated', {
      agentId,
      newMood: mood,
      timestamp: new Date().toISOString(),
    });

    return agent;
  }

  /**
   * Get agent by ID
   */
  async getAgentById(id: string): Promise<Agent | null> {
    return this.agentRepository.findById(id);
  }

  /**
   * List agents with filters
   */
  async listAgents(filters: AgentFilters): Promise<Agent[]> {
    return this.agentRepository.findAll(filters);
  }

  /**
   * Delete agent
   */
  async deleteAgent(id: string): Promise<void> {
    await this.agentRepository.delete(id);

    await this.eventBus.emit('agent.deleted', {
      agentId: id,
      timestamp: new Date().toISOString(),
    });
  }
}
