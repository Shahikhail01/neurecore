// src/modules/assignments/assignment.controller.ts
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignmentService } from './application/assignment.service';
import { CommandRegistry } from '../../common/commands/command.registry';
import type { AssignTaskInput } from './commands/assign-task.command';
import type { ReleaseAssignmentInput } from './commands/release-assignment.command';
import {
  ASSIGN_TASK_COMMAND,
  ASSIGN_TASK_VERSION,
} from './commands/assign-task.command';
import {
  RELEASE_ASSIGNMENT_COMMAND,
  RELEASE_ASSIGNMENT_VERSION,
} from './commands/release-assignment.command';
import type { CommandMetadata } from '../../common/correlation/correlation.interface';

interface AuthUser {
  tenantId: string;
  id?: string;
  type?: string;
  /**
   * Tenant role/permission derived from the JWT. Manual override requires
   * OWNER | MANAGER; release requires OWNER | MANAGER | LEAD;
   * eligible-agents and read-only audit endpoints accept any role.
   */
  role?: string;
}

const ROLE_OWNER = 'OWNER';
const ROLE_MANAGER = 'MANAGER';
const ROLE_LEAD = 'LEAD';

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(
    private readonly service: AssignmentService,
    private readonly commandRegistry: CommandRegistry,
  ) {}

  private requireTenant(user: AuthUser | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException('TENANT_REQUIRED');
    }
    return user.tenantId;
  }

  private requireOverrideRole(user: AuthUser): void {
    if (!user.role || (user.role !== ROLE_OWNER && user.role !== ROLE_MANAGER)) {
      throw new ForbiddenException('OVERRIDE_REQUIRES_OWNER_OR_MANAGER');
    }
  }

  private requireReleaseRole(user: AuthUser): void {
    if (
      !user.role ||
      (user.role !== ROLE_OWNER &&
        user.role !== ROLE_MANAGER &&
        user.role !== ROLE_LEAD)
    ) {
      throw new ForbiddenException('RELEASE_REQUIRES_OWNER_MANAGER_OR_LEAD');
    }
  }

  @Get('eligible-agents/:taskId')
  async findEligible(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const tenantId = this.requireTenant(user);
    // Honor the task's actual required role / capabilities / department
    // constraints so the picker does not return agents who can never
    // satisfy the task.
    const task = await this.service
      .findTaskSummary(tenantId, taskId)
      .catch(() => null);
    return this.service.findEligibleAgents({
      tenantId,
      requiredRole: task?.requiredRole ?? null,
      requiredCapabilities: task?.requiredCapabilities ?? [],
      departmentId: task?.departmentId ?? undefined,
    });
  }

  @Post('assign')
  async assign(
    @Body() body: AssignTaskInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenantId = this.requireTenant(user);
    const metadata = this.metadataFromRequest(user, req, tenantId);
    const isOverride = !!(body.agentId && body.manualOverrideRationale);
    if (isOverride) this.requireOverrideRole(user);
    const input: AssignTaskInput = {
      ...body,
      tenantId,
      overrideByActorId: body.overrideByActorId ?? user.id,
      overrideByActorType: body.overrideByActorType ?? user.type ?? 'HUMAN',
    };
    // Route through the CommandRegistry so idempotency / replay apply
    // uniformly across HTTP, CLI, and worker invocations.
    const result = await this.commandRegistry.execute<
      AssignTaskInput,
      import('./commands/assign-task.command').AssignTaskResult,
      undefined
    >(ASSIGN_TASK_COMMAND, ASSIGN_TASK_VERSION, input, metadata);

    return result.data;
  }

  @Post('release')
  async release(
    @Body() body: ReleaseAssignmentInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenantId = this.requireTenant(user);
    this.requireReleaseRole(user);
    const metadata = this.metadataFromRequest(user, req, tenantId);
    const input: ReleaseAssignmentInput = {
      ...body,
      tenantId,
      releasedByActorId: body.releasedByActorId ?? user.id ?? 'SYSTEM',
      releasedByActorType: body.releasedByActorType ?? user.type ?? 'HUMAN',
    };
    const result = await this.commandRegistry.execute<
      ReleaseAssignmentInput,
      import('./commands/release-assignment.command').ReleaseAssignmentResult,
      undefined
    >(RELEASE_ASSIGNMENT_COMMAND, RELEASE_ASSIGNMENT_VERSION, input, metadata);
    return result.data;
  }

  @Get('override-audit/:taskId')
  async overrideAudit(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const tenantId = this.requireTenant(user);
    return this.service.listOverrideAudits(tenantId, taskId);
  }

  private metadataFromRequest(
    user: AuthUser,
    req: Request,
    tenantId: string,
  ): CommandMetadata {
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      `assign-${tenantId}-${Date.now()}`;
    const causationId =
      (req.headers['x-causation-id'] as string | undefined) ?? null;
    return {
      tenantId,
      actorId: user.id ?? 'SYSTEM',
      actorType: (user.type as any) ?? 'HUMAN',
      correlationId,
      causationId,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      idempotencyKey: `assign-${tenantId}-${correlationId}`,
    };
  }
}