/**
 * Task Controller - REST API endpoints
 * Location: src/modules/nocobase/tasks.controller.ts
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
import { TaskService } from '../../core/services/task.service';
import {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
} from '../../domain/models';

@Controller('api/v1/tasks')
export class TasksController {
  constructor(private taskService: TaskService) {}

  @Post()
  async create(@Body() input: CreateTaskInput): Promise<Task> {
    if (!input.title || !input.agentId) {
      throw new BadRequestException('Missing required fields: title, agentId');
    }
    return this.taskService.createTask(input);
  }

  @Get()
  async list(
    @Query('agentId') agentId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
  ): Promise<Task[]> {
    const filters: TaskFilters = {
      agentId,
      status: status as any,
      priority: priority as any,
      assignedTo,
    };
    return this.taskService.listTasks(filters);
  }

  @Get('agent/:agentId')
  async getByAgent(@Param('agentId') agentId: string): Promise<Task[]> {
    return this.taskService.getTasksByAgent(agentId);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Task | null> {
    return this.taskService.getTaskById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateTaskInput,
  ): Promise<Task> {
    const task = await this.taskService.getTaskById(id);
    if (!task) {
      throw new BadRequestException(`Task ${id} not found`);
    }
    return this.taskService.updateTaskStatus(id, input.status || task.status);
  }

  @Put(':id/complete')
  async complete(@Param('id') id: string): Promise<Task> {
    return this.taskService.completeTask(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    return this.taskService.deleteTask(id);
  }
}
