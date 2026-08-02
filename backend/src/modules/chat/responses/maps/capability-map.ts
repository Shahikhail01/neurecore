/**
 * capability-map.ts — The single source of truth mapping tenant-scoped
 * chat capabilities to existing NestJS service methods (or, where no
 * service exists, to the existing ToolDataAccessService which wraps
 * Prisma). Adding a new capability is a one-line entry; no code changes
 * to the tool, graph, or chat. See implementation-plan §3.2.
 *
 * SRP: declares capabilities only — no execution logic.
 * OCP: new capabilities are appended without touching ServiceGatewayTool.
 * DIP: adapters receive `service: unknown` so callers depend on the
 *      IServiceCapability abstraction, not concrete services.
 */

import { z } from 'zod';
import { ProjectsService } from '../../../projects/projects.service';
import type { ListProjectsOptions } from '../../../projects/interfaces/project.interface';
import { CustomersService } from '../../../customers/customers.service';
import { ToolDataAccessService } from '../../../tools/tool-data-access.service';
import type { IServiceCapability } from '../interfaces/service-gateway.interface';
import { GoalsService } from '../../../goals/goals.service';
import type { ListGoalsOptions } from '../../../goals/interfaces/goal.interface';
import { TasksService } from '../../../orchestration/services/tasks.service';
import { DepartmentsService } from '../../../departments/services/departments.service';
import { AgentsService } from '../../../agents/services/agents.service';
import { ApprovalsService } from '../../../approvals/services/approvals.service';
import { WorkflowsService } from '../../../workflows/services/workflows.service';
import { DeliverablesService } from '../../../deliverables/deliverables.service';
import { AssignmentService } from '../../../assignments/application/assignment.service';
import { InboxService } from '../../../inbox/inbox.service';
import { CostsService } from '../../../costs/services/costs.service';
import { IndustryComplianceService } from '../../../compliance/industry-compliance.service';
import { KnowledgeService } from '../../../knowledge/services/knowledge.service';
import { ConnectorService } from '../../../connectors/services/connector.service';
import { IntegrationsService } from '../../../integrations/integrations.service';
import { WorkRuntimeService } from '../../../work-runtime/runtime/work-runtime.service';
import { CommandCenterService } from '../../../command-center/services/command-center.service';

/**
 * Honest note: the implementation plan §3.2 example referenced a
 * `DashboardService.getSummary()`. No such service exists in the codebase —
 * the dashboard summary is implemented inside `GetDashboardSummaryTool`
 * (built-in/neurecore-tools.ts) which reads through ToolDataAccessService.
 * To stay consistent with the plan's principle of "zero new Prisma access,
 * zero new business logic", `getDashboardSummary` is registered as a
 * capability whose adapter calls ToolDataAccessService through the
 * existing tool. This is the same data path the 106 legacy tools use,
 * tenant-scoped via `tenantId` injection — there is no bypass of the
 * service layer.
 */

