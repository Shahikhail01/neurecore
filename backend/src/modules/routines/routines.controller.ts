/**
 * Routines Controller
 *
 * Full CRUD operations for routines + webhook trigger endpoint.
 * Follows NestJS REST conventions with proper validation and authorization.
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
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Headers,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateRoutineDto,
  UpdateRoutineDto,
  CreateTriggerDto,
  UpdateTriggerDto,
  ExecuteRoutineDto,
  ListRoutinesQueryDto,
  ListRunsQueryDto,
} from './dto/routine.dto';
import { ActionResult } from '../../common/responses/action-result.response';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import type { RoutineResponseDto } from './dto/routine-response.dto';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { RoutineExecutionService } from './services/routine-execution.service';
import {
  PrismaRoutineRepository,
  PrismaRoutineTriggerRepository,
  PrismaRoutineRunRepository,
} from './repositories/prisma-routine.repository';

/**
 * Phase 1 Gap 6 — added URI versioning (`/api/v1/routines`) and
 * `resolveTenantId()` helper for SUPER_ADMIN cross-tenant access.
 */
@Controller({ path: 'routines', version: '1' })
@ApiCommon('routines')
@UseGuards(JwtAuthGuard)
export class RoutinesController {
  constructor(
    private readonly routineRepo: PrismaRoutineRepository,
    private readonly triggerRepo: PrismaRoutineTriggerRepository,
    private readonly runRepo: PrismaRoutineRunRepository,
    private readonly executionService: RoutineExecutionService,
  ) {}

  // ─── Routine CRUD ─────────────────────────────────────────────────────────

