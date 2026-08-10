/**
 * Initial Work Runtime tools (ADR-004, Phase 4).
 *
 * A deliberately NARROW set backed by capability PUBLIC commands (never Prisma).
 * Read tools (low authority) + controlled internal-write tools (higher authority)
 * + one external/irreversible-sensitive write (approval-sensitive). Registered on
 * bootstrap. Each tool validates input and normalizes results.
 */

import { Injectable, Logger, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { TOOL_REGISTRY } from '../contracts/work-runtime.interface';
import type {
  IToolRegistry,
  RuntimeTool,
  RuntimeToolResult,
  ToolContext,
} from '../contracts/work-runtime.interface';
import { ProjectsService } from '../../projects/projects.service';
import { CustomersService } from '../../customers/customers.service';
import { ProjectStagesService } from '../../project-stages/project-stages.service';
import { TasksService } from '../../orchestration/services/tasks.service';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';
import { ApprovalsService } from '../../governance/services/approvals.service';

function req(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`tool input missing required string "${key}"`);
  }
  return v;
}

@Injectable()
export class RuntimeToolsProvider implements OnApplicationBootstrap {
  private readonly logger = new Logger(RuntimeToolsProvider.name);

  constructor(
    @Inject(TOOL_REGISTRY) private readonly registry: IToolRegistry,
    private readonly projects: ProjectsService,
    private readonly customers: CustomersService,
    private readonly stages: ProjectStagesService,
    private readonly tasks: TasksService,
    private readonly memory: ProjectMemoryService,
    private readonly approvals: ApprovalsService,
  ) {}

  onApplicationBootstrap(): void {
    for (const tool of this.buildTools()) this.registry.register(tool);
  }