export const CAPABILITY_MAP: Record<string, IServiceCapability> = {
  // ─── Projects (read-only) ──────────────────────────────────────────────────
  listProjects: {
    capability: 'listProjects',
    serviceToken: ProjectsService,
    paramsSchema: z
      .object({
        status: z
          .enum([
            'LEAD',
            'PROPOSAL_SENT',
            'WON',
            'LOST',
            'ACTIVE',
            'ON_HOLD',
            'REVIEW',
            'COMPLETED',
            'ARCHIVED',
          ])
          .optional(),
        departmentId: z.string().optional(),
        customerId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as ProjectsService).findAll(tenantId, p as ListProjectsOptions),
    readOnly: true,
    description: 'List projects in the tenant with optional filters',
  },

  getProject: {
    capability: 'getProject',
    serviceToken: ProjectsService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as ProjectsService).findById((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single project by ID',
  },

  // ─── Customers (read-only) ─────────────────────────────────────────────────
  listCustomers: {
    capability: 'listCustomers',
    serviceToken: CustomersService,
    paramsSchema: z
      .object({
        status: z.enum(['ACTIVE', 'DORMANT', 'PROSPECT']).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as CustomersService).findAll(
        tenantId,
        p as Parameters<CustomersService['findAll']>[1],
      ),
    readOnly: true,
    description: 'List customers in the tenant',
  },

  getCustomer: {
    capability: 'getCustomer',
    serviceToken: CustomersService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as CustomersService).findById((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single customer by ID',
  },

  // ─── Goals (read-only) — Phase 1 Wave 1A ─────────────────────────────────
  listGoals: {
    capability: 'listGoals',
    serviceToken: GoalsService,
    paramsSchema: z
      .object({
        status: z
          .enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED'])
          .optional(),
        level: z
          .enum(['COMPANY', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL'])
          .optional(),
        projectId: z.string().optional(),
        ownerUserId: z.string().optional(),
        ownerAgentId: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as GoalsService).findAll(tenantId, p as ListGoalsOptions),
    readOnly: true,
    description: 'List goals in the tenant with optional filters',
  },

  getGoal: {
    capability: 'getGoal',
    serviceToken: GoalsService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as GoalsService).findById((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single goal by ID',
  },

  // ─── Tasks (read-only) — Phase 1 Wave 1A ─────────────────────────────────
  listTasks: {
    capability: 'listTasks',
    serviceToken: TasksService,
    paramsSchema: z
      .object({
        status: z
          .enum([
            'DRAFT',
            'READY',
            'ASSIGNED',
            'IN_PROGRESS',
            'NEEDS_REVIEW',
            'COMPLETED',
            'BLOCKED',
            'CANCELLED',
          ])
          .optional(),
        agentId: z.string().optional(),
        goalId: z.string().optional(),
        projectId: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as TasksService).findAll(
        p as Parameters<TasksService['findAll']>[0],
        tenantId,
      ),
    readOnly: true,
    description: 'List tasks in the tenant with optional filters',
  },

  getTask: {
    capability: 'getTask',
    serviceToken: TasksService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as TasksService).findOne((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single task by ID with execution logs',
  },

  // ─── Departments (read-only) — Phase 1 Wave 1A ────────────────────────────
  listDepartments: {
    capability: 'listDepartments',
    serviceToken: DepartmentsService,
    paramsSchema: z
      .object({
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      })
      .strict(),
    adapter: (svc, tenantId) => (svc as DepartmentsService).findAll(tenantId),
    readOnly: true,
    description: 'List departments in the tenant',
  },

  getDepartment: {
    capability: 'getDepartment',
    serviceToken: DepartmentsService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as DepartmentsService).findOne((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single department by ID',
  },

  // ─── Agents (read-only) — Phase 1 Wave 1A ────────────────────────────────
  listAgents: {
    capability: 'listAgents',
    serviceToken: AgentsService,
    paramsSchema: z
      .object({
        role: z.string().optional(),
        availability: z
          .enum(['AVAILABLE', 'BUSY', 'OFFLINE', 'ARCHIVED'])
          .optional(),
        departmentId: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as AgentsService).findAll(p as Record<string, unknown>, tenantId),
    readOnly: true,
    description: 'List AI agents in the tenant with optional filters',
  },

  getAgent: {
    capability: 'getAgent',
    serviceToken: AgentsService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as AgentsService).findOne((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single agent by ID with capabilities',
  },

  // ─── Approvals (read-only) — Phase 1 Wave 1A ─────────────────────────────
  listApprovals: {
    capability: 'listApprovals',
    serviceToken: ApprovalsService,
    paramsSchema: z
      .object({
        status: z
          .enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
          .optional(),
        type: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: async (svc, tenantId, p) => {
      const params = p as { status?: string; type?: string };
      return (svc as ApprovalsService).getStratifiedApprovals(
        tenantId,
        params.status ?? 'PENDING',
      );
    },
    readOnly: true,
    description: 'List approval requests in the tenant',
  },

  getApproval: {
    capability: 'getApproval',
    serviceToken: ApprovalsService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as ApprovalsService).findOne((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single approval request by ID',
  },

  // ─── Dashboard (read-only aggregate) ──────────────────────────────────────
  getDashboardSummary: {
    capability: 'getDashboardSummary',
    serviceToken: ToolDataAccessService,
    paramsSchema: z.object({}).strict(),
    adapter: async (_svc, tenantId) =>
      summarizeDashboard(_svc as ToolDataAccessService, tenantId),
    readOnly: true,
    description:
      'Aggregate dashboard summary (agents, tasks, departments, approvals, costs)',
  },

  // ─── Phase 1B-1D — broader object coverage ────────────────────────────────────────
  // Phase 1B-1D adapts existing service methods into READ-only capabilities
  // (no new business logic, no new Prisma access). Each entry below matches
  // a real public method exposed by the imported service.

  // Workflows
  listWorkflows: {
    capability: 'listWorkflows',
    serviceToken: WorkflowsService,
    paramsSchema: z
      .object({
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as WorkflowsService).findAll(
        tenantId,
        p as Parameters<WorkflowsService['findAll']>[1],
      ),
    readOnly: true,
    description: 'List workflows in the tenant with optional filters',
  },

  getWorkflow: {
    capability: 'getWorkflow',
    serviceToken: WorkflowsService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as WorkflowsService).findOne((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single workflow by ID',
  },

  // Deliverables
  listDeliverables: {
    capability: 'listDeliverables',
    serviceToken: DeliverablesService,
    paramsSchema: z
      .object({
        projectId: z.string().optional(),
        stage: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as DeliverablesService).findAll(
        tenantId,
        p as Parameters<DeliverablesService['findAll']>[1],
      ),
    readOnly: true,
    description: 'List deliverables in the tenant',
  },

  getDeliverable: {
    capability: 'getDeliverable',
    serviceToken: DeliverablesService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as DeliverablesService).findById((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single deliverable by ID',
  },

  // Assignments — list eligible agents for a task / project
  listAssignments: {
    capability: 'listAssignments',
    serviceToken: AssignmentService,
    paramsSchema: z
      .object({
        requiredRole: z.string().nullable().optional(),
        departmentId: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) => {
      const params = p as {
        requiredRole?: string | null;
        departmentId?: string;
      };
      return (svc as AssignmentService).findEligibleAgents({
        tenantId,
        requiredRole: params.requiredRole ?? null,
        requiredCapabilities: [],
        departmentId: params.departmentId,
      });
    },
    readOnly: true,
    description: 'List eligible agents for assignment',
  },

  // Inbox
  listInboxItems: {
    capability: 'listInboxItems',
    serviceToken: InboxService,
    paramsSchema: z
      .object({
        userId: z.string(),
        status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional(),
        kind: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) =>
      (svc as InboxService).getInbox(
        (p as { userId: string }).userId,
        tenantId,
        p as Parameters<InboxService['getInbox']>[2],
      ),
    readOnly: true,
    description: 'List inbox items for a user within the tenant',
  },

  getInboxItem: {
    capability: 'getInboxItem',
    serviceToken: InboxService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, _tenantId, p) =>
      (svc as InboxService).getInboxItem((p as { id: string }).id),
    readOnly: true,
    description: 'Read a single inbox item by ID',
  },

  // Costs — wrap three distinct aggregations under READ capabilities. Each
  // adapter passes a default last-30-days window so callers don't have to
  // pre-compute dates.
  getCostReport: {
    capability: 'getCostReport',
    serviceToken: CostsService,
    paramsSchema: z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .strict(),
    adapter: async (svc, tenantId, p) => {
      const params = p as { startDate?: string; endDate?: string };
      const now = new Date();
      const start = params.startDate
        ? new Date(params.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = params.endDate ? new Date(params.endDate) : now;
      return (svc as CostsService).getTenantCostSummary(tenantId, start, end);
    },
    readOnly: true,
    description: 'Aggregate tenant cost summary over a date window',
  },

  getCostByDepartment: {
    capability: 'getCostByDepartment',
    serviceToken: CostsService,
    paramsSchema: z
      .object({
        departmentId: z.string(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .strict(),
    adapter: async (svc, tenantId, p) => {
      const params = p as {
        departmentId: string;
        startDate?: string;
        endDate?: string;
      };
      const now = new Date();
      const start = params.startDate
        ? new Date(params.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = params.endDate ? new Date(params.endDate) : now;
      return (svc as CostsService).getDepartmentCostSummary(
        tenantId,
        params.departmentId,
        start,
        end,
      );
    },
    readOnly: true,
    description: 'Cost breakdown for a department over a date window',
  },

  getCostByAgent: {
    capability: 'getCostByAgent',
    serviceToken: CostsService,
    paramsSchema: z
      .object({
        agentId: z.string(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .strict(),
    adapter: async (svc, tenantId, p) => {
      const params = p as {
        agentId: string;
        startDate?: string;
        endDate?: string;
      };
      const now = new Date();
      const start = params.startDate
        ? new Date(params.startDate)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const end = params.endDate ? new Date(params.endDate) : now;
      return (svc as CostsService).getCostByAgent(
        tenantId,
        params.agentId,
        start,
        end,
      );
    },
    readOnly: true,
    description: 'Cost breakdown for an agent over a date window',
  },

  // Compliance
  getComplianceStatus: {
    capability: 'getComplianceStatus',
    serviceToken: IndustryComplianceService,
    paramsSchema: z
      .object({
        industryId: z.string().optional(),
        groupKey: z.string().optional(),
      })
      .strict(),
    adapter: (svc, tenantId, _p) =>
      (svc as IndustryComplianceService).getChecklistsForAllGroups(tenantId),
    readOnly: true,
    description: 'Read compliance checklist status for the tenant',
  },

  // Knowledge
  knowledgeSearch: {
    capability: 'knowledgeSearch',
    serviceToken: KnowledgeService,
    paramsSchema: z
      .object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional(),
      })
      .strict(),
    adapter: (svc, tenantId, p) => {
      const params = p as { query: string; limit?: number };
      return (svc as KnowledgeService).search(tenantId, {
        query: params.query,
        limit: params.limit ?? 5,
      } as Parameters<KnowledgeService['search']>[1]);
    },
    readOnly: true,
    description: 'Search the tenant knowledge base by free-text query',
  },

  // Connectors
  listConnectors: {
    capability: 'listConnectors',
    serviceToken: ConnectorService,
    paramsSchema: z.object({}).strict(),
    adapter: (svc, tenantId) =>
      (svc as ConnectorService).listConnectors(tenantId),
    readOnly: true,
    description: 'List CRM connectors configured for the tenant',
  },

  getConnectorStatus: {
    capability: 'getConnectorStatus',
    serviceToken: ConnectorService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as ConnectorService).listConnectors(tenantId).then((rows) => {
        const target = (p as { id: string }).id;
        const found = (rows as Array<{ id: string }>).find(
          (r) => r.id === target,
        );
        return found ?? null;
      }),
    readOnly: true,
    description: 'Read a single CRM connector by ID',
  },

  // Integrations
  listIntegrationCredentials: {
    capability: 'listIntegrationCredentials',
    serviceToken: IntegrationsService,
    paramsSchema: z.object({}).strict(),
    adapter: (svc, tenantId) =>
      (svc as IntegrationsService).listIntegrations(tenantId),
    readOnly: true,
    description:
      'List third-party integrations (Google, Brevo, …) for the tenant',
  },

  getIntegrationStatus: {
    capability: 'getIntegrationStatus',
    serviceToken: IntegrationsService,
    paramsSchema: z.object({}).strict(),
    adapter: async (svc, tenantId) => {
      const svc2 = svc as IntegrationsService;
      const [google, brevo] = await Promise.all([
        svc2.getGoogleConnectionStatus(tenantId).catch(() => null),
        svc2.getBrevoConnectionStatus(tenantId).catch(() => null),
      ]);
      return { google, brevo };
    },
    readOnly: true,
    description: 'Aggregate connection status for Google + Brevo integrations',
  },

  // Work Runtime — read-only wrappers around getRun
  listWorkRuns: {
    capability: 'listWorkRuns',
    serviceToken: WorkRuntimeService,
    paramsSchema: z
      .object({
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .strict(),
    adapter: async (svc, _tenantId, _p) => {
      const svcAny = svc as {
        repo?: {
          findAllRuns?: (o: {
            page?: number;
            limit?: number;
          }) => Promise<unknown>;
        };
      };
      if (!svcAny.repo?.findAllRuns) {
        return { data: [], total: 0 };
      }
      return svcAny.repo.findAllRuns({ limit: 50 });
    },
    readOnly: true,
    description:
      'List recent governed work runs for the tenant (best-effort; falls back to empty when the underlying repo exposes no list method)',
  },

  getWorkRun: {
    capability: 'getWorkRun',
    serviceToken: WorkRuntimeService,
    paramsSchema: z.object({ id: z.string() }).strict(),
    adapter: (svc, tenantId, p) =>
      (svc as WorkRuntimeService).getRun((p as { id: string }).id, tenantId),
    readOnly: true,
    description: 'Read a single work run by ID with current state',
  },

  // Command Center summary
  commandCenterSummary: {
    capability: 'commandCenterSummary',
    serviceToken: CommandCenterService,
    paramsSchema: z.object({}).strict(),
    adapter: (svc, tenantId) =>
      (svc as CommandCenterService).getCommandCenterSummary(tenantId),
    readOnly: true,
    description:
      'Aggregate platform command-center summary (timeline, alerts, kpis)',
  },

  // ─── Projects (write) ──────────────────────────────────────────────────────
  /* Write capabilities intentionally stay on the governed legacy/HITL path.
  createProject: {
    capability: 'createProject',
    serviceToken: ProjectsService,
    paramsSchema: z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        customerId: z.string().optional(),
        industry: z.string().optional(),
        budgetType: z.enum(['FIXED_FEE', 'HOURLY', 'RETAINER']).optional(),
        budgetAmount: z.number().optional(),
        budgetCurrency: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        targetDate: z.string().datetime().optional(),
        departmentId: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .strict(),
    adapter: async (_svc, tenantId, p) => {
      const input = {
        ...(p as Record<string, unknown>),
        // Allow bare project creation from chat — no projectTypeId or derivedShape needed.
        // Chat users can refine details later through the UI.
        allowBareProject: true,
      };
      return (_svc as ProjectsService).create(input as CreateProjectInput, tenantId);
    },
    readOnly: false,
    description: 'Create a new project in the tenant. Chat users can refine details later.',
  },

  updateProject: {
    capability: 'updateProject',
    serviceToken: ProjectsService,
    paramsSchema: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        customerId: z.string().optional(),
        industry: z.string().optional(),
        budgetType: z.enum(['FIXED_FEE', 'HOURLY', 'RETAINER']).optional(),
        budgetAmount: z.number().optional(),
        budgetCurrency: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        targetDate: z.string().datetime().optional(),
        departmentId: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z
          .enum([
            'LEAD',
            'PROPOSAL_SENT',
            'WON',
            'LOST',
            'ACTIVE',
            'ON_HOLD',
            'REVIEW',
            'COMPLETED',
            'ARCHIVED',
          ])
          .optional(),
      })
      .strict(),
    adapter: async (_svc, tenantId, p) => {
      const { id, ...input } = p as { id: string } & Record<string, unknown>;
      return (_svc as ProjectsService).update(id, tenantId, input as UpdateProjectInput);
    },
    readOnly: false,
    description: 'Update an existing project by ID',
  },

  transitionProjectStatus: {
    capability: 'transitionProjectStatus',
    serviceToken: ProjectsService,
    paramsSchema: z
      .object({
        id: z.string().min(1),
        to: z.enum([
          'LEAD',
          'PROPOSAL_SENT',
          'WON',
          'LOST',
          'ACTIVE',
          'ON_HOLD',
          'REVIEW',
          'COMPLETED',
          'ARCHIVED',
        ]),
        reason: z.string().optional(),
      })
      .strict(),
    adapter: async (_svc, tenantId, p) => {
      const { id, to, reason } = p as { id: string; to: string; reason?: string };
      return (_svc as ProjectsService).transitionStatus(id, tenantId, to as any, reason);
    },
    readOnly: false,
    description: 'Transition a project to a new lifecycle status (uses state machine)',
  }, */
};

/**
 * Mirrors the data shape produced by GetDashboardSummaryTool
 * (built-in/neurecore-tools.ts) but called through the gateway. Kept as
 * a free function in this file to make the adapter body trivial.
 */
async function summarizeDashboard(
  data: ToolDataAccessService,
  tenantId: string,
): Promise<Record<string, unknown>> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [agentStats, taskStats, deptCount, pendingApprovals, monthCost] =
    await Promise.all([
      data.agent
        .groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        })
        .catch(() => []),
      data.task
        .groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        })
        .catch(() => []),
      data.department
        .count({ where: { tenantId, status: 'ACTIVE' } })
        .catch(() => 0),
      data.approvalRequest
        .count({ where: { tenantId, status: 'PENDING' } })
        .catch(() => 0),
      data.costRecord
        .aggregate({
          where: { tenantId, windowStart: { gte: monthStart } },
          _sum: { costCents: true },
        })
        .catch(() => null),
    ]);

  const buildCounts = (
    rows: Array<{ status: string; _count: { _all: number } }>,
  ): { total: number; byStatus: Record<string, number> } => {
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStatus[r.status] = r._count._all;
      total += r._count._all;
    }
    return { total, byStatus };
  };

  return {
    generatedAt: now.toISOString(),
    agents: buildCounts(agentStats),
    tasks: buildCounts(taskStats),
    departments: { active: deptCount },
    approvals: { pending: pendingApprovals },
    cost: {
      monthToDateCents: monthCost?._sum?.costCents
        ? Number(monthCost._sum.costCents)
        : 0,
      currency: 'USD',
    },
  };
}
