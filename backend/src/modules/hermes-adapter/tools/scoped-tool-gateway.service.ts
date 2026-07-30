import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { CustomersService } from '../../customers/customers.service';
import { ProjectsService } from '../../projects/projects.service';
import { GoalsService } from '../../goals/goals.service';
import { TasksService } from '../../orchestration/services/tasks.service';
import { ApprovalsService } from '../../approvals/services/approvals.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MemoryService } from '../../memory/memory.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { HermesScopedTokenClaims } from '../services/token.service';
import { approvalRequiredTools, NC_TOOL_NAMES, ncToolSchemas, type NcToolName } from './scoped-tool.schemas';

export interface ToolGatewayResult {
  success: boolean;
  data?: unknown;
  deferred?: boolean;
  approvalId?: string;
  truncated?: boolean;
  error?: { code: string; message: string; retriable: boolean };
}

@Injectable()
export class ScopedToolGatewayService {
  constructor(
    private readonly customers: CustomersService,
    private readonly projects: ProjectsService,
    private readonly goals: GoalsService,
    private readonly tasks: TasksService,
    private readonly approvals: ApprovalsService,
    private readonly notifications: NotificationsService,
    private readonly memory: MemoryService,
    private readonly prisma: PrismaService,
  ) {}

  listTools(): readonly string[] { return NC_TOOL_NAMES; }

  async execute(name: string, args: unknown, claims: HermesScopedTokenClaims, approvedApprovalId?: string): Promise<ToolGatewayResult> {
    const started = Date.now();
    const toolName = name as NcToolName;
    const allowed = NC_TOOL_NAMES.includes(toolName) && claims.allowedTools.includes(toolName);
    if (!allowed) {
      await this.audit(claims, name, args, 'denied', Date.now() - started);
      throw new ForbiddenException(`Tool ${name} is not allowed for this execution`);
    }
    const parsed = ncToolSchemas[toolName].safeParse(args);
    if (!parsed.success) {
      await this.audit(claims, name, args, 'denied', Date.now() - started, parsed.error.flatten());
      throw new BadRequestException({ code: 'INVALID_TOOL_ARGUMENTS', issues: parsed.error.issues });
    }
    try {
      if (approvalRequiredTools.has(toolName)) {
        if (approvedApprovalId) {
          const approved = await this.approvals.findOne(approvedApprovalId, claims.tenantId);
          if (!approved || approved.status !== 'APPROVED') throw new ForbiddenException('Approval is not granted');
          if (approved.resourceId !== claims.executionId) throw new ForbiddenException('Approval execution mismatch');
          const data = await this.dispatch(toolName, parsed.data as Record<string, any>, claims);
          await this.audit(claims, name, parsed.data, 'allowed', Date.now() - started, { approvalId: approvedApprovalId });
          return this.limit({ success: true, data });
        }
        const argsHash = createHash('sha256')
          .update(JSON.stringify(parsed.data))
          .digest('hex');
        const existing = await this.prisma.approvalRequest.findFirst({
          where: {
            tenantId: claims.tenantId,
            status: 'PENDING',
            resourceType: 'hermes_tool_call',
            resourceId: claims.executionId,
            AND: [
              { payload: { path: ['toolName'], equals: toolName } },
              { payload: { path: ['argsHash'], equals: argsHash } },
            ],
          },
          select: { id: true },
        });
        if (existing) {
          await this.audit(claims, name, parsed.data, 'deferred', Date.now() - started, {
            approvalId: existing.id,
            reused: true,
          });
          return { success: true, deferred: true, approvalId: existing.id };
        }
        const approval = await this.approvals.create(claims.tenantId, {
          title: `Approve ${toolName}`,
          description: `Autonomous execution ${claims.executionId} requested ${toolName}`,
          resourceType: 'hermes_tool_call',
          resourceId: claims.executionId,
          requestedById: claims.sub,
          payload: { toolName, args: parsed.data, argsHash, executionId: claims.executionId },
        });
        await this.audit(claims, name, parsed.data, 'deferred', Date.now() - started, { approvalId: approval.id });
        return { success: true, deferred: true, approvalId: approval.id };
      }
      const data = await this.dispatch(toolName, parsed.data as Record<string, any>, claims);
      await this.audit(claims, name, parsed.data, 'allowed', Date.now() - started);
      return this.limit({ success: true, data });
    } catch (error) {
      await this.audit(claims, name, parsed.data, 'failed', Date.now() - started, { message: error instanceof Error ? error.message : String(error) });
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
      return { success: false, error: { code: 'TOOL_EXECUTION_FAILED', message: error instanceof Error ? error.message : 'Tool execution failed', retriable: false } };
    }
  }