  private buildTools(): RuntimeTool[] {
    return [
      // ── READ tools (authority >= 10) ─────────────────────────────────────
      {
        name: 'projects.get_summary',
        capability: 'projects',
        description: 'Get a project summary (status, type, budget, timeline).',
        effect: 'READ',
        requiredAuthority: 10,
        approvalSensitive: false,
        timeoutMs: 4000,
        maxRetries: 2,
        validateInput: (i) => void req(i, 'projectId'),
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const p = await this.projects.findById(req(i, 'projectId'), ctx.tenantId);
          return {
            ok: true,
            data: {
              id: p.id, name: p.name, status: p.status,
              projectTypeId: p.projectTypeId, customerId: p.customerId,
              budgetAmount: p.budgetAmount, targetDate: p.targetDate,
            },
          };
        },
      },
      {
        name: 'customers.get_summary',
        capability: 'customers',
        description: 'Get a customer summary.',
        effect: 'READ',
        requiredAuthority: 10,
        approvalSensitive: false,
        timeoutMs: 4000,
        maxRetries: 2,
        validateInput: (i) => void req(i, 'customerId'),
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const c = await this.customers.findById(req(i, 'customerId'), ctx.tenantId);
          return { ok: true, data: { id: c.id, name: c.name, industry: c.industry, status: c.status } };
        },
      },
      {
        name: 'projects.list_stages',
        capability: 'projects',
        description: 'List a project\'s stages.',
        effect: 'READ',
        requiredAuthority: 10,
        approvalSensitive: false,
        timeoutMs: 4000,
        maxRetries: 2,
        validateInput: (i) => void req(i, 'projectId'),
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const s = await this.stages.list(req(i, 'projectId'), ctx.tenantId);
          return { ok: true, data: { stages: s.map((x) => ({ name: x.name, status: x.status, order: x.order })) } };
        },
      },
      {
        name: 'approvals.list_pending',
        capability: 'approvals',
        description: 'List pending approvals for the tenant.',
        effect: 'READ',
        requiredAuthority: 10,
        approvalSensitive: false,
        timeoutMs: 4000,
        maxRetries: 2,
        validateInput: () => undefined,
        execute: async (_i, ctx): Promise<RuntimeToolResult> => {
          const r = await this.approvals.findAll(ctx.tenantId, { status: 'PENDING' as never, limit: 25 });
          const rows = (r?.data ?? []) as Array<Record<string, unknown>>;
          return { ok: true, data: { pendingCount: r?.total ?? rows.length, pending: rows.map((a) => ({ id: a.id, title: a.title, resourceType: a.resourceType, status: a.status })) } };
        },
      },
      {
        name: 'memory.get_project',
        capability: 'memory',
        description: 'Read organizational (project) memory.',
        effect: 'READ',
        requiredAuthority: 10,
        approvalSensitive: false,
        timeoutMs: 4000,
        maxRetries: 2,
        validateInput: (i) => void req(i, 'projectId'),
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const r = await this.memory.findAll(ctx.tenantId, { projectId: req(i, 'projectId'), limit: 20 } as never);
          return { ok: true, data: { total: r.total, entries: r.data.map((m) => ({ category: m.category, content: m.content })) } };
        },
      },

      // ── CONTROLLED INTERNAL WRITE tools (authority >= 50) ────────────────
      {
        name: 'tasks.create',
        capability: 'orchestration',
        description:
          'Create a task. Accepts title (required), description, projectId, goalId, dueDate, acceptanceCriteria, expectedOutput, requiredRole, requiredCapabilities, and capabilityTags.',
        effect: 'INTERNAL_WRITE',
        requiredAuthority: 50,
        approvalSensitive: false,
        timeoutMs: 6000,
        maxRetries: 1,
        validateInput: (i) => void req(i, 'title'),
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const task = await this.tasks.create(
            {
              title: req(i, 'title'),
              description: (i.description as string) ?? undefined,
              createdById: ctx.actorId,
              projectId: (i.projectId as string) ?? undefined,
              goalId: (i.goalId as string) ?? undefined,
              dueDate: (i.dueDate as string) ?? undefined,
              acceptanceCriteria: (i.acceptanceCriteria as string) ?? undefined,
              expectedOutput:
                (i.expectedOutput as Record<string, unknown>) ?? undefined,
              requiredRole: (i.requiredRole as string) ?? null,
              requiredCapabilities: Array.isArray(i.requiredCapabilities)
                ? (i.requiredCapabilities as string[])
                : [],
              capabilityTags: Array.isArray(i.capabilityTags)
                ? (i.capabilityTags as string[])
                : [],
              input: {
                workRunId: ctx.runId,
                stepId: ctx.stepId,
              },
            },
            ctx.tenantId,
          );
          return { ok: true, data: { taskId: (task as { id: string }).id } };
        },
      },
      {
        name: 'tasks.update_status',
        capability: 'orchestration',
        description: 'Update a task status.',
        effect: 'INTERNAL_WRITE',
        requiredAuthority: 50,
        approvalSensitive: false,
        timeoutMs: 6000,
        maxRetries: 1,
        validateInput: (i) => { req(i, 'taskId'); req(i, 'status'); },
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const t = await this.tasks.updateStatus(req(i, 'taskId'), req(i, 'status') as never, ctx.tenantId);
          return { ok: true, data: { taskId: (t as { id: string }).id, status: (t as { status: string }).status } };
        },
      },
      {
        name: 'memory.add_project',
        capability: 'memory',
        description: 'Add an organizational (project) memory note.',
        effect: 'INTERNAL_WRITE',
        requiredAuthority: 50,
        approvalSensitive: false,
        timeoutMs: 6000,
        maxRetries: 1,
        validateInput: (i) => { req(i, 'projectId'); req(i, 'content'); },
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const m = await this.memory.create(ctx.tenantId, {
            projectId: req(i, 'projectId'),
            content: req(i, 'content'),
            category: (i.category as string) ?? 'NOTE',
            authorType: 'AI',
            authorId: ctx.actorId,
            tenantId: ctx.tenantId,
          } as never);
          return { ok: true, data: { memoryId: (m as { id: string }).id } };
        },
      },

      // ── EXTERNAL / IRREVERSIBLE-SENSITIVE (approval-sensitive) ───────────
      {
        name: 'projects.transition_status',
        capability: 'projects',
        description: 'Transition a project status (irreversible lifecycle move).',
        effect: 'EXTERNAL_WRITE',
        requiredAuthority: 75,
        approvalSensitive: true, // always requires approval by policy
        timeoutMs: 6000,
        maxRetries: 0,
        validateInput: (i) => { req(i, 'projectId'); req(i, 'status'); },
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          const p = await this.projects.transitionStatus(
            req(i, 'projectId'), ctx.tenantId, req(i, 'status') as never,
            (i.reason as string) ?? undefined,
          );
          return { ok: true, data: { projectId: p.id, status: p.status } };
        },
      },
    ];
  }
}
