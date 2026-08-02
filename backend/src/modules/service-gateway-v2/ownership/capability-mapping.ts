import { CAPABILITY_MAP } from '../../chat/responses/maps/capability-map';
import type { IServiceCapability } from '../../chat/responses/interfaces/service-gateway.interface';

const CAPABILITY_TO_OWNERSHIP: Record<string, string> = {
  listProjects: 'projects.list',
  getProject: 'projects.get',
  listCustomers: 'customers.list',
  getCustomer: 'customers.get',
  listGoals: 'goals.list',
  getGoal: 'goals.get',
  listTasks: 'tasks.list',
  getTask: 'tasks.get',
  listDepartments: 'departments.list',
  getDepartment: 'departments.get',
  listAgents: 'agents.list',
  getAgent: 'agents.get',
  listApprovals: 'approvals.list',
  getApproval: 'approvals.get',
  getDashboardSummary: 'projects.dashboardSummary',
  listWorkflows: 'workflows.list',
  getWorkflow: 'workflows.get',
  listDeliverables: 'deliverables.list',
  getDeliverable: 'deliverables.get',
  listAssignments: 'assignments.list',
  listInboxItems: 'inbox.list',
  getInboxItem: 'inbox.get',
  getCostReport: 'costs.report',
  getCostByDepartment: 'costs.byDepartment',
  getCostByAgent: 'costs.byAgent',
  getComplianceStatus: 'compliance.status',
  knowledgeSearch: 'knowledge.search',
  listConnectors: 'connectors.list',
  getConnectorStatus: 'connectors.get',
  listIntegrationCredentials: 'integrations.list',
  getIntegrationStatus: 'integrations.status',
  listWorkRuns: 'workruns.list',
  getWorkRun: 'workruns.get',
  commandCenterSummary: 'commandCenter.summary',
};

export function ownershipIdentifierFor(capability: string): string | undefined {
  return CAPABILITY_TO_OWNERSHIP[capability];
}

export function activeReadCapabilities(): IServiceCapability[] {
  return Object.values(CAPABILITY_MAP);
}
