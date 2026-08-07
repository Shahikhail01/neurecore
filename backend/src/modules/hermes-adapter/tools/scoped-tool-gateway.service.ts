import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelKind, Prisma, TaskStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { CustomersService } from '../../customers/customers.service';
import { ProjectsService } from '../../projects/projects.service';
import { GoalsService } from '../../goals/goals.service';
import { TasksService } from '../../orchestration/services/tasks.service';
import { ApprovalsService } from '../../approvals/services/approvals.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MemoryService } from '../../memory/memory.service';
import { PredictionService } from '../../analytics/services/prediction.service';
import {
  CaseTriageService,
  CustomerTouchpointService,
  KnowledgeGapService,
  QuoteService,
  RealTimeGuidanceService,
} from '../../service-ops/service-ops-360.service';
import { AiTwinService } from '../../ai-twin/ai-twin.service';
import { TwinGraphExecutor } from '../../ai-twin/twin-graph.executor';
import { ChannelService } from '../../channels/channel.service';
import { DealsService } from '../../sales-outreach/deals/deals.service';
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
    private readonly prediction: PredictionService,
    private readonly quoteService: QuoteService,
    private readonly caseTriage: CaseTriageService,
    private readonly realTimeGuidance: RealTimeGuidanceService,
    private readonly knowledgeGap: KnowledgeGapService,
    private readonly customerTouchpoint: CustomerTouchpointService,
    private readonly aiTwin: AiTwinService,
    private readonly twinGraphExecutor: TwinGraphExecutor,
    private readonly dealsService: DealsService,
    private readonly channelService: ChannelService,
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
      case 'nc.score_lead': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const prediction = await this.prediction.predict({
          tenantId: c.tenantId,
          subject: { type: 'lead', id: a.leadId },
          predictionType: 'lead_score',
        });
        return {
          leadId: a.leadId,
          tenantId: c.tenantId,
          score: prediction.value,
          confidence: prediction.confidence,
          model: prediction.model,
          abstained: prediction.value == null,
          explanation: prediction.explanation,
          limitations: prediction.limitations,
          generatedAt: prediction.generatedAt,
          expiresAt: prediction.expiresAt,
        };
      }
      case 'nc.next_best_step': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const subjectType = a.dealId ? 'deal' : 'contact';
        const subjectId = (a.dealId ?? a.contactId) as string;
        const prediction = await this.prediction.predict({
          tenantId: c.tenantId,
          subject: { type: subjectType, id: subjectId },
          predictionType: 'next_best_action',
        });
        return {
          subjectType,
          subjectId,
          tenantId: c.tenantId,
          nextBestAction: prediction.value,
          confidence: prediction.confidence,
          model: prediction.model,
          explanation: prediction.explanation,
          limitations: prediction.limitations,
          generatedAt: prediction.generatedAt,
        };
      }
      case 'nc.forecast_pipeline': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const horizonDays = a.horizonDays ?? 90;

        // R3: weighted pipeline now derives from the Deal aggregate
        // (stage × amount × probability) AND the existing Quote
        // aggregation. The chat tool surfaces both so the user can
        // see why they differ (legacy LEGACY_BRIDGE deals vs new
        // commits).
        const dealForecast = await this.dealsService.forecastForTenant(c.tenantId);

        const quotes = await this.prisma.quote.findMany({
          where: { tenantId: c.tenantId },
          select: { id: true, total: true, subtotal: true, status: true, createdAt: true },
          take: 500,
        });
        const totalCount = quotes.length;
        const totalAmount = quotes.reduce((sum, q) => {
          const t = typeof q.total === 'number' ? q.total : Number(q.total ?? 0);
          return sum + t;
        }, 0);
        const byStatus: Record<string, { count: number; total: number }> = {};
        for (const q of quotes) {
          const t = typeof q.total === 'number' ? q.total : Number(q.total ?? 0);
          const bucket = byStatus[q.status] ?? { count: 0, total: 0 };
          bucket.count += 1;
          bucket.total += t;
          byStatus[q.status] = bucket;
        }

        return {
          tenantId: c.tenantId,
          quarter: a.quarter ?? null,
          horizonDays,
          generatedAt: new Date().toISOString(),
          // R3: deal-stage forecast (preferred — first-class sales pipeline)
          deals: {
            count: dealForecast.dealsCount,
            byStage: dealForecast.byStage,
            weightedTotal: dealForecast.weightedTotal,
            committedTotal: dealForecast.committedTotal,
            bestCaseTotal: dealForecast.bestCaseTotal,
            totalAmount: dealForecast.totalAmount,
          },
          // Legacy quote-based pipeline (kept for backwards-compatible chat history)
          quotes: {
            count: totalCount,
            totalAmount,
            byStatus,
          },
          // Human-friendly one-line summary the chat can quote
          summary:
            `Weighted forecast ${dealForecast.weightedTotal.toFixed(2)} across ` +
            `${dealForecast.dealsCount} active deals; ` +
            `committed ${dealForecast.committedTotal.toFixed(2)} ` +
            `(negotiation + won).`,
        };
      }
      case 'nc.generate_quote': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const existing = await this.prisma.quote.findFirst({
          where: {
            tenantId: c.tenantId,
            dealId: a.dealId,
            aiGenerated: true,
            status: 'DRAFT',
          },
          select: { id: true, quoteNumber: true, total: true, status: true },
        });
        if (existing) {
          return { ...existing, reused: true };
        }
        return this.quoteService.createDraft({
          tenantId: c.tenantId,
          dealId: a.dealId,
          items: a.items,
          aiGenerated: true,
          generatedByAgentId: `hermes-tool:${c.executionId}`,
        });
      }
      case 'nc.resolve_case': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        if (a.action === 'classify') {
          const triage = await this.caseTriage.evaluate({
            tenantId: c.tenantId,
            caseId: a.caseId,
            payload: { caseId: a.caseId },
          });
          return { action: 'classify', caseId: a.caseId, triage };
        }
        if (a.action === 'suggest') {
          const guidance = await this.realTimeGuidance.suggest({
            tenantId: c.tenantId,
            caseId: a.caseId,
            agentId: c.sub,
          });
          return { action: 'suggest', caseId: a.caseId, guidance };
        }
        return {
          action: 'draft_reply',
          caseId: a.caseId,
          draft:
            'Acknowledged. I am reviewing the case details and will follow up with a full response shortly.',
        };
      }
      case 'nc.search_kb': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const limit = a.limit ?? 5;
        const gaps = await this.knowledgeGap.list(c.tenantId);
        const matches = gaps.filter((g) =>
          `${g.topic} ${g.suggestedTitle ?? ''}`
            .toLowerCase()
            .includes(a.query.toLowerCase()),
        );
        const rows = (matches.length > 0 ? matches : gaps).slice(0, limit).map((g) => ({
          id: g.id,
          topic: g.topic,
          suggestedTitle: g.suggestedTitle,
          status: g.status,
          caseCount: g.caseCount,
        }));
        return {
          tenantId: c.tenantId,
          query: a.query,
          totalMatches: rows.length,
          results: rows,
        };
      }
      case 'nc.customer_360': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const customer = await this.prisma.customer.findFirst({
          where: { id: a.customerId, tenantId: c.tenantId },
          select: {
            id: true,
            name: true,
            financialSubType: true,
            lifecycleStage: true,
            createdAt: true,
          },
        });
        if (!customer) {
          throw new NotFoundException(`customer ${a.customerId} not found for tenant`);
        }
        const view = await this.customerTouchpoint.get360View(c.tenantId, a.customerId);
        return { ...customer, ...view };
      }
      case 'nc.run_ai_twin': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        // R2: replaced audit-log-only stub with real LangGraph execution.
        // TwinGraphExecutor:
        //   1. loads the twin + asserts ACTIVE
        //   2. builds the permission envelope via TwinPermissionMirrorGuard
        //   3. invokes OfficialAgentGraph with allowedTools + threadId
        //   4. persists an audit row via AiTwinService.recordRunAudit
        const result = await this.twinGraphExecutor.invoke({
          tenantId: c.tenantId,
          actorId: c.sub,
          twinId: a.twinId,
          intent: a.intent,
        });
        return {
          twinId: result.twinId,
          runId: result.runId,
          status: result.status,
          intent: a.intent,
          output: result.output,
          toolCalls: result.toolCalls,
          durationMs: result.durationMs,
          correlationId: result.correlationId,
        };
      }
      case 'nc.dispatch_channel': {
        if (!c.tenantId || c.tenantId === '*') {
          throw new ForbiddenException('tenantId "*" is forbidden');
        }
        const validKinds = new Set<string>(Object.values(ChannelKind));
        if (!validKinds.has(a.channelKind)) {
          throw new BadRequestException(`unknown channelKind: ${a.channelKind}`);
        }
        return this.channelService.dispatch({
          kind: a.channelKind as ChannelKind,
          tenantId: c.tenantId,
          connectionId: a.targetId,
          actionName: 'send',
          payload: a.payload,
        });
      }
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
