/**
 * Security Policy Provider
 *
 * SOLID: Single Responsibility — ONLY provides security policies
 * SOLID: Open/Closed — Extend via configuration or database
 * SOLID: Dependency Inversion — Uses interfaces, implementation swappable
 *
 * @module agents/security/providers
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ISecurityPolicyProvider,
  ISecurityPolicy,
} from '../interfaces/security.interfaces';

/**
 * Agent type to policy mapping
 * In production, this would come from database or config service
 */
interface AgentPolicyConfig {
  allowedTools: string[];
  blockedTools: string[];
  allowedPaths: string[];
  blockedPaths: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  maxFileSizeBytes: number;
  promptInjectionDetection: boolean;
  commandValidation: boolean;
  resourceValidation: boolean;
}

/**
 * Agent type configurations
 * Maps agent types to their allowed/blocked tools and resources
 */
const AGENT_POLICY_CONFIGS: Record<
  string,
  Omit<AgentPolicyConfig, 'agentType' | 'tenantId'>
> = {
  /**
   * Finance Analyst Agent - see docs/POLICIES/FINANCE/finance-analyst.md
   */
  'finance-analyst': {
    allowedTools: [
      'budgets.read',
      'budgets.query',
      'budgets.summary',
      'costs.read',
      'costs.query',
      'costs.summarize',
      'inbox.read',
      'inbox.create',
    ],
    blockedTools: [
      'budgets.delete',
      'budgets.update',
      'costs.delete',
      'costs.update',
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'http.request',
    ],
    allowedPaths: ['/workspace/reports', '/workspace/exports'],
    blockedPaths: ['/etc', '/root', '/home', '/var/log'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    promptInjectionDetection: true,
    commandValidation: false,
    resourceValidation: true,
  },

  /**
   * Supply Chain Specialist Agent - see docs/POLICIES/OPERATIONS/supply-chain-specialist.md
   */
  'supply-chain-specialist': {
    allowedTools: [
      'routines.read',
      'routines.query',
      'routines.execute',
      'routines.trigger',
      'events.read',
      'events.query',
      'health.read',
      'health.query',
      'agents.query',
      'inbox.read',
      'inbox.create',
    ],
    blockedTools: [
      'routines.delete',
      'routines.modify',
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'http.request',
      'database.query',
      'database.modify',
    ],
    allowedPaths: ['/workspace/routines', '/workspace/logs'],
    blockedPaths: ['/etc', '/root', '/home', '/var/log', '/proc'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    promptInjectionDetection: true,
    commandValidation: true,
    resourceValidation: true,
  },

  /**
   * Audit & Compliance Officer Agent - see docs/POLICIES/RISK_COMPLIANCE/audit-compliance-officer.md
   */
  'audit-compliance-officer': {
    allowedTools: [
      'events.read',
      'events.query',
      'events.export',
      'users.read',
      'users.query',
      'users.export',
      'tenants.read',
      'tenants.query',
      'health.read',
      'health.full',
      'agents.query',
      'inbox.create',
    ],
    blockedTools: [
      'events.delete',
      'events.modify',
      'users.delete',
      'users.update',
      'users.activate',
      'tenants.update',
      'tenants.delete',
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'http.request',
      'database.query',
      'database.modify',
    ],
    allowedPaths: ['/workspace/audit-reports', '/workspace/exports'],
    blockedPaths: ['/etc', '/root', '/home', '/var/log', '/proc', '/sys'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
    promptInjectionDetection: true,
    commandValidation: false,
    resourceValidation: true,
  },

  /**
   * AI Assistant Agent - used by tenant chat to execute tools on behalf of users
   * (createProject, createTask, listAgents, getTenantSnapshot, etc.).
   * Uses explicit allowlist of safe structured tools. Dangerous operations
   * (shell, file, database, exec) are blocked. Destructive mutations
   * (delete, archive) are also excluded from the allowlist to prevent
   * accidental data loss via LLM misbehavior.
   */
  'ai-assistant': {
    allowedTools: [
      // Project operations (create/list/get only - no update/archive/delete/clone)
      'createProject',
      'getProject',
      'getProjectByName',
      'listProjects',
      'searchProjects',
      'updateProjectStatus',
      'addProjectMember',
      'removeProjectMember',
      'listProjectMembers',
      'listProjectStages',
      'updateProjectStage',
      // Task operations (create/list/get only - no update/delete/clone)
      'createTask',
      'getTask',
      'getMyTasks',
      'getOverdueTasks',
      'listSubtasks',
      'searchTasks',
      'getTaskStats',
      // Task lifecycle mutations are common Hermes requests ("mark the
      // X task complete"); allow them but keep the most-destructive ops
      // (deleteTask, cloneTask) blocked. Hermes-tools F1 routed them
      // through the agent graph with a curated allowlist — security
      // policy must permit the allowlist to actually execute.
      'markTaskComplete',
      'markTaskInProgress',
      'reopenTask',
      'changeTaskPriority',
      'assignTask',
      'unassignTask',
      'addSubtask',
      'updateTask',
      'bulkAssignTasks',
      'bulkChangeStatus',
      // Department operations (read-only)
      'listDepartments',
      'getDepartment',
      'listDepartmentMembers',
      // Agent operations (read-only and state control only)
      'listAgents',
      'getAgent',
      'getAgentWorkload',
      'pauseAgent',
      'resumeAgent',
      'listAgentsByDepartment',
      'searchAgents',
      // Workflows
      'listWorkflows',
      'getWorkflow',
      // Goals
      'listGoals',
      'updateGoalProgress',
      // Budget policies
      'listBudgetPolicies',
      // Tenant and company data
      'getTenantSnapshot',
      'getCompanyProfile',
      'getTenantSettings',
      // Notifications
      'getMyNotifications',
      'markNotificationRead',
      'markAllNotificationsRead',
      // Dashboard and reporting
      'getDashboardSummary',
      'getOverdueTaskReport',
      // Inbox
      'getInboxSummary',
      'listInboxItems',
      'getInboxItem',
      'respondToInboxItem',
      // Approvals (read-only)
      'listPendingApprovals',
      'getApproval',
      'getMyPendingApprovals',
      // Finance (read-only)
      'getCostReport',
      'getCostByDepartment',
      'getCostByAgent',
      'getCostByProject',
      'getTodayCost',
      'setBudgetAlert',
      // Customers (read-only + chat-driven create so "create a new customer"
      // works through Hermes. Archive / unarchive / delete remain
      // blocked — those need explicit human approval, not LLM autonomy.)
      'getCustomer',
      'listCustomers',
      'findCustomerByName',
      'getCustomerProjects',
      'listCustomerContacts',
      'createCustomer',
      // Notifications
      'listAllNotifications',
      // Activity feed
      'getActivityFeed',
      // Approval history (read-only)
      'listMyApprovalHistory',
      // Global search
      'globalSearch',
      // Project memory (allow canonical registry names so LLM tool calls
      // actually resolve. The security policy used to whitelist the old
      // "addProjectMemory" name, but the registry exposes
      // `project_memory_add` etc. — without this fix every chat prompt
      // that needed project memory silently failed with
      // "Tool not permitted by the current execution policy".)
      'addProjectMemory',
      'searchProjectMemory',
      'updateMemoryConfidence',
      'project_memory_add',
      'project_memory_search',
      'project_memory_update_confidence',
      // Google Workspace tools
      'calendar',
      'email',
      'documents',
      'sheets',
      'reports',
      // Phase 9 — Service Gateway. The chat-composer resolves this
      // capability name when CHAT_USE_SERVICE_GATEWAY=true. Without
      // this entry the security interceptor denies every service.gateway
      // call. The gateway itself enforces strict param keys via the
      // per-capability paramsSchema (see ServiceGatewayTool.executeImpl).
      'service-gateway',
    ],
    blockedTools: [
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'file.delete',
      'http.request',
      'database.query',
      'database.modify',
      // Explicitly block all destructive operations
      'deleteProject',
      'archiveProject',
      'cloneProject',
      'updateProject',
      'deleteTask',
      'cloneTask',
      'deleteDepartment',
      'archiveDepartment',
      'updateDepartment',
      'assignManager',
      'unassignManager',
      'archiveAgent',
      'assignAgentToDepartment',
      'removeAgentFromProject',
      'bulkCreateAgents',
      'bulkAssignToDepartment',
      'approveRequest',
      'rejectRequest',
      'bulkApprove',
      'bulkReject',
      'createApprovalRequest',
      'resubmitApproval',
      'cancelApprovalRequest',
      'updateCompanyProfile',
      'updateCustomer',
      'archiveCustomer',
      'unarchiveCustomer',
    ],
    allowedPaths: ['/workspace'],
    blockedPaths: ['/etc', '/root', '/home', '/var', '/proc', '/sys', '/boot'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    promptInjectionDetection: true,
    commandValidation: true,
    resourceValidation: true,
  },

  /**
   * Default agent policy - restrictive baseline
   */
  default: {
    allowedTools: ['health.read', 'health.query'],
    blockedTools: [
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'file.delete',
      'http.request',
      'database.query',
      'database.modify',
      'routines.execute',
      'budgets.update',
      'budgets.delete',
      'users.update',
      'users.delete',
    ],
    allowedPaths: ['/workspace'],
    blockedPaths: ['/etc', '/root', '/home', '/var', '/proc', '/sys', '/boot'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 1 * 1024 * 1024, // 1MB
    promptInjectionDetection: true,
    commandValidation: true,
    resourceValidation: true,
  },
};

const SECURITY_POLICY_VERSION = '1.0.0';

@Injectable()
export class SecurityPolicyProvider implements ISecurityPolicyProvider {
  private readonly logger = new Logger(SecurityPolicyProvider.name);

  /**
   * Get security policy for an agent type and tenant
   */
  getPolicy(
    agentType: string,
    tenantId: string,
  ): Promise<ISecurityPolicy | null> {
    const normalizedAgentType = agentType.toLowerCase().trim();

    const config =
      AGENT_POLICY_CONFIGS[normalizedAgentType] ||
      AGENT_POLICY_CONFIGS['default'];

    const policy: ISecurityPolicy = {
      agentType: normalizedAgentType,
      tenantId,
      policySource: {
        name: 'agents-security-policy',
        policyVersion: SECURITY_POLICY_VERSION,
      },
      ...config,
    };

    this.logger.debug(
      `Security policy retrieved for agent=${normalizedAgentType}, tenant=${tenantId}`,
    );

    return Promise.resolve(policy);
  }

  /**
   * Check if a tool is allowed by the policy
   */
  isToolAllowed(toolName: string, policy: ISecurityPolicy): boolean {
    // Check blocked list first (deny takes precedence)
    if (policy.blockedTools.includes(toolName)) {
      this.logger.debug(`Tool ${toolName} blocked by policy`);
      return false;
    }

    // Check if tool is in allowed list
    if (policy.allowedTools.includes(toolName)) {
      this.logger.debug(`Tool ${toolName} allowed by policy`);
      return true;
    }

    // If allowedTools is '*', allow all non-blocked tools
    if (policy.allowedTools.includes('*')) {
      return true;
    }

    // Default deny
    this.logger.debug(`Tool ${toolName} not in allowed list, denying`);
    return false;
  }

  /**
   * Get the default/fallback security policy
   */
  getDefaultPolicy(): ISecurityPolicy {
    return {
      agentType: 'default',
      tenantId: 'default',
      policySource: {
        name: 'agents-security-policy',
        policyVersion: SECURITY_POLICY_VERSION,
      },
      ...AGENT_POLICY_CONFIGS['default'],
    };
  }

  /**
   * Get available agent types with policies
   */
  getAvailableAgentTypes(): string[] {
    return Object.keys(AGENT_POLICY_CONFIGS);
  }
}
