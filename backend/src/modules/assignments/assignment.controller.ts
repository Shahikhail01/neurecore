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
import type { AssignTaskInput } from './commands/assign-task.command';
import type { ReleaseAssignmentInput } from './commands/release-assignment.command';
import type { CommandMetadata } from '../../common/correlation/correlation.interface';

interface AuthUser {
  tenantId: string;
  id?: string;
  type?: string;
}

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly service: AssignmentService) {}

  private requireTenant(user: AuthUser | undefined): string {
    if (!user?.tenantId) {
      throw new ForbiddenException('TENANT_REQUIRED');
    }
    return user.tenantId;
  }

  @Get('eligible-agents/:taskId')
  async findEligible(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const tenantId = this.requireTenant(user);
    return this.service.findEligibleAgents({
      tenantId,
      requiredRole: null,
      requiredCapabilities: [],
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
    const input: AssignTaskInput = {
      ...body,
      tenantId,
      overrideByActorId: body.overrideByActorId ?? user.id,
      overrideByActorType: body.overrideByActorType ?? user.type ?? 'HUMAN',
    };
    return this.service.executeAssign(input, metadata);
  }

  @Post('release')
  async release(
    @Body() body: ReleaseAssignmentInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const tenantId = this.requireTenant(user);
    const metadata = this.metadataFromRequest(user, req, tenantId);
    const input: ReleaseAssignmentInput = {
      ...body,
      tenantId,
      releasedByActorId: body.releasedByActorId ?? user.id ?? 'SYSTEM',
      releasedByActorType: body.releasedByActorType ?? user.type ?? 'HUMAN',
    };
    return this.service.executeRelease(input, metadata);
  }

  @Get('override-audit/:taskId')
  async overrideAudit(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const tenantId = this.requireTenant(user);
    try {
      return await this.service.listOverrideAudits(tenantId, taskId);
    } catch (e) {
      if ((e as Error)?.message === 'TASK_NOT_FOUND') {
        throw new NotFoundException('TASK_NOT_FOUND');
      }
      throw e;
    }
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