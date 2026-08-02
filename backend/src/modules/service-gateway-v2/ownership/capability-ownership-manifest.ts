/**
 * Capability Ownership Manifest — Phase 0 Deliverable
 *
 * Machine-readable inventory of all registered capabilities per NC-AWL-IMP-1 §2.
 * Format: identifier, ownerModule, effect, schemaVersion, tenantScope,
 *         responseProjection, deprecationState
 *
 * Generated from: src/modules/
 * Last updated: 2026-08-01
 */

export interface OwnershipEntry {
  identifier: string;
  ownerModule: string;
  effect: 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE' | 'ADVICE';
  schemaVersion: string;
  tenantScope: 'TENANT' | 'GLOBAL';
  responseProjection:
    | 'list'
    | 'detail'
    | 'summary'
    | 'status'
    | 'health'
    | 'history';
  deprecationState: 'ACTIVE' | 'DEPRECATED' | 'REMOVED';
  canonicalService: string;
  notes: string;
}

export const CAPABILITY_OWNERSHIP_MANIFEST: OwnershipEntry[] = [
  // ─── Projects ────────────────────────────────────────────────────────────────
  {
    identifier: 'projects.list',
    ownerModule: 'chat/responses',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'ProjectsService',
    notes: 'List projects with optional filters',
  },
  {
    identifier: 'projects.get',
    ownerModule: 'chat/responses',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'ProjectsService',
    notes: 'Read a single project by ID',
  },
  {
    identifier: 'projects.dashboardSummary',
    ownerModule: 'chat/responses',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'summary',
    deprecationState: 'ACTIVE',
    canonicalService: 'ToolDataAccessService',
    notes: 'Aggregate dashboard summary via ToolDataAccessService',
  },

  // ─── Customers ───────────────────────────────────────────────────────────────
  {
    identifier: 'customers.list',
    ownerModule: 'chat/responses',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'CustomersService',
    notes: 'List customers with optional filters',
  },
  {
    identifier: 'customers.get',
    ownerModule: 'chat/responses',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'CustomersService',
    notes: 'Read a single customer by ID',
  },

  // ─── Goals ───────────────────────────────────────────────────────────────────
  {
    identifier: 'goals.list',
    ownerModule: 'goals',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'GoalsService',
    notes: 'List goals - Phase 1 expansion',
  },
  {
    identifier: 'goals.get',
    ownerModule: 'goals',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'GoalsService',
    notes: 'Read a single goal by ID - Phase 1 expansion',
  },

  // ─── Tasks ───────────────────────────────────────────────────────────────────
  {
    identifier: 'tasks.list',
    ownerModule: 'tasks',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'TasksService',
    notes: 'List tasks - Phase 1 expansion',
  },
  {
    identifier: 'tasks.get',
    ownerModule: 'tasks',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'TasksService',
    notes: 'Read a single task by ID - Phase 1 expansion',
  },

  // ─── Departments ─────────────────────────────────────────────────────────────
  {
    identifier: 'departments.list',
    ownerModule: 'departments',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'DepartmentsService',
    notes: 'List departments - Phase 1 expansion',
  },
  {
    identifier: 'departments.get',
    ownerModule: 'departments',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'DepartmentsService',
    notes: 'Read a single department by ID - Phase 1 expansion',
  },

  // ─── Agents ──────────────────────────────────────────────────────────────────
  {
    identifier: 'agents.list',
    ownerModule: 'agents',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'AgentsService',
    notes: 'List AI agents - Phase 1 expansion',
  },
  {
    identifier: 'agents.get',
    ownerModule: 'agents',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'AgentsService',
    notes: 'Read a single agent by ID - Phase 1 expansion',
  },

  // ─── Approvals ───────────────────────────────────────────────────────────────
  {
    identifier: 'approvals.list',
    ownerModule: 'approvals',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'ApprovalsService',
    notes: 'List pending approvals - Phase 1 expansion',
  },
  {
    identifier: 'approvals.get',
    ownerModule: 'approvals',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'ApprovalsService',
    notes: 'Read a single approval by ID - Phase 1 expansion',
  },

  // ─── Work Runtime ─────────────────────────────────────────────────────────────
  {
    identifier: 'workruns.create',
    ownerModule: 'work-runtime',
    effect: 'INTERNAL_WRITE',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'status',
    deprecationState: 'ACTIVE',
    canonicalService: 'WorkRuntimeService',
    notes: 'Create governed work run - Phase 3',
  },
  {
    identifier: 'workruns.get',
    ownerModule: 'work-runtime',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'status',
    deprecationState: 'ACTIVE',
    canonicalService: 'WorkRuntimeService',
    notes: 'Get work run status - Phase 3',
  },
  {
    identifier: 'workruns.list',
    ownerModule: 'work-runtime',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'WorkRuntimeService',
    notes: 'List work runs - Phase 1D',
  },

  // ─── Workflows (Phase 1B) ────────────────────────────────────────────────────
  {
    identifier: 'workflows.list',
    ownerModule: 'workflows',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'WorkflowsService',
    notes: 'List workflows - Phase 1B',
  },
  {
    identifier: 'workflows.get',
    ownerModule: 'workflows',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'WorkflowsService',
    notes: 'Read a single workflow - Phase 1B',
  },

  // ─── Deliverables (Phase 1B) ─────────────────────────────────────────────────
  {
    identifier: 'deliverables.list',
    ownerModule: 'deliverables',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'DeliverablesService',
    notes: 'List deliverables - Phase 1B',
  },
  {
    identifier: 'deliverables.get',
    ownerModule: 'deliverables',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'DeliverablesService',
    notes: 'Read a single deliverable - Phase 1B',
  },

  // ─── Assignments (Phase 1B) ──────────────────────────────────────────────────
  {
    identifier: 'assignments.list',
    ownerModule: 'assignments',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'AssignmentService',
    notes: 'List eligible agents for assignment - Phase 1B',
  },

  // ─── Inbox (Phase 1B) ────────────────────────────────────────────────────────
  {
    identifier: 'inbox.list',
    ownerModule: 'inbox',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'InboxService',
    notes: 'List inbox items - Phase 1B',
  },
  {
    identifier: 'inbox.get',
    ownerModule: 'inbox',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'InboxService',
    notes: 'Read a single inbox item - Phase 1B',
  },

  // ─── Costs (Phase 1B) ────────────────────────────────────────────────────────
  {
    identifier: 'costs.report',
    ownerModule: 'costs',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'summary',
    deprecationState: 'ACTIVE',
    canonicalService: 'CostsService',
    notes: 'Aggregate tenant cost report - Phase 1B (CONFIDENTIAL)',
  },
  {
    identifier: 'costs.byDepartment',
    ownerModule: 'costs',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'CostsService',
    notes: 'Cost breakdown by department - Phase 1B (CONFIDENTIAL)',
  },
  {
    identifier: 'costs.byAgent',
    ownerModule: 'costs',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'CostsService',
    notes: 'Cost breakdown by agent - Phase 1B (CONFIDENTIAL)',
  },

  // ─── Compliance (Phase 1B) ───────────────────────────────────────────────────
  {
    identifier: 'compliance.status',
    ownerModule: 'compliance',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'IndustryComplianceService',
    notes: 'Compliance checklist status - Phase 1B',
  },

  // ─── Knowledge (Phase 1B) ────────────────────────────────────────────────────
  {
    identifier: 'knowledge.search',
    ownerModule: 'knowledge',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'KnowledgeService',
    notes: 'Search the tenant knowledge base - Phase 1B',
  },

  // ─── Connectors (Phase 1B) ───────────────────────────────────────────────────
  {
    identifier: 'connectors.list',
    ownerModule: 'connectors',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'ConnectorService',
    notes: 'List CRM connectors - Phase 1B',
  },
  {
    identifier: 'connectors.get',
    ownerModule: 'connectors',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'detail',
    deprecationState: 'ACTIVE',
    canonicalService: 'ConnectorService',
    notes: 'Read a single connector - Phase 1B',
  },

  // ─── Integrations (Phase 1B) ─────────────────────────────────────────────────
  {
    identifier: 'integrations.list',
    ownerModule: 'integrations',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'IntegrationsService',
    notes: 'List third-party integrations - Phase 1B',
  },
  {
    identifier: 'integrations.status',
    ownerModule: 'integrations',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'status',
    deprecationState: 'ACTIVE',
    canonicalService: 'IntegrationsService',
    notes: 'Aggregate integration status - Phase 1B',
  },

  // ─── Command Center (Phase 1D) ───────────────────────────────────────────────
  {
    identifier: 'commandCenter.summary',
    ownerModule: 'command-center',
    effect: 'READ',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'summary',
    deprecationState: 'ACTIVE',
    canonicalService: 'CommandCenterService',
    notes: 'Aggregate command-center summary - Phase 1D',
  },

  // ─── Recommendations ─────────────────────────────────────────────────────────
  {
    identifier: 'recommendations.list',
    ownerModule: 'enterprise-cognition',
    effect: 'ADVICE',
    schemaVersion: '1.0',
    tenantScope: 'TENANT',
    responseProjection: 'list',
    deprecationState: 'ACTIVE',
    canonicalService: 'RecommendationEngine',
    notes: 'List recommendations - Phase 5',
  },
];

/**
 * Detect duplicate identifiers in the manifest.
 * Returns array of duplicate identifiers if any.
 */
export function detectDuplicateIdentifiers(): string[] {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];

  for (const entry of CAPABILITY_OWNERSHIP_MANIFEST) {
    const count = seen.get(entry.identifier) ?? 0;
    if (count === 1) {
      duplicates.push(entry.identifier);
    }
    seen.set(entry.identifier, count + 1);
  }

  return duplicates;
}

/**
 * Get all READ capabilities that have write counterparts
 */
export function detectReadWriteDuplicates(): Array<{
  read: string;
  write: string;
}> {
  const readIds = CAPABILITY_OWNERSHIP_MANIFEST.filter(
    (e) => e.effect === 'READ',
  ).map((e) => e.identifier);

  const duplicates: Array<{ read: string; write: string }> = [];

  for (const entry of CAPABILITY_OWNERSHIP_MANIFEST) {
    if (entry.effect !== 'READ') {
      const readVersion = entry.identifier.replace(
        /\.(create|update|delete)$/,
        '.list',
      );
      if (readIds.includes(readVersion)) {
        duplicates.push({ read: readVersion, write: entry.identifier });
      }
    }
  }

  return duplicates;
}