  @Post()
  async createRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoutineDto,
  ) {
    const routine = await this.routineRepo.create({
      name: dto.name,
      description: dto.description,
      graphDefinition: dto.graphDefinition,
      config: dto.config,
      metadata: dto.metadata,
      ownerAgentId: dto.ownerAgentId,
      tenantId,
      createdById: userId,
    });

    if (Array.isArray(dto.triggers) && dto.triggers.length > 0) {
      await Promise.all(
        dto.triggers.map((trigger) =>
          this.triggerRepo.create(routine.id, {
            type: trigger.type,
            name: trigger.name,
            config: trigger.config,
          }),
        ),
      );
    }

    const createdRoutine = await this.routineRepo.findById(routine.id, tenantId);

    return {
      status: 'success',
      data: createdRoutine ?? routine,
    };
  }

  @Get()
  async listRoutines(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListRoutinesQueryDto,
  ): Promise<PaginatedResponse<RoutineResponseDto>> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { routines, total } = await this.routineRepo.findAll(tenantId, {
      status: query.status,
      limit,
      offset,
      orderBy: query.orderBy,
      order: query.order,
      ownerAgentId: query.ownerAgentId,
      ownerAgentIds: query.ownerAgentIds
        ? query.ownerAgentIds.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    });

    const page = Math.floor(offset / limit) + 1;
    return {
      items: routines as unknown as RoutineResponseDto[],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get(':id')
  @TenantIsolated()
  async getRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const routine = await this.routineRepo.findById(id, tenantId);

    if (!routine) {
      return {
        status: 'error',
        message: 'Routine not found',
      };
    }

    return {
      status: 'success',
      data: routine,
    };
  }

  @Put(':id')
  async updateRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoutineDto,
  ) {
    const routine = await this.routineRepo.update(id, tenantId, {
      name: dto.name,
      description: dto.description,
      graphDefinition: dto.graphDefinition,
      config: dto.config,
      metadata: dto.metadata,
      ownerAgentId: dto.ownerAgentId,
    });

    // Update status if provided
    if (dto.status) {
      await this.routineRepo.updateStatus(id, tenantId, dto.status);
    }

    return {
      status: 'success',
      data: routine,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.routineRepo.delete(id, tenantId);
  }

  // ─── Trigger Management ───────────────────────────────────────────────────

  @Post(':id/triggers')
  async createTrigger(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) routineId: string,
    @Body() dto: CreateTriggerDto,
  ) {
    // Verify routine belongs to tenant
    const routine = await this.routineRepo.findById(routineId, tenantId);
    if (!routine) {
      return {
        status: 'error',
        message: 'Routine not found',
      };
    }

    const trigger = await this.triggerRepo.create(routineId, {
      type: dto.type,
      name: dto.name,
      config: dto.config,
    });

    return {
      status: 'success',
      data: trigger,
    };
  }

  @Get(':id/triggers')
  async listTriggers(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) routineId: string,
  ) {
    // Verify routine belongs to tenant
    const routine = await this.routineRepo.findById(routineId, tenantId);
    if (!routine) {
      return {
        status: 'error',
        message: 'Routine not found',
      };
    }

    const triggers = await this.triggerRepo.findByRoutineId(routineId);

    return {
      status: 'success',
      data: triggers,
    };
  }

  @Put(':id/triggers/:triggerId')
  async updateTrigger(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) routineId: string,
    @Param('triggerId', ParseUUIDPipe) triggerId: string,
    @Body() dto: UpdateTriggerDto,
  ) {
    // Verify trigger belongs to routine and tenant
    const trigger = await this.triggerRepo.findById(triggerId, tenantId);
    if (!trigger || trigger.routineId !== routineId) {
      return {
        status: 'error',
        message: 'Trigger not found',
      };
    }

    const updated = await this.triggerRepo.update(triggerId, tenantId, {
      name: dto.name,
      config: dto.config,
      isActive: dto.isActive,
    });

    return {
      status: 'success',
      data: updated,
    };
  }

  @Delete(':id/triggers/:triggerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTrigger(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) routineId: string,
    @Param('triggerId', ParseUUIDPipe) triggerId: string,
  ) {
    // Verify trigger belongs to routine and tenant
    const trigger = await this.triggerRepo.findById(triggerId, tenantId);
    if (!trigger || trigger.routineId !== routineId) {
      return {
        status: 'error',
        message: 'Trigger not found',
      };
    }

    await this.triggerRepo.delete(triggerId, tenantId);
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  @Post(':id/execute')
  async executeRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) routineId: string,
    @Body() dto: ExecuteRoutineDto,
  ): Promise<ActionResult<unknown>> {
    const routine = await this.routineRepo.findById(routineId, tenantId);
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    const result = await this.executionService.execute({
      routineId,
      tenantId,
      input: dto.input,
      agentId: dto.agentId,
      userId,
      triggerType: 'MANUAL',
    });

    return {
      success: true,
      message: 'Routine execution started',
      data: result,
    };
  }

  @Post(':id/activate')
  async activateRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ActionResult<unknown>> {
    const routine = await this.routineRepo.findById(id, tenantId);
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    const validation = this.executionService.validateGraph(
      routine.graphDefinition as any,
    );

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Cannot activate routine with invalid graph',
        errors: validation.errors,
      });
    }

    const updated = await this.routineRepo.updateStatus(id, tenantId, 'ACTIVE');

    return { success: true, message: 'Routine activated', data: updated };
  }

  @Post(':id/pause')
  async pauseRoutine(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ActionResult<unknown>> {
    const routine = await this.routineRepo.findById(id, tenantId);
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    const updated = await this.routineRepo.updateStatus(id, tenantId, 'PAUSED');

    return { success: true, message: 'Routine paused', data: updated };
  }

  // ─── Run Management ────────────────────────────────────────────────────────

  @Get(':id/runs')
  async listRoutineRuns(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id', ParseUUIDPipe) routineId: string,
    @Query() query: ListRunsQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const routine = await this.routineRepo.findById(routineId, tenantId);
    if (!routine) {
      throw new NotFoundException('Routine not found');
    }

    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const { runs, total } = await this.runRepo.findByRoutineId(routineId, {
      status: query.status as any,
      limit,
      offset,
      orderBy: query.orderBy,
      order: query.order,
    });

    const page = Math.floor(offset / limit) + 1;
    return {
      items: runs as unknown as unknown[],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get('runs')
  async listAllRuns(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: ListRunsQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const { runs, total } = await this.runRepo.findByTenantId(tenantId, {
      status: query.status as any,
      limit,
      offset,
      orderBy: query.orderBy,
      order: query.order,
    });

    const page = Math.floor(offset / limit) + 1;
    return {
      items: runs as unknown as unknown[],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get('runs/:runId')
  async getRun(
    @CurrentUser('tenantId') tenantId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    const run = await this.runRepo.findById(runId, tenantId);

    if (!run) {
      return {
        status: 'error',
        message: 'Run not found',
      };
    }

    // Get current state if running
    let state: Record<string, unknown> | null = null;
    if (run.status === 'RUNNING') {
      const currentState = await this.executionService.getState(runId);
      state = currentState as Record<string, unknown> | null;
    }

    return {
      status: 'success',
      data: {
        ...run,
        currentState: state,
      },
    };
  }

  @Post('runs/:runId/cancel')
  async cancelRun(
    @CurrentUser('tenantId') tenantId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<ActionResult<null>> {
    const run = await this.runRepo.findById(runId, tenantId);
    if (!run) {
      throw new NotFoundException('Run not found');
    }

    await this.executionService.cancel(runId);

    return { success: true, message: 'Run cancelled' };
  }

  @Post('runs/:runId/resume')
  async resumeRun(
    @CurrentUser('tenantId') tenantId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ): Promise<ActionResult<unknown>> {
    const run = await this.runRepo.findById(runId, tenantId);
    if (!run) {
      throw new NotFoundException('Run not found');
    }

    const result = await this.executionService.resume(runId);

    return {
      success: true,
      message: 'Run resumed',
      data: result,
    };
  }
}

/**
 * Webhook Controller (Public - no auth required)
 *
 * Handles incoming webhook triggers for routines.
 * Authentication is via webhook secret validation.
 */
@ApiCommon('routines')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly triggerRepo: PrismaRoutineTriggerRepository,
    private readonly executionService: RoutineExecutionService,
  ) {}

  @Post('routines/*path')
  async handleRoutineWebhook(
    @Param('path') path: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-signature') signature: string,
  ): Promise<ActionResult<{ runId: string; status: string }>> {
    const webhookPath = `/webhooks/routines/${path}`;

    try {
      const result = await this.executionService.handleWebhookTrigger(
        webhookPath,
        body,
      );

      return {
        success: true,
        message: 'Webhook processed',
        data: { runId: result.runId ?? '', status: result.status },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Webhook processing failed';
      return { success: true, message, data: { runId: '', status: 'error' } };
    }
  }
}