  private async dispatch(name: NcToolName, a: Record<string, any>, c: HermesScopedTokenClaims): Promise<unknown> {
    switch (name) {
      case 'nc.plan_workflow': {
        await this.prisma.auditLog.create({ data: {
          actor: c.sub, tenantId: c.tenantId, action: 'autonomous.plan', resource: 'workflow',
          resourceId: c.executionId, result: 'success', correlationId: c.executionId,
          details: { steps: a.steps } as Prisma.InputJsonValue,
        } });
        return { planId: c.executionId, steps: a.steps, recorded: true };
      }
      case 'nc.list_customers': return this.customers.findAll(c.tenantId, { search: a.query, limit: a.limit });
      case 'nc.create_customer': {
        const existing = await this.prisma.customer.findFirst({
          where: {
            tenantId: c.tenantId,
            name: { equals: a.name, mode: 'insensitive' },
          },
        });
        if (existing) return existing;
        return this.customers.create({ name: a.name, financialSubType: a.financialSubType, lifecycleStage: a.lifecycleStage }, c.tenantId);
      }
      case 'nc.create_project': {
        const existing = await this.prisma.project.findFirst({
          where: {
            tenantId: c.tenantId,
            customerId: a.customerId,
            name: { equals: a.name, mode: 'insensitive' },
          },
        });
        if (existing) return existing;
        return this.projects.create({ name: a.name, customerId: a.customerId, projectTypeId: a.projectTypeId, metadata: { stageTemplate: a.stageTemplate } }, c.tenantId);
      }
      case 'nc.create_goal': {
        const existing = await this.prisma.goal.findFirst({
          where: {
            tenantId: c.tenantId,
            projectId: a.projectId,
            title: { equals: a.name, mode: 'insensitive' },
          },
        });
        if (existing) return existing;
        return this.goals.create({ projectId: a.projectId, title: a.name, description: a.description }, c.tenantId);
      }
      case 'nc.create_task': {
        const existing = await this.prisma.task.findFirst({
          where: {
            tenantId: c.tenantId,
            projectId: a.projectId,
            goalId: a.goalId,
            title: { equals: a.title, mode: 'insensitive' },
          },
        });
        if (existing) return existing;
        return this.tasks.create({ projectId: a.projectId, goalId: a.goalId, title: a.title, dueDate: a.dueDate, createdById: c.sub }, c.tenantId);
      }
      case 'nc.assign_task': {
        const agent = await this.prisma.agent.findFirst({ where: { id: a.agentProfileId, tenantId: c.tenantId, isActive: true }, select: { id: true } });
        if (!agent) throw new NotFoundException('Eligible agent not found');
        return this.tasks.update(a.taskId, { agentId: agent.id }, c.tenantId);
      }
      case 'nc.update_task_status': {
        if (a.evidence) await this.tasks.update(a.taskId, { expectedOutput: a.evidence }, c.tenantId);
        return this.tasks.updateStatus(a.taskId, a.status as TaskStatus, c.tenantId);
      }
      case 'nc.submit_for_approval': return this.approvals.create(c.tenantId, { title: `Review ${a.entityType}`, resourceType: a.entityType, resourceId: a.entityId, requestedById: c.sub, payload: { ...a.payload, executionId: c.executionId } });
      case 'nc.send_notification': {
        const user = await this.prisma.user.findFirst({ where: { id: a.userId, tenantId: c.tenantId }, select: { id: true } });
        if (!user) throw new NotFoundException('Notification recipient not found');
        return this.notifications.create({ type: 'INFO', title: a.title, message: a.body, userId: user.id, tenantId: c.tenantId, payload: { link: a.link, executionId: c.executionId } });
      }
      case 'nc.search_memory': return this.memory.search({ tenantId: c.tenantId, query: a.query, limit: a.limit });
    }
  }

  private limit(result: ToolGatewayResult): ToolGatewayResult {
    const encoded = JSON.stringify(result);
    if (Buffer.byteLength(encoded) <= 50 * 1024) return result;
    return { success: true, data: encoded.slice(0, 50 * 1024), truncated: true };
  }

  private async audit(c: HermesScopedTokenClaims, toolName: string, args: unknown, decision: string, durationMs: number, extra: unknown = {}): Promise<void> {
    await this.prisma.auditLog.create({ data: {
      actor: c.sub, tenantId: c.tenantId, action: 'autonomous.tool.call', resource: toolName,
      resourceId: c.executionId, result: decision === 'allowed' || decision === 'deferred' ? 'success' : 'failure',
      correlationId: c.executionId,
      details: { toolName, argsHash: createHash('sha256').update(JSON.stringify(args ?? {})).digest('hex'), decision, durationMs, extra } as Prisma.InputJsonValue,
    } });
  }
}
