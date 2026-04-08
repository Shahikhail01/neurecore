/**
 * Agent Controller - REST API endpoints
 * SOLID: Controllers depend on services via DI
 * Location: src/modules/nocobase/agents.controller.ts
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AgentService } from '../../core/services/agent.service';
import {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  AgentFilters,
} from '../../domain/models';

@Controller('api/v1/agents')
export class AgentsController {
  constructor(private agentService: AgentService) {}

  /**
   * Create a new agent
   * POST /api/v1/agents
   */
  @Post()
  async create(@Body() input: CreateAgentInput): Promise<Agent> {
    if (!input.name || !input.version || !input.tenantId) {
      throw new BadRequestException(
        'Missing required fields: name, version, tenantId',
      );
    }
    return this.agentService.createAgent(input);
  }

  /**
   * Get all agents for a tenant
   * GET /api/v1/agents?tenantId=xxx&status=active
   */
  @Get()
  async list(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('search') search?: string,
  ): Promise<Agent[]> {
    if (!tenantId) {
      throw new BadRequestException('tenantId query parameter is required');
    }

    const filters: AgentFilters = {
      tenantId,
      status: status as any,
      departmentId,
      search,
    };

    return this.agentService.listAgents(filters);
  }

  /**
   * Get agent by ID
   * GET /api/v1/agents/:id
   */
  @Get(':id')
  async getById(@Param('id') id: string): Promise<Agent | null> {
    return this.agentService.getAgentById(id);
  }

  /**
   * Update agent
   * PUT /api/v1/agents/:id
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateAgentInput,
  ): Promise<Agent> {
    const agent = await this.agentService.getAgentById(id);
    if (!agent) {
      throw new BadRequestException(`Agent ${id} not found`);
    }
    return this.agentService.updateAgentStatus(
      id,
      input.status || agent.status,
    );
  }

  /**
   * Update agent status
   * PATCH /api/v1/agents/:id/status
   */
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ): Promise<Agent> {
    return this.agentService.updateAgentStatus(id, body.status as any);
  }

  /**
   * Update agent mood
   * PATCH /api/v1/agents/:id/mood
   */
  @Put(':id/mood')
  async updateMood(
    @Param('id') id: string,
    @Body() body: { mood: number },
  ): Promise<Agent> {
    if (body.mood < 0 || body.mood > 100) {
      throw new BadRequestException('Mood must be between 0 and 100');
    }
    return this.agentService.updateAgentMood(id, body.mood);
  }

  /**
   * Delete agent
   * DELETE /api/v1/agents/:id
   */
  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.agentService.deleteAgent(id);
  }
}
