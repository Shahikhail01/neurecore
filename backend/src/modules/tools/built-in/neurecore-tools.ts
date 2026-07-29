/**
 * NeureCore Agent Tools — P1 Expansion
 *
 * 66 tools across: Department, Agent, Project, Task, Approval,
 * Budget, Company, Roles, Notifications, Reporting, Inbox.
 *
 * Pattern: @Injectable() extending BaseStructuredTool with Zod input schema.
 */

import { Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { ToolDataAccessService } from '../tool-data-access.service';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';
import { ProjectsService } from '../../projects/projects.service';
import { TasksService } from '../../orchestration/services/tasks.service';
import { AgentsService } from '../../agents/services/agents.service';
import { ProjectShapeSynthesisService } from '../../project-shape/project-shape-synthesis.service';
import { CustomersService } from '../../customers/customers.service';
import { ApprovalsService } from '../../approvals/services/approvals.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { TenantsService } from '../../tenants/tenants.service';
import { GovernanceRulesService } from '../../governance/services/governance-rules.service';
import { DepartmentsService } from '../../departments/services/departments.service';
import { ProjectMembersService } from '../../project-members/project-members.service';
import { ProjectStagesService } from '../../project-stages/project-stages.service';
import { GoalsService } from '../../goals/goals.service';

// ─── Enums (matching Prisma schema) ────────────────────────────────────────

const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const TaskStatusEnum = z.enum(['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);
const AgentStatusEnum = z.enum(['IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'TERMINATED', 'ARCHIVED', 'DEPRECATED']);
const DepartmentStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
const ProjectStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']);
const ApprovalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
const ApprovalPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

// ─── P0 Schemas (corrected URGENT → CRITICAL) ───────────────────────────

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1).describe('Task title (required)'),
  description: z.string().optional().describe('Task description'),
  departmentId: z.string().optional().describe('Department ID'),
  agentId: z.string().optional().describe('Agent ID to assign'),
  priority: TaskPriorityEnum.default('MEDIUM').optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).describe('Project name (required)'),
  description: z.string().optional().describe('Project description'),
  departmentId: z.string().optional().describe('Department ID to assign the project to'),
  customerId: z.string().optional().describe('Customer ID for the project'),
  projectTypeId: z.string().optional().describe('ProjectType ID — when set, the template-driven pipeline runs (goalTemplate, roleTemplate). When absent, the Hermes-driven synthesis path runs instead.'),
  projectTypeVersion: z.number().int().positive().optional().describe('Specific ProjectTypeVersion (defaults to current)'),
  // LLMs sometimes send "fixed" or "fixed_fee" instead of "FIXED_FEE" — accept either.
  budgetType: z
    .union([
      z.enum(['FIXED_FEE', 'HOURLY', 'RETAINER']),
      z
        .enum(['fixed', 'hourly', 'retainer', 'fixed_fee', 'fixed-fee'])
        .transform((v): 'FIXED_FEE' | 'HOURLY' | 'RETAINER' => {
          if (v === 'fixed' || v === 'fixed_fee' || v === 'fixed-fee') return 'FIXED_FEE';
          if (v === 'hourly') return 'HOURLY';
          return 'RETAINER';
        }),
    ])
    .optional()
    .describe('Budget type. Accepts FIXED_FEE/HOURLY/RETAINER or lowercase variants (fixed, fixed_fee, fixed-fee).'),
  // Accept numeric strings (LLM often sends "40000" as a string).
  budgetAmount: z.coerce.number().positive().optional().describe('Budget amount'),
  budgetCurrency: z.string().length(3).optional().describe('Budget currency (ISO 4217, defaults to USD)'),
  // Same trick as budgetType for LLMs that send lowercase priorities.
  priority: z
    .union([
      z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      z.enum(['low', 'medium', 'high', 'urgent']).transform((v) => v.toUpperCase() as never),
    ])
    .optional()
    .describe('Project priority. Accepts LOW/MEDIUM/HIGH/URGENT or lowercase variants.'),
  targetDate: z.string().optional().describe('Target date (ISO 8601)'),
  // Hermes-driven synthesis (NEW 2026-07-19)
  // LLMs sometimes send "true"/"false" as strings — accept either.
  useAiSynthesis: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .default(true)
    .describe('When true (default) and projectTypeId is absent, Hermes synthesizes the project shape (stages, goals, members, CoS) from the user goal via the LLM.'),
  industryHint: z.string().max(80).optional().describe('Optional industry hint to guide Hermes — e.g. "audit", "construction", "marketing campaign".'),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const ListDepartmentsInputSchema = z.object({
  status: DepartmentStatusEnum.default('ACTIVE').optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListDepartmentsInput = z.infer<typeof ListDepartmentsInputSchema>;

export const ListAgentsInputSchema = z.object({
  departmentId: z.string().optional(),
  status: AgentStatusEnum.optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListAgentsInput = z.infer<typeof ListAgentsInputSchema>;

export const PauseAgentInputSchema = z.object({ agentId: z.string() });
export type PauseAgentInput = z.infer<typeof PauseAgentInputSchema>;

export const ResumeAgentInputSchema = z.object({ agentId: z.string() });
export type ResumeAgentInput = z.infer<typeof ResumeAgentInputSchema>;

export const ListTasksInputSchema = z.object({
  status: TaskStatusEnum.optional(),
  agentId: z.string().optional(),
  departmentId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

export const GetTenantSnapshotInputSchema = z.object({});
export type GetTenantSnapshotInput = z.infer<typeof GetTenantSnapshotInputSchema>;

// ─── P1: Department Schemas ─────────────────────────────────────────────

export const UpdateDepartmentInputSchema = z.object({
  departmentId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentInputSchema>;

export const ArchiveDepartmentInputSchema = z.object({ departmentId: z.string() });
export type ArchiveDepartmentInput = z.infer<typeof ArchiveDepartmentInputSchema>;

export const DeleteDepartmentInputSchema = z.object({ departmentId: z.string() });
export type DeleteDepartmentInput = z.infer<typeof DeleteDepartmentInputSchema>;

export const AssignManagerInputSchema = z.object({
  departmentId: z.string(),
  agentId: z.string(),
});
export type AssignManagerInput = z.infer<typeof AssignManagerInputSchema>;

export const UnassignManagerInputSchema = z.object({ departmentId: z.string() });
export type UnassignManagerInput = z.infer<typeof UnassignManagerInputSchema>;

// ─── P1: Agent Schemas ────────────────────────────────────────────────────

export const GetAgentInputSchema = z.object({ agentId: z.string() });
export type GetAgentInput = z.infer<typeof GetAgentInputSchema>;

export const UpdateAgentInputSchema = z.object({
  agentId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: AgentStatusEnum.optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentInputSchema>;

export const ArchiveAgentInputSchema = z.object({ agentId: z.string() });
export type ArchiveAgentInput = z.infer<typeof ArchiveAgentInputSchema>;

export const AssignAgentToDepartmentInputSchema = z.object({
  agentId: z.string(),
  departmentId: z.string(),
});
export type AssignAgentToDepartmentInput = z.infer<typeof AssignAgentToDepartmentInputSchema>;

export const RemoveAgentFromProjectInputSchema = z.object({
  agentId: z.string(),
  projectId: z.string(),
});
export type RemoveAgentFromProjectInput = z.infer<typeof RemoveAgentFromProjectInputSchema>;

export const BulkCreateAgentsInputSchema = z.object({
  agents: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['CORE', 'FUNCTIONAL', 'EXECUTIVE', 'META']).default('FUNCTIONAL'),
    model: z.string().optional(),
    departmentId: z.string().optional(),
    description: z.string().optional(),
  })).min(1).max(50),
});
export type BulkCreateAgentsInput = z.infer<typeof BulkCreateAgentsInputSchema>;

export const BulkAssignToDepartmentInputSchema = z.object({
  agentIds: z.array(z.string()).min(1).max(100),
  departmentId: z.string(),
});
export type BulkAssignToDepartmentInput = z.infer<typeof BulkAssignToDepartmentInputSchema>;

export const GetAgentWorkloadInputSchema = z.object({ agentId: z.string() });
export type GetAgentWorkloadInput = z.infer<typeof GetAgentWorkloadInputSchema>;

// ─── P1: Project Schemas ──────────────────────────────────────────────────

export const GetProjectInputSchema = z.object({ projectId: z.string() });
export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;

export const UpdateProjectInputSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: ProjectStatusEnum.optional(),
  targetDate: z.string().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export const ArchiveProjectInputSchema = z.object({ projectId: z.string() });
export type ArchiveProjectInput = z.infer<typeof ArchiveProjectInputSchema>;

export const DeleteProjectInputSchema = z.object({ projectId: z.string() });
export type DeleteProjectInput = z.infer<typeof DeleteProjectInputSchema>;

export const CloneProjectInputSchema = z.object({
  projectId: z.string(),
  newName: z.string().min(1),
  includeTasks: z.boolean().default(false).optional(),
});
export type CloneProjectInput = z.infer<typeof CloneProjectInputSchema>;

// ─── P1: Task Schemas ─────────────────────────────────────────────────────

export const GetTaskInputSchema = z.object({ taskId: z.string() });
export type GetTaskInput = z.infer<typeof GetTaskInputSchema>;

export const UpdateTaskInputSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: TaskPriorityEnum.optional(),
  status: TaskStatusEnum.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const DeleteTaskInputSchema = z.object({ taskId: z.string() });
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

export const AssignTaskInputSchema = z.object({ taskId: z.string(), agentId: z.string() });
export type AssignTaskInput = z.infer<typeof AssignTaskInputSchema>;

export const UnassignTaskInputSchema = z.object({ taskId: z.string() });
export type UnassignTaskInput = z.infer<typeof UnassignTaskInputSchema>;

export const MarkTaskCompleteInputSchema = z.object({ taskId: z.string() });
export type MarkTaskCompleteInput = z.infer<typeof MarkTaskCompleteInputSchema>;

export const MarkTaskInProgressInputSchema = z.object({ taskId: z.string() });
export type MarkTaskInProgressInput = z.infer<typeof MarkTaskInProgressInputSchema>;

export const ReopenTaskInputSchema = z.object({ taskId: z.string() });
export type ReopenTaskInput = z.infer<typeof ReopenTaskInputSchema>;

export const ChangeTaskPriorityInputSchema = z.object({
  taskId: z.string(),
  priority: TaskPriorityEnum,
});
export type ChangeTaskPriorityInput = z.infer<typeof ChangeTaskPriorityInputSchema>;

export const AddSubtaskInputSchema = z.object({
  parentTaskId: z.string(),
  title: z.string().min(1),
  priority: TaskPriorityEnum.default('MEDIUM').optional(),
  agentId: z.string().optional(),
});
export type AddSubtaskInput = z.infer<typeof AddSubtaskInputSchema>;

export const ListSubtasksInputSchema = z.object({ parentTaskId: z.string() });
export type ListSubtasksInput = z.infer<typeof ListSubtasksInputSchema>;

export const GetMyTasksInputSchema = z.object({
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type GetMyTasksInput = z.infer<typeof GetMyTasksInputSchema>;

export const GetOverdueTasksInputSchema = z.object({
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type GetOverdueTasksInput = z.infer<typeof GetOverdueTasksInputSchema>;

export const BulkAssignTasksInputSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  agentId: z.string(),
});
export type BulkAssignTasksInput = z.infer<typeof BulkAssignTasksInputSchema>;

export const BulkChangeStatusInputSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  status: TaskStatusEnum,
});
export type BulkChangeStatusInput = z.infer<typeof BulkChangeStatusInputSchema>;

export const CloneTaskInputSchema = z.object({
  taskId: z.string(),
  newAssigneeId: z.string().optional(),
});
export type CloneTaskInput = z.infer<typeof CloneTaskInputSchema>;

// ─── P1: Approval Schemas ────────────────────────────────────────────────

export const ListPendingApprovalsInputSchema = z.object({
  departmentId: z.string().optional(),
  priority: ApprovalPriorityEnum.optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListPendingApprovalsInput = z.infer<typeof ListPendingApprovalsInputSchema>;

export const GetApprovalInputSchema = z.object({ approvalId: z.string() });
export type GetApprovalInput = z.infer<typeof GetApprovalInputSchema>;

export const ApproveRequestInputSchema = z.object({
  approvalId: z.string(),
  comment: z.string().optional(),
});
export type ApproveRequestInput = z.infer<typeof ApproveRequestInputSchema>;

export const RejectRequestInputSchema = z.object({
  approvalId: z.string(),
  reason: z.string().min(1),
});
export type RejectRequestInput = z.infer<typeof RejectRequestInputSchema>;

export const BulkApproveInputSchema = z.object({
  approvalIds: z.array(z.string()).min(1).max(50),
  comment: z.string().optional(),
});
export type BulkApproveInput = z.infer<typeof BulkApproveInputSchema>;

export const BulkRejectInputSchema = z.object({
  approvalIds: z.array(z.string()).min(1).max(50),
  reason: z.string().min(1),
});
export type BulkRejectInput = z.infer<typeof BulkRejectInputSchema>;

export const CreateApprovalRequestInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
  priority: ApprovalPriorityEnum.default('MEDIUM').optional(),
});
export type CreateApprovalRequestInput = z.infer<typeof CreateApprovalRequestInputSchema>;

export const GetMyPendingApprovalsInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type GetMyPendingApprovalsInput = z.infer<typeof GetMyPendingApprovalsInputSchema>;

export const ResubmitApprovalInputSchema = z.object({ approvalId: z.string() });
export type ResubmitApprovalInput = z.infer<typeof ResubmitApprovalInputSchema>;

export const CancelApprovalRequestInputSchema = z.object({ approvalId: z.string() });
export type CancelApprovalRequestInput = z.infer<typeof CancelApprovalRequestInputSchema>;

// ─── P1: Budget/Cost Schemas ───────────────────────────────────────────────

export const GetCostReportInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day').optional(),
});
export type GetCostReportInput = z.infer<typeof GetCostReportInputSchema>;

export const GetCostByDepartmentInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type GetCostByDepartmentInput = z.infer<typeof GetCostByDepartmentInputSchema>;

export const GetCostByAgentInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type GetCostByAgentInput = z.infer<typeof GetCostByAgentInputSchema>;

export const GetCostByProjectInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type GetCostByProjectInput = z.infer<typeof GetCostByProjectInputSchema>;

export const SetBudgetAlertInputSchema = z.object({
  departmentId: z.string().optional(),
  thresholdPercent: z.number().min(1).max(100),
  email: z.string().email().optional(),
});
export type SetBudgetAlertInput = z.infer<typeof SetBudgetAlertInputSchema>;

export const GetTodayCostInputSchema = z.object({});
export type GetTodayCostInput = z.infer<typeof GetTodayCostInputSchema>;

// ─── P1: Company Settings Schemas ─────────────────────────────────────────

export const GetCompanyProfileInputSchema = z.object({});
export type GetCompanyProfileInput = z.infer<typeof GetCompanyProfileInputSchema>;

export const UpdateCompanyProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
});
export type UpdateCompanyProfileInput = z.infer<typeof UpdateCompanyProfileInputSchema>;

export const GetTenantSettingsInputSchema = z.object({});
export type GetTenantSettingsInput = z.infer<typeof GetTenantSettingsInputSchema>;

// ─── P1: Notification Schemas ─────────────────────────────────────────────

export const GetMyNotificationsInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(20).optional(),
  isRead: z.boolean().optional(),
});
export type GetMyNotificationsInput = z.infer<typeof GetMyNotificationsInputSchema>;

export const MarkNotificationReadInputSchema = z.object({ notificationId: z.string() });
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadInputSchema>;

export const MarkAllNotificationsReadInputSchema = z.object({});
export type MarkAllNotificationsReadInput = z.infer<typeof MarkAllNotificationsReadInputSchema>;

// ─── P1: Reporting Schemas ────────────────────────────────────────────────

export const GetDashboardSummaryInputSchema = z.object({});
export type GetDashboardSummaryInput = z.infer<typeof GetDashboardSummaryInputSchema>;

export const GetOverdueTaskReportInputSchema = z.object({
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50).optional(),
});
export type GetOverdueTaskReportInput = z.infer<typeof GetOverdueTaskReportInputSchema>;

// ─── P1: Inbox Schemas ────────────────────────────────────────────────────

export const GetInboxSummaryInputSchema = z.object({});
export type GetInboxSummaryInput = z.infer<typeof GetInboxSummaryInputSchema>;

export const ListInboxItemsInputSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListInboxItemsInput = z.infer<typeof ListInboxItemsInputSchema>;

export const GetInboxItemInputSchema = z.object({ itemId: z.string() });
export type GetInboxItemInput = z.infer<typeof GetInboxItemInputSchema>;

export const RespondToInboxItemInputSchema = z.object({
  itemId: z.string(),
  action: z.enum(['approve', 'reject', 'comment']),
  comment: z.string().optional(),
});

// ─── Phase 3D: Project Memory Schemas ──────────────────────────────────────────

// Memory category — accepts case-insensitive input (LLMs typically
// send lowercase like "note", but the Prisma enum is uppercase). We
// use a string + refine so the value is preserved for uppercase
// transformation instead of being rejected by the strict ZodEnum.
const MemoryCategoryEnum = z
  .string()
  .refine(
    (v) =>
      ['NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON'].includes(
        v.toUpperCase(),
      ),
    {
      message:
        'Invalid memory category. Expected one of NOTE, INSIGHT, CONSTRAINT, RISK, OPPORTUNITY, LESSON (case-insensitive).',
    },
  )
  .transform((v) => v.toUpperCase() as 'NOTE' | 'INSIGHT' | 'CONSTRAINT' | 'RISK' | 'OPPORTUNITY' | 'LESSON');

export const AddProjectMemoryInputSchema = z.object({
  projectId: z.string().describe('Project ID'),
  category: MemoryCategoryEnum.describe('Memory category'),
  content: z.string().min(1).describe('Memory content text'),
  authorType: z.enum(['HUMAN', 'AI', 'SYSTEM']).default('AI').optional(),
  isPinned: z.boolean().default(false).optional(),
  confidence: z.number().int().min(0).max(100).default(80).describe('Confidence score 0-100'),
});
export type AddProjectMemoryInput = z.infer<typeof AddProjectMemoryInputSchema>;

export const SearchProjectMemoryInputSchema = z.object({
  projectId: z.string().describe('Project ID'),
  query: z.string().min(1).describe('Search query string'),
  category: MemoryCategoryEnum.optional(),
  limit: z.number().int().positive().max(50).default(10).optional(),
});
export type SearchProjectMemoryInput = z.infer<typeof SearchProjectMemoryInputSchema>;

export const UpdateMemoryConfidenceInputSchema = z.object({
  memoryId: z.string().describe('Memory entry ID'),
  confidence: z.number().int().min(0).max(100).describe('New confidence score 0-100'),
  supersededById: z.string().optional().describe('Optional ID of the entry that supersedes this one'),
});
export type UpdateMemoryConfidenceInput = z.infer<typeof UpdateMemoryConfidenceInputSchema>;
export type RespondToInboxItemInput = z.infer<typeof RespondToInboxItemInputSchema>;

// ─── Customer Schemas ───────────────────────────────────────────────────────

export const CreateCustomerInputSchema = z.object({
  name: z.string().min(1).max(200).describe('Customer / company name (required)'),
  industry: z.string().max(120).optional().describe('Industry vertical (e.g. "Healthcare", "Construction"). Defaults to the tenant.industry when omitted.'),
  primaryEmail: z.string().email().optional().describe('Primary contact email for the customer'),
  primaryPhone: z.string().max(40).optional().describe('Primary contact phone'),
  billingInfo: z.record(z.string(), z.unknown()).optional().describe('Free-form billing details (address, tax id, PO number, etc.)'),
  tags: z.array(z.string().min(1).max(40)).max(50).optional().describe('Tags to categorise the customer (e.g. ["vip", "net30"])'),
  // Phase 4 — F&C fields. Empty strings are coerced to undefined inside
  // executeImpl so chat-driven calls that haven't normalised their inputs
  // don't fail the BE validator.
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED']).optional().describe('KYC status (F&C tenants only)'),
  riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('AML / credit risk rating (F&C tenants only)'),
  taxId: z.string().max(64).optional().describe('Tax ID / EIN (F&C tenants only)'),
  financialSubType: z.enum(['BANKING', 'INSURANCE', 'WEALTH_MANAGEMENT', 'INVESTMENT', 'FINTECH', 'ACCOUNTING_AUDIT']).optional().describe('Financial sub-type discriminator (F&C tenants only)'),
  lifecycleStage: z.enum(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED']).optional().describe('Lifecycle stage (F&C tenants only)'),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = z.object({
  customerId: z.string().describe('Customer ID (required)'),
  name: z.string().min(1).max(200).optional().describe('Updated customer name'),
  industry: z.string().max(120).optional().describe('Updated industry'),
  primaryEmail: z.string().email().optional().describe('Updated primary email'),
  primaryPhone: z.string().max(40).optional().describe('Updated primary phone'),
  billingInfo: z.record(z.string(), z.unknown()).optional().describe('Updated billing details (replaces existing)'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().describe('Updated status'),
  tags: z.array(z.string().min(1).max(40)).max(50).optional().describe('Updated tags (replaces existing)'),
  // Phase 4 — F&C fields (same shape as CreateCustomerInputSchema).
  kycStatus: z.enum(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED']).optional().describe('Updated KYC status (F&C tenants only)'),
  riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('Updated AML / credit risk rating (F&C tenants only)'),
  taxId: z.string().max(64).optional().describe('Updated Tax ID / EIN (F&C tenants only)'),
  financialSubType: z.enum(['BANKING', 'INSURANCE', 'WEALTH_MANAGEMENT', 'INVESTMENT', 'FINTECH', 'ACCOUNTING_AUDIT']).optional().describe('Updated financial sub-type (F&C tenants only)'),
  lifecycleStage: z.enum(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED']).optional().describe('Updated lifecycle stage (F&C tenants only)'),
});
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>;

export const GetCustomerInputSchema = z.object({
  customerId: z.string().describe('Customer ID'),
});
export type GetCustomerInput = z.infer<typeof GetCustomerInputSchema>;

export const ListCustomersInputSchema = z.object({
  search: z.string().max(200).optional().describe('Free-text search across customer name / industry / email'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().describe('Filter by status (default: ACTIVE)'),
  limit: z.number().int().positive().max(100).default(20).optional().describe('Max results to return'),
  page: z.number().int().positive().default(1).optional().describe('Page number (1-based)'),
  sortKey: z.enum(['name', 'industry', 'status', 'createdAt', 'updatedAt']).default('name').optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc').optional(),
});
export type ListCustomersInput = z.infer<typeof ListCustomersInputSchema>;

export const ArchiveCustomerInputSchema = z.object({
  customerId: z.string().describe('Customer ID to archive'),
});
export type ArchiveCustomerInput = z.infer<typeof ArchiveCustomerInputSchema>;

export const UnarchiveCustomerInputSchema = z.object({
  customerId: z.string().describe('Customer ID to unarchive (restore to ACTIVE)'),
});
export type UnarchiveCustomerInput = z.infer<typeof UnarchiveCustomerInputSchema>;

export const FindCustomerByNameInputSchema = z.object({
  name: z.string().min(1).max(200).describe('Customer name to look up (exact, case-insensitive match preferred)'),
});
export type FindCustomerByNameInput = z.infer<typeof FindCustomerByNameInputSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// P0 TOOL IMPLEMENTATIONS (corrected URGENT → CRITICAL)
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class CreateTaskTool extends BaseStructuredTool {
  readonly name = 'createTask';
  readonly description =
    'Create a new task. Routes through TasksService so default workflows, audit events, and member links fire. Pass projectId when the task belongs to a project (the task will be linked).';
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateTaskInputSchema;
  readonly requiredPermissions = ['task:create'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) {
    super();
  }

  protected async executeImpl(input: CreateTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    // Use actorId (real user) for createdById; SYSTEM is a placeholder that
    // won't satisfy the FK constraint. In chat-driven create, the JWT user
    // is the actor. Fall back to null only if there's no user.
    const actorUserId =
      context?.userId && context.userId !== 'SYSTEM' ? context.userId : null;
    try {
      if (this.tasksService) {
        const task = await this.tasksService.create(
          {
            title: input.title,
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.priority ? { priority: input.priority as never } : {}),
            ...(actorUserId ? { createdById: actorUserId } : { createdById: null }),
            ...(input.agentId ? { agentId: input.agentId } : {}),
          },
          context.tenantId as string,
        );
        return {
          success: true,
          data: {
            taskId: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            createdAt: task.createdAt.toISOString(),
          },
          metadata: { model: 'neurecore-task-v1' },
        };
      }
      return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create task' };
    }
  }
}

@Injectable()
export class CreateProjectTool extends BaseStructuredTool implements OnModuleInit {
  readonly name = 'createProject';
  readonly description =
    "Create a new project. Two paths: (1) Template-driven — pass projectTypeId for compliance-heavy industries (e.g. 'Tax Audit'). (2) Hermes-driven (default) — when projectTypeId is absent, Hermes synthesizes the project shape (stages, goals, members, CoS) from the user's goal via LLM reasoning. Routes through ProjectsService.create() so goals, AI employees, Chief of Staff, project memory, and stages are auto-seeded.";
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateProjectInputSchema;
  readonly requiredPermissions = ['project:create'];

  // Lazy-resolved via ModuleRef (avoids the same circular-dep class we hit
  // with ProjectAutomationModule). See ProjectsService.onModuleInit for the
  // proven pattern. logger comes from BaseStructuredTool (protected readonly).
  private synthesisService: ProjectShapeSynthesisService | undefined;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
    private readonly moduleRef?: ModuleRef,
  ) {
    super();
  }

  onModuleInit(): void {
    try {
      this.synthesisService = this.moduleRef?.get(ProjectShapeSynthesisService, {
        strict: false,
      });
      this.logger.log(
        `CreateProjectTool resolved: synthesisService=${this.synthesisService ? 'yes' : 'no'}, projectsService=${this.projectsService ? 'yes' : 'no'}`,
      );
    } catch (err) {
      this.logger.warn(
        `CreateProjectTool.onModuleInit: lazy resolution failed (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  protected async executeImpl(input: CreateProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };

    this.logger.debug(
      `[DEBUG-TOOL-CREATE] executeImpl ENTER: name=${input.name}, projectTypeId=${input.projectTypeId ?? 'none'}, useAiSynthesis=${input.useAiSynthesis}, synthesisService=${this.synthesisService ? 'available' : 'NOT_AVAILABLE'}, projectsService=${this.projectsService ? 'available' : 'NOT_AVAILABLE'}`,
    );

    const targetDate = input.targetDate ? new Date(input.targetDate) : null;

    // ─── Hermes-driven synthesis path (default when projectTypeId absent) ───
    //
    // The user's raw goal is passed via context.metadata.goal (set by the
    // LangGraph toolNode at langgraph-official.ts). When the LLM didn't
    // supply projectTypeId — meaning the user didn't say "use the X template"
    // — we ask ProjectShapeSynthesisService to derive a ProjectShape from
    // the goal. The derived shape then flows into ProjectsService.create().
    //
    // If useAiSynthesis is explicitly false and no projectTypeId is given,
    // ProjectsService.create() will throw "Either projectTypeId or derivedShape
    // is required" — handled downstream.
    let derivedShape: unknown | undefined;
    let synthesisNote: string | undefined;
    if (!input.projectTypeId && input.useAiSynthesis !== false) {
      const userGoal = (context.metadata?.goal as string | undefined) ?? input.name;
      if (this.synthesisService) {
        // INDUSTRY-SETUP-CONCEPT.md §3.1 G3 — auto-populate industryHint from
        // Tenant.industry when the caller didn't supply one explicitly.
        // This keeps Hermes anchored to the tenant's vertical so the
        // synthesised shape's industry/customFields match what the rest of
        // the platform already knows about this tenant.
        let resolvedHint: string | undefined = input.industryHint;
        if (!resolvedHint) {
          try {
            const tenant = await this.data.tenant.findUnique({
              where: { id: context.tenantId as string },
              select: { industry: true, industryGroup: true },
            });
            // Prefer the precise industry slug; fall back to the group slug
            // (still meaningful as a Hermes hint even when no specific
            // Industry row is set on the tenant).
            resolvedHint = tenant?.industry ?? tenant?.industryGroup ?? undefined;
            if (resolvedHint) {
              this.logger.debug(
                `[DEBUG-TOOL-CREATE] auto-populated industryHint=${resolvedHint} from tenant`,
              );
            }
          } catch (err) {
            // Don't block project creation on a failed tenant lookup —
            // Hermes will still synthesise from the goal alone.
            this.logger.warn(
              `CreateProjectTool: tenant lookup for industryHint failed (${err instanceof Error ? err.message : String(err)}); proceeding without hint`,
            );
          }
        }
        try {
          const synthResult = await this.synthesisService.synthesizeShape({
            goal: userGoal,
            tenantId: context.tenantId as string,
            ...(resolvedHint ? { industryHint: resolvedHint } : {}),
            ...(context.userId ? { userId: context.userId } : {}),
          });
          derivedShape = synthResult.shape;
          synthesisNote = `Hermes synthesized shape from user goal (industry=${synthResult.shape.industry}, stages=${synthResult.shape.stages.length}, goals=${synthResult.shape.goals.length}, members=${synthResult.shape.members.length}${synthResult.usedRepairRetry ? ', usedRepairRetry=true' : ''}). Rationale: ${synthResult.shape.rationale}`;
        } catch (err) {
          this.logger.warn(
            `CreateProjectTool: Hermes synthesis failed (${err instanceof Error ? err.message : String(err)}); falling back to bare project`,
          );
          // Fall through — projectsService.create() will throw if neither
          // projectTypeId nor derivedShape is provided.
        }
      }
    }

    // ─── Template-driven OR Hermes-driven path through ProjectsService ───
    //
    // Prefer ProjectsService.create() — it fires the full automation pipeline
    // (goalTemplate seeding, roleTemplate agent spawning, Chief of Staff
    // assignment, project memory seeding, EIE adapter, stage creation) OR
    // applies the derived shape inline (Phase 2-HERMES).
    //
    // Falling back to a direct prisma write would skip ALL of that, which is
    // the root cause of "AI Employees don't spawn when I create a project
    // through chat" — see the audit in pending-tasks.md D29.
    if (this.projectsService) {
      this.logger.debug(`[DEBUG-TOOL-CREATE] calling projectsService.create(), derivedShape=${derivedShape ? 'present' : 'absent'}`);
      try {
        const project = await this.projectsService.create(
          {
            name: input.name,
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.departmentId ? { departmentId: input.departmentId } : {}),
            ...(input.customerId ? { customerId: input.customerId } : {}),
            ...(input.projectTypeId ? { projectTypeId: input.projectTypeId } : {}),
            ...(input.projectTypeVersion !== undefined ? { projectTypeVersion: input.projectTypeVersion } : {}),
            ...(input.budgetType ? { budgetType: input.budgetType } : {}),
            ...(input.budgetAmount !== undefined ? { budgetAmount: input.budgetAmount } : {}),
            ...(input.budgetCurrency ? { budgetCurrency: input.budgetCurrency } : {}),
            ...(input.priority ? { priority: input.priority } : {}),
            ...(targetDate ? { targetDate } : {}),
            ...(derivedShape ? { derivedShape } : {}),
            ...(derivedShape ? { derivedShapeVersion: 1 } : {}),
          },
          context.tenantId as string,
        );
        this.logger.debug(`[DEBUG-TOOL-CREATE] projectsService.create succeeded: projectId=${project.id}`);

        return {
          success: true,
          data: {
            projectId: project.id,
            name: project.name,
            status: project.status,
            projectTypeId: project.projectTypeId,
            departmentId: project.departmentId,
            createdAt: project.createdAt.toISOString(),
            // Tell the caller what was auto-spawned so the chat reply can
            // surface this in the user-facing summary.
            automation: {
              stage: 'triggered',
              note: derivedShape
                ? (synthesisNote ?? 'Hermes-driven synthesis applied inline.')
                : input.projectTypeId
                  ? 'ProjectAutomationService has been invoked fire-and-forget. Goals from goalTemplate, AI employees from roleTemplate, Chief of Staff, and project memory will be seeded asynchronously. Check /projects/:id for the result.'
                  : 'No projectTypeId and Hermes synthesis unavailable — bare project only. Enable AI_PROJECT_SHAPE_ENABLED or pass projectTypeId.',
            },
          },
          metadata: { model: 'neurecore-project-v1' },
        };
      } catch (error) {
        this.logger.error(`[DEBUG-TOOL-CREATE] projectsService.create FAILED: ${error instanceof Error ? error.message : String(error)}, stack=${error instanceof Error ? error.stack : ''}`);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create project' };
      }
    }

    return { success: false, error: 'ProjectsService unavailable; refusing direct project mutation' };
  }
}

@Injectable()
export class ListDepartmentsTool extends BaseStructuredTool {
  readonly name = 'listDepartments';
  readonly description = 'List departments. Use when user asks about departments or needs department IDs.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListDepartmentsInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: ListDepartmentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const departments = await this.data.department.findMany({
        where: { tenantId: context.tenantId as string, status: input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
        take: input.limit ?? 20,
        select: { id: true, name: true, description: true, status: true, _count: { select: { agents: true, members: true } } },
      });
      return { success: true, data: { departments: departments.map(d => ({ id: d.id, name: d.name, description: d.description, status: d.status, agentCount: d._count.agents, memberCount: d._count.members })), total: departments.length }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list departments' };
    }
  }
}

@Injectable()
export class ListAgentsTool extends BaseStructuredTool {
  readonly name = 'listAgents';
  readonly description = 'List AI agents. Use when user asks about agents, their status, or wants to see available agents.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListAgentsInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: ListAgentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.departmentId) where.departmentId = input.departmentId;
      if (input.status) where.status = input.status;
      const agents = await this.data.agent.findMany({ where, take: input.limit ?? 20, select: { id: true, name: true, type: true, status: true, departmentId: true } });
      return { success: true, data: { agents: agents.map(a => ({ id: a.id, name: a.name, type: a.type, status: a.status, departmentId: a.departmentId })), total: agents.length }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list agents' };
    }
  }
}

@Injectable()
export class PauseAgentTool extends BaseStructuredTool {
  readonly name = 'pauseAgent';
  readonly description =
    'Pause an AI agent. Routes through AgentsService.setStatus so domain events fire and audit logs are written.';
  readonly category = ToolCategory.API;
  readonly inputSchema = PauseAgentInputSchema;
  readonly requiredPermissions = ['agent:pause'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) {
    super();
  }

  protected async executeImpl(input: PauseAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      await this.agentsService.setStatus(agent.id, 'PAUSED' as never, context.tenantId as string);
      return { success: true, data: { agentId: agent.id, name: agent.name, previousStatus: agent.status, newStatus: 'PAUSED' }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to pause agent' };
    }
  }
}

@Injectable()
export class ResumeAgentTool extends BaseStructuredTool {
  readonly name = 'resumeAgent';
  readonly description =
    'Resume a paused AI agent. Routes through AgentsService.setStatus so domain events fire and audit logs are written.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ResumeAgentInputSchema;
  readonly requiredPermissions = ['agent:resume'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) {
    super();
  }

  protected async executeImpl(input: ResumeAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      await this.agentsService.setStatus(agent.id, 'RUNNING' as never, context.tenantId as string);
      return { success: true, data: { agentId: agent.id, name: agent.name, previousStatus: agent.status, newStatus: 'RUNNING' }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to resume agent' };
    }
  }
}

@Injectable()
export class ListTasksTool extends BaseStructuredTool {
  readonly name = 'listTasks';
  readonly description = 'List tasks. Use when user asks about tasks, their status, or wants to see pending work.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListTasksInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: ListTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.status) where.status = input.status;
      if (input.agentId) where.agentId = input.agentId;
      const tasks = await this.data.task.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, priority: true, agentId: true, createdAt: true } });
      return { success: true, data: { tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agentId: t.agentId, createdAt: t.createdAt.toISOString() })), total: tasks.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list tasks' };
    }
  }
}

@Injectable()
export class GetTenantSnapshotTool extends BaseStructuredTool {
  readonly name = 'getTenantSnapshot';
  readonly description = 'Get a live snapshot of the tenant: agents, tasks, departments, workflows, approvals, and costs.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTenantSnapshotInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenantId = context.tenantId;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [agentsByStatus, departmentsCount, tasksByStatus, workflowsByStatus, pendingApprovals, costMonth] = await Promise.all([
        this.data.agent.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.data.department.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => 0),
        this.data.task.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.data.workflow.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.data.approvalRequest.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
        this.data.costRecord.aggregate({ where: { tenantId, windowStart: { gte: monthStart } }, _sum: { costCents: true } }).catch(() => null),
      ]);
      const agentCounts: Record<string, number> = {}; let totalAgents = 0;
      for (const row of agentsByStatus) { const c = row._count?._all ?? 0; agentCounts[row.status] = c; totalAgents += c; }
      const taskCounts: Record<string, number> = {}; let totalTasks = 0;
      for (const row of tasksByStatus) { const c = row._count?._all ?? 0; taskCounts[row.status] = c; totalTasks += c; }
      const workflowCounts: Record<string, number> = {}; let totalWorkflows = 0;
      for (const row of workflowsByStatus) { const c = row._count?._all ?? 0; workflowCounts[row.status] = c; totalWorkflows += c; }
      return { success: true, data: { tenantId, generatedAt: now.toISOString(), agents: { total: totalAgents, byStatus: agentCounts }, departments: { active: departmentsCount }, tasks: { total: totalTasks, byStatus: taskCounts }, workflows: { total: totalWorkflows, byStatus: workflowCounts }, approvals: { pending: pendingApprovals }, cost: { monthToDateCents: costMonth?._sum?.costCents ? Number(costMonth._sum.costCents) : 0, currency: 'USD' } }, metadata: { model: 'neurecore-snapshot-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get tenant snapshot' };
    }
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// P1: DEPARTMENT TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class UpdateDepartmentTool extends BaseStructuredTool {
  readonly name = 'updateDepartment';
  readonly description = 'Update a department name or description.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateDepartmentInputSchema;
  readonly requiredPermissions = ['department:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: UpdateDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      if (!this.departmentsService) return { success: false, error: 'DepartmentsService unavailable; refusing direct department mutation' };
      const updated = await this.departmentsService.update(input.departmentId, { name: input.name ?? dept.name, description: input.description ?? dept.description }, context.tenantId as string);
      return { success: true, data: { departmentId: updated.id, name: updated.name, description: updated.description }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update department' };
    }
  }
}

@Injectable()
export class ArchiveDepartmentTool extends BaseStructuredTool {
  readonly name = 'archiveDepartment';
  readonly description = 'Archive (soft-delete) a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveDepartmentInputSchema;
  readonly requiredPermissions = ['department:archive'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: ArchiveDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      if (!this.departmentsService) return { success: false, error: 'DepartmentsService unavailable; refusing direct department mutation' };
      const updated = await this.departmentsService.update(input.departmentId, { status: 'INACTIVE' as never }, context.tenantId as string);
      return { success: true, data: { departmentId: updated.id, name: updated.name, previousStatus: dept.status, newStatus: updated.status }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive department' };
    }
  }
}

@Injectable()
export class DeleteDepartmentTool extends BaseStructuredTool {
  readonly name = 'deleteDepartment';
  readonly description = 'Permanently delete an empty department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = DeleteDepartmentInputSchema;
  readonly requiredPermissions = ['department:delete'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: DeleteDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId }, include: { _count: { select: { agents: true, members: true } } } });
      if (!dept) return { success: false, error: 'Department not found' };
      if (dept._count.agents > 0 || dept._count.members > 0) return { success: false, error: `Cannot delete department with ${dept._count.agents} agents and ${dept._count.members} members.` };
      if (!this.departmentsService) return { success: false, error: 'DepartmentsService unavailable; refusing direct department mutation' };
      await this.departmentsService.remove(input.departmentId, context.tenantId as string);
      return { success: true, data: { departmentId: input.departmentId, deleted: true }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete department' };
    }
  }
}

@Injectable()
export class AssignManagerTool extends BaseStructuredTool {
  readonly name = 'assignManager';
  readonly description = 'Assign an agent as the head/manager of a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AssignManagerInputSchema;
  readonly requiredPermissions = ['department:assignManager'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: AssignManagerInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [dept, agent] = await Promise.all([
        this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } }),
        this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } }),
      ]);
      if (!dept) return { success: false, error: 'Department not found' };
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!this.departmentsService) return { success: false, error: 'DepartmentsService unavailable; refusing direct department mutation' };
      const updated = await this.departmentsService.update(input.departmentId, { headAgentId: input.agentId }, context.tenantId as string);
      return { success: true, data: { departmentId: updated.id, departmentName: updated.name, managerAgentId: agent.id, managerAgentName: agent.name }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign manager' };
    }
  }
}

@Injectable()
export class UnassignManagerTool extends BaseStructuredTool {
  readonly name = 'unassignManager';
  readonly description = 'Remove the head/manager from a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UnassignManagerInputSchema;
  readonly requiredPermissions = ['department:assignManager'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly departmentsService?: DepartmentsService,
  ) { super(); }

  protected async executeImpl(input: UnassignManagerInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      if (!this.departmentsService) return { success: false, error: 'DepartmentsService unavailable; refusing direct department mutation' };
      const updated = await this.departmentsService.update(input.departmentId, { headAgentId: null }, context.tenantId as string);
      return { success: true, data: { departmentId: updated.id, departmentName: updated.name, managerRemoved: true }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to unassign manager' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P1: AGENT TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class GetAgentTool extends BaseStructuredTool {
  readonly name = 'getAgent';
  readonly description = 'Get detailed information about an agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetAgentInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: GetAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId }, include: { department: { select: { id: true, name: true } }, _count: { select: { tasks: true } } } });
      if (!agent) return { success: false, error: 'Agent not found' };
      return { success: true, data: { id: agent.id, name: agent.name, description: agent.description, type: agent.type, status: agent.status, model: agent.model, department: agent.department, taskCount: agent._count.tasks, createdAt: agent.createdAt.toISOString() }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get agent' };
    }
  }
}

@Injectable()
export class UpdateAgentTool extends BaseStructuredTool {
  readonly name = 'updateAgent';
  readonly description = 'Update an agent name, description, status, model, or system prompt.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateAgentInputSchema;
  readonly requiredPermissions = ['agent:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) { super(); }

  protected async executeImpl(input: UpdateAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.model !== undefined) updateData.model = input.model;
      if (input.systemPrompt !== undefined) updateData.systemPrompt = input.systemPrompt;
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      const updated = await this.agentsService.update(input.agentId, updateData as never, context.tenantId as string) as any;
      return { success: true, data: { agentId: updated.id, name: updated.name, status: updated.status, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update agent' };
    }
  }
}

@Injectable()
export class ArchiveAgentTool extends BaseStructuredTool {
  readonly name = 'archiveAgent';
  readonly description = 'Archive an agent (soft-delete).';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveAgentInputSchema;
  readonly requiredPermissions = ['agent:archive'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) { super(); }

  protected async executeImpl(input: ArchiveAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      const updated = await this.agentsService.archive(input.agentId, context.tenantId as string) as any;
      return { success: true, data: { agentId: updated.id, name: updated.name, previousStatus: agent.status, newStatus: 'ARCHIVED' }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive agent' };
    }
  }
}

@Injectable()
export class AssignAgentToDepartmentTool extends BaseStructuredTool {
  readonly name = 'assignAgentToDepartment';
  readonly description = 'Move an agent to a different department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AssignAgentToDepartmentInputSchema;
  readonly requiredPermissions = ['agent:assignDepartment'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) { super(); }

  protected async executeImpl(input: AssignAgentToDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [agent, dept] = await Promise.all([
        this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } }),
        this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } }),
      ]);
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!dept) return { success: false, error: 'Department not found' };
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      const updated = await this.agentsService.update(input.agentId, { departmentId: input.departmentId }, context.tenantId as string) as any;
      return { success: true, data: { agentId: updated.id, agentName: updated.name, departmentId: dept.id, departmentName: dept.name }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign agent to department' };
    }
  }
}

@Injectable()
export class RemoveAgentFromProjectTool extends BaseStructuredTool {
  readonly name = 'removeAgentFromProject';
  readonly description = 'Remove an agent from a project (projects link agents via tasks, not directly).';
  readonly category = ToolCategory.API;
  readonly inputSchema = RemoveAgentFromProjectInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: RemoveAgentFromProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      return { success: true, data: { agentId: input.agentId, projectId: input.projectId, note: 'Projects are not directly linked to agents. Agents work on projects via tasks.' }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed' };
    }
  }
}

@Injectable()
export class BulkCreateAgentsTool extends BaseStructuredTool {
  readonly name = 'bulkCreateAgents';
  readonly description = 'Create multiple agents at once (up to 50).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkCreateAgentsInputSchema;
  readonly requiredPermissions = ['agent:create'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) { super(); }

  protected async executeImpl(input: BulkCreateAgentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      const results = await Promise.all(input.agents.map(async (a) => {
        const created = await this.agentsService!.create({ name: a.name, type: a.type as never, model: a.model, description: a.description }, context.userId!, context.tenantId as string) as any;
        if (a.departmentId) {
          return this.agentsService!.update(created.id, { departmentId: a.departmentId }, context.tenantId as string) as any;
        }
        return created;
      }));
      return { success: true, data: { created: results.map((a: any) => ({ id: a.id, name: a.name, type: a.type, status: a.status })), total: results.length }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk create agents' };
    }
  }
}

@Injectable()
export class BulkAssignToDepartmentTool extends BaseStructuredTool {
  readonly name = 'bulkAssignToDepartment';
  readonly description = 'Move multiple agents to a department at once (up to 100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkAssignToDepartmentInputSchema;
  readonly requiredPermissions = ['agent:assignDepartment'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly agentsService?: AgentsService,
  ) { super(); }

  protected async executeImpl(input: BulkAssignToDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.data.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      if (!this.agentsService) return { success: false, error: 'AgentsService unavailable; refusing direct agent mutation' };
      await Promise.all(input.agentIds.map(id => this.agentsService!.update(id, { departmentId: input.departmentId }, context.tenantId as string)));
      return { success: true, data: { departmentId: dept.id, departmentName: dept.name, movedAgentIds: input.agentIds, count: input.agentIds.length }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk assign agents' };
    }
  }
}

@Injectable()
export class GetAgentWorkloadTool extends BaseStructuredTool {
  readonly name = 'getAgentWorkload';
  readonly description = 'Get the current workload of an agent: number of assigned tasks by status.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetAgentWorkloadInputSchema;

  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetAgentWorkloadInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      const tasksByStatus = await this.data.task.groupBy({ by: ['status'], where: { agentId: input.agentId, tenantId: context.tenantId }, _count: { _all: true } });
      const breakdown: Record<string, number> = {}; let total = 0;
      for (const row of tasksByStatus) { const c = row._count?._all ?? 0; breakdown[row.status] = c; total += c; }
      return { success: true, data: { agentId: agent.id, agentName: agent.name, status: agent.status, totalTasks: total, byStatus: breakdown }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get agent workload' };
    }
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// P1: PROJECT TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class GetProjectTool extends BaseStructuredTool {
  readonly name = 'getProject';
  readonly description = 'Get detailed information about a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetProjectInputSchema;

  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      const goals = await this.data.goal.count({ where: { tenantId: context.tenantId } }).catch(() => 0);
      if (!project) return { success: false, error: 'Project not found' };
      return { success: true, data: { id: project.id, name: project.name, description: project.description, status: project.status, departmentId: project.departmentId, goalCount: goals, targetDate: project.targetDate?.toISOString() ?? null, createdAt: project.createdAt.toISOString() }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get project' };
    }
  }
}

@Injectable()
export class UpdateProjectTool extends BaseStructuredTool {
  readonly name = 'updateProject';
  readonly description = 'Update a project name, description, status, or target date.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateProjectInputSchema;
  readonly requiredPermissions = ['project:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: UpdateProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.targetDate !== undefined) updateData.targetDate = new Date(input.targetDate);
      if (!this.projectsService) return { success: false, error: 'ProjectsService unavailable; refusing direct project mutation' };
      const updated = await this.projectsService.update(input.projectId, context.tenantId as string, updateData as never);
      return { success: true, data: { projectId: updated.id, name: updated.name, status: updated.status, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update project' };
    }
  }
}

@Injectable()
export class ArchiveProjectTool extends BaseStructuredTool {
  readonly name = 'archiveProject';
  readonly description = 'Archive a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveProjectInputSchema;
  readonly requiredPermissions = ['project:archive'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: ArchiveProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      if (!this.projectsService) return { success: false, error: 'ProjectsService unavailable; refusing direct project mutation' };
      const updated = await this.projectsService.update(input.projectId, context.tenantId as string, { status: 'ARCHIVED' } as never);
      return { success: true, data: { projectId: updated.id, name: updated.name, previousStatus: project.status, newStatus: 'ARCHIVED' }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive project' };
    }
  }
}

@Injectable()
export class DeleteProjectTool extends BaseStructuredTool {
  readonly name = 'deleteProject';
  readonly description = 'Permanently delete a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = DeleteProjectInputSchema;
  readonly requiredPermissions = ['project:delete'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: DeleteProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      if (!this.projectsService) return { success: false, error: 'ProjectsService unavailable; refusing direct project mutation' };
      await this.projectsService.delete(input.projectId, context.tenantId as string);
      return { success: true, data: { projectId: input.projectId, deleted: true }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete project' };
    }
  }
}

@Injectable()
export class CloneProjectTool extends BaseStructuredTool {
  readonly name = 'cloneProject';
  readonly description = 'Duplicate a project with a new name. Optionally includes tasks.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CloneProjectInputSchema;
  readonly requiredPermissions = ['project:create'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: CloneProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const original = await this.data.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!original) return { success: false, error: 'Project not found' };
      if (!this.projectsService) return { success: false, error: 'ProjectsService unavailable; refusing direct project mutation' };
      const cloned = await this.projectsService.cloneFromProject(input.projectId, input.newName, context.tenantId as string);
      return { success: true, data: { originalProjectId: input.projectId, newProjectId: cloned.id, newProjectName: cloned.name, tasksCloned: input.includeTasks }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clone project' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P1: TASK TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class GetTaskTool extends BaseStructuredTool {
  readonly name = 'getTask';
  readonly description = 'Get detailed information about a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTaskInputSchema;

  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId }, include: { agent: { select: { id: true, name: true } }, createdBy: { select: { id: true, firstName: true, lastName: true } } } });
      if (!task) return { success: false, error: 'Task not found' };
      return { success: true, data: { id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority, agent: task.agent, createdBy: task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : null, createdAt: task.createdAt.toISOString(), completedAt: task.completedAt?.toISOString() ?? null }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get task' };
    }
  }
}

@Injectable()
export class UpdateTaskTool extends BaseStructuredTool {
  readonly name = 'updateTask';
  readonly description = 'Update a task title, description, priority, or status.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateTaskInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: UpdateTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.status !== undefined) { updateData.status = input.status; if (input.status === 'COMPLETED') updateData.completedAt = new Date(); }
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.updateViaTasksService(input, updateData, context.tenantId as string);
      return { success: true, data: { taskId: updated.id, title: updated.title, status: updated.status, priority: updated.priority, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update task' };
    }
  }

  private async updateViaTasksService(
    input: UpdateTaskInput,
    updateData: Record<string, unknown>,
    tenantId: string,
  ) {
    const updates: {
      title?: string;
      description?: string;
      priority?: never;
    } = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.priority !== undefined) updates.priority = input.priority as never;

    let updated = Object.keys(updates).length > 0
      ? await this.tasksService!.update(input.taskId, updates, tenantId)
      : await this.tasksService!.findOne(input.taskId, tenantId);

    if (input.status !== undefined) {
      updated = await this.tasksService!.updateStatus(
        input.taskId,
        input.status as never,
        tenantId,
      );
    }

    return updated;
  }
}

@Injectable()
export class DeleteTaskTool extends BaseStructuredTool {
  readonly name = 'deleteTask';
  readonly description = 'Permanently delete a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = DeleteTaskInputSchema;
  readonly requiredPermissions = ['task:delete'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: DeleteTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      await this.tasksService.remove(input.taskId, context.tenantId as string);
      return { success: true, data: { taskId: input.taskId, deleted: true }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete task' };
    }
  }
}

@Injectable()
export class AssignTaskTool extends BaseStructuredTool {
  readonly name = 'assignTask';
  readonly description = 'Assign a task to an agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AssignTaskInputSchema;
  readonly requiredPermissions = ['task:assign'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: AssignTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [task, agent] = await Promise.all([this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } }), this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } })]);
      if (!task) return { success: false, error: 'Task not found' };
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.tasksService.update(
        input.taskId,
        { agentId: input.agentId },
        context.tenantId as string,
      );
      return { success: true, data: { taskId: updated.id, title: updated.title, assignedAgentId: agent.id, assignedAgentName: agent.name }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign task' };
    }
  }
}

@Injectable()
export class UnassignTaskTool extends BaseStructuredTool {
  readonly name = 'unassignTask';
  readonly description = 'Remove the assignee from a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UnassignTaskInputSchema;
  readonly requiredPermissions = ['task:assign'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: UnassignTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.tasksService.update(
        input.taskId,
        { agentId: null },
        context.tenantId as string,
      );
      return { success: true, data: { taskId: updated.id, title: updated.title, unassigned: true }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to unassign task' };
    }
  }
}

@Injectable()
export class MarkTaskCompleteTool extends BaseStructuredTool {
  readonly name = 'markTaskComplete';
  readonly description = 'Mark a task as completed.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkTaskCompleteInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: MarkTaskCompleteInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.tasksService.updateStatus(
        input.taskId,
        'COMPLETED' as never,
        context.tenantId as string,
      );
      return { success: true, data: { taskId: updated.id, title: updated.title, previousStatus: task.status, newStatus: 'COMPLETED', completedAt: updated.completedAt?.toISOString() }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to mark task complete' };
    }
  }
}

@Injectable()
export class MarkTaskInProgressTool extends BaseStructuredTool {
  readonly name = 'markTaskInProgress';
  readonly description = 'Move a task to in-progress status.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkTaskInProgressInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: MarkTaskInProgressInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.tasksService.updateStatus(
        input.taskId,
        'RUNNING' as never,
        context.tenantId as string,
      );
      return { success: true, data: { taskId: updated.id, title: updated.title, previousStatus: task.status, newStatus: 'RUNNING' }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to mark task in progress' };
    }
  }
}

@Injectable()
export class ReopenTaskTool extends BaseStructuredTool {
  readonly name = 'reopenTask';
  readonly description = 'Reopen a completed, failed, or cancelled task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ReopenTaskInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: ReopenTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.tasksService.reopen(input.taskId, context.tenantId as string);
      return { success: true, data: { taskId: updated.id, title: updated.title, previousStatus: task.status, newStatus: 'PENDING' }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reopen task' };
    }
  }
}

@Injectable()
export class ChangeTaskPriorityTool extends BaseStructuredTool {
  readonly name = 'changeTaskPriority';
  readonly description = 'Change the priority of a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ChangeTaskPriorityInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: ChangeTaskPriorityInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const updated = await this.tasksService.update(
        input.taskId,
        { priority: input.priority as never },
        context.tenantId as string,
      );
      return { success: true, data: { taskId: updated.id, title: updated.title, previousPriority: task.priority, newPriority: updated.priority }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to change task priority' };
    }
  }
}

@Injectable()
export class AddSubtaskTool extends BaseStructuredTool {
  readonly name = 'addSubtask';
  readonly description = 'Create a subtask under a parent task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AddSubtaskInputSchema;
  readonly requiredPermissions = ['task:create'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: AddSubtaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const parent = await this.data.task.findFirst({ where: { id: input.parentTaskId, tenantId: context.tenantId } });
      if (!parent) return { success: false, error: 'Parent task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const subtask = await this.tasksService.create(
        {
          title: input.title,
          agentId: input.agentId ?? null,
          priority: (input.priority ?? 'MEDIUM') as never,
          input: { parentTaskId: input.parentTaskId },
        },
        context.tenantId as string,
      );
      return { success: true, data: { subtaskId: subtask.id, title: subtask.title, parentTaskId: input.parentTaskId, priority: subtask.priority, status: subtask.status }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add subtask' };
    }
  }
}

@Injectable()
export class ListSubtasksTool extends BaseStructuredTool {
  readonly name = 'listSubtasks';
  readonly description = 'List all subtasks of a parent task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListSubtasksInputSchema;

  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListSubtasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const subtasks = await this.data.task.findMany({ where: { tenantId: context.tenantId as string, input: { path: ['parentTaskId'], equals: input.parentTaskId } }, select: { id: true, title: true, status: true, priority: true, agentId: true, createdAt: true } });
      return { success: true, data: { parentTaskId: input.parentTaskId, subtasks: subtasks.map(s => ({ id: s.id, title: s.title, status: s.status, priority: s.priority, agentId: s.agentId, createdAt: s.createdAt.toISOString() })), total: subtasks.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list subtasks' };
    }
  }
}

@Injectable()
export class GetMyTasksTool extends BaseStructuredTool {
  readonly name = 'getMyTasks';
  readonly description = 'Get tasks assigned to the current user/agent context.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetMyTasksInputSchema;

  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetMyTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.agentId) return { success: false, error: 'Agent context required for getMyTasks' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, agentId: context.agentId };
      if (input.status) where.status = input.status;
      if (input.priority) where.priority = input.priority;
      const tasks = await this.data.task.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, priority: true, createdAt: true } });
      return { success: true, data: { tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt.toISOString() })), total: tasks.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get my tasks' };
    }
  }
}

@Injectable()
export class GetOverdueTasksTool extends BaseStructuredTool {
  readonly name = 'getOverdueTasks';
  readonly description = 'Get all overdue tasks (past due date, not completed).';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetOverdueTasksInputSchema;

  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetOverdueTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, status: { not: 'COMPLETED' } };
      if (input.departmentId) where.departmentId = input.departmentId;
      const tasks = await this.data.task.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, include: { agent: { select: { id: true, name: true } } } });
      const overdue = tasks.filter(t => t.completedAt === null);
      return { success: true, data: { overdueTasks: overdue.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agent: t.agent, createdAt: t.createdAt.toISOString() })), total: overdue.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get overdue tasks' };
    }
  }
}

@Injectable()
export class BulkAssignTasksTool extends BaseStructuredTool {
  readonly name = 'bulkAssignTasks';
  readonly description = 'Assign multiple tasks to the same agent at once (up to 100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkAssignTasksInputSchema;
  readonly requiredPermissions = ['task:assign'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: BulkAssignTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.data.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      await Promise.all(input.taskIds.map((id) =>
        this.tasksService!.update(
          id,
          { agentId: input.agentId },
          context.tenantId as string,
        ),
      ));
      return { success: true, data: { assignedAgentId: agent.id, assignedAgentName: agent.name, taskCount: input.taskIds.length, taskIds: input.taskIds }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk assign tasks' };
    }
  }
}

@Injectable()
export class BulkChangeStatusTool extends BaseStructuredTool {
  readonly name = 'bulkChangeStatus';
  readonly description = 'Change the status of multiple tasks at once (up to 100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkChangeStatusInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: BulkChangeStatusInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      await this.tasksService.bulkUpdateStatus(
        input.taskIds,
        input.status as never,
        context.tenantId as string,
      );
      return { success: true, data: { newStatus: input.status, taskCount: input.taskIds.length, taskIds: input.taskIds }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk change status' };
    }
  }
}

@Injectable()
export class CloneTaskTool extends BaseStructuredTool {
  readonly name = 'cloneTask';
  readonly description = 'Duplicate a task, optionally assigning it to a different agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CloneTaskInputSchema;
  readonly requiredPermissions = ['task:create'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tasksService?: TasksService,
  ) { super(); }

  protected async executeImpl(input: CloneTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const original = await this.data.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!original) return { success: false, error: 'Task not found' };
      if (!this.tasksService) {
        return { success: false, error: 'TasksService unavailable; refusing direct task mutation' };
      }
      const cloned = await this.tasksService.clone(
        input.taskId,
        context.tenantId as string,
        { assigneeId: input.newAssigneeId },
      );
      return { success: true, data: { originalTaskId: input.taskId, newTaskId: cloned.id, newTaskTitle: cloned.title, newAssigneeId: cloned.agentId }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clone task' };
    }
  }
}
// P1: APPROVAL TOOL IMPLEMENTATIONS
@Injectable()
export class ListPendingApprovalsTool extends BaseStructuredTool {
  readonly name = 'listPendingApprovals';
  readonly description = 'List all pending approval requests for the tenant.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListPendingApprovalsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: ListPendingApprovalsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, status: 'PENDING' };
      if (input.priority) where.priority = input.priority;
      const approvals = await this.data.approvalRequest.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, description: true, resourceType: true, priority: true, status: true, createdAt: true } });
      return { success: true, data: { approvals: approvals.map(a => ({ id: a.id, title: a.title, description: a.description, resourceType: a.resourceType, priority: a.priority, status: a.status, createdAt: a.createdAt.toISOString() })), total: approvals.length }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to list pending approvals' }; }
  }
}
@Injectable()
export class GetApprovalTool extends BaseStructuredTool {
  readonly name = 'getApproval';
  readonly description = 'Get detailed information about an approval request.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetApprovalInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetApprovalInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.data.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId }, include: { requestedBy: { select: { id: true, firstName: true, lastName: true } }, reviewedBy: { select: { id: true, firstName: true, lastName: true } } } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      return { success: true, data: { id: approval.id, title: approval.title, description: approval.description, resourceType: approval.resourceType, resourceId: approval.resourceId, priority: approval.priority, status: approval.status, requestedBy: approval.requestedBy ? `${approval.requestedBy.firstName} ${approval.requestedBy.lastName}` : null, reviewedBy: approval.reviewedBy ? `${approval.reviewedBy.firstName} ${approval.reviewedBy.lastName}` : null, approvedAt: approval.approvedAt?.toISOString() ?? null, rejectedAt: approval.rejectedAt?.toISOString() ?? null, rejectionReason: approval.rejectionReason, createdAt: approval.createdAt.toISOString() }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get approval' }; }
  }
}
@Injectable()
export class ApproveRequestTool extends BaseStructuredTool {
  readonly name = 'approveRequest';
  readonly description = 'Approve an approval request.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ApproveRequestInputSchema;
  readonly requiredPermissions = ['approval:approve'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: ApproveRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.data.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'PENDING') return { success: false, error: `Cannot approve request with status: ${approval.status}` };
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      await this.approvalsService.approveRequest(context.tenantId as string, input.approvalId, context.userId);
      const updated = await this.approvalsService.findOne(input.approvalId, context.tenantId as string);
      return { success: true, data: { approvalId: approval.id, title: approval.title, newStatus: 'APPROVED', approvedAt: updated?.approvedAt?.toISOString() ?? null }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to approve request' }; }
  }
}
@Injectable()
export class RejectRequestTool extends BaseStructuredTool {
  readonly name = 'rejectRequest';
  readonly description = 'Reject an approval request with a reason.';
  readonly category = ToolCategory.API;
  readonly inputSchema = RejectRequestInputSchema;
  readonly requiredPermissions = ['approval:reject'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: RejectRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.data.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'PENDING') return { success: false, error: `Cannot reject request with status: ${approval.status}` };
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      await this.approvalsService.rejectRequest(context.tenantId as string, input.approvalId, context.userId, input.reason);
      return { success: true, data: { approvalId: approval.id, title: approval.title, newStatus: 'REJECTED', rejectionReason: input.reason }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to reject request' }; }
  }
}
@Injectable()
export class BulkApproveTool extends BaseStructuredTool {
  readonly name = 'bulkApprove';
  readonly description = 'Approve multiple approval requests at once (up to 50).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkApproveInputSchema;
  readonly requiredPermissions = ['approval:approve'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: BulkApproveInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      const results = await this.approvalsService.bulkApprove(context.tenantId as string, input.approvalIds, context.userId);
      const approvedIds = results.filter((r) => r.status === 'approved').map((r) => r.id);
      return { success: true, data: { approvedIds, count: approvedIds.length, results }, metadata: { model: 'neurecore-approval-v1' } };
    }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk approve' }; }
  }
}
@Injectable()
export class BulkRejectTool extends BaseStructuredTool {
  readonly name = 'bulkReject';
  readonly description = 'Reject multiple approval requests with the same reason (up to 50).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkRejectInputSchema;
  readonly requiredPermissions = ['approval:reject'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: BulkRejectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      const results = await this.approvalsService.bulkReject(context.tenantId as string, input.approvalIds, context.userId, input.reason);
      const rejectedIds = results.filter((r) => r.status === 'rejected').map((r) => r.id);
      return { success: true, data: { rejectedIds, count: rejectedIds.length, reason: input.reason, results }, metadata: { model: 'neurecore-approval-v1' } };
    }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk reject' }; }
  }
}
@Injectable()
export class CreateApprovalRequestTool extends BaseStructuredTool {
  readonly name = 'createApprovalRequest';
  readonly description = 'Submit a new approval request.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateApprovalRequestInputSchema;
  readonly requiredPermissions = ['approval:create'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: CreateApprovalRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      const approval = await this.approvalsService.create(context.tenantId as string, {
        title: input.title,
        description: input.description,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? undefined,
        priority: input.priority ?? 'MEDIUM',
        requestedById: context.userId,
      });
      return { success: true, data: { approvalId: approval.id, title: approval.title, resourceType: approval.resourceType, status: approval.status, priority: approval.priority, createdAt: approval.createdAt.toISOString() }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to create approval request' }; }
  }
}
@Injectable()
export class GetMyPendingApprovalsTool extends BaseStructuredTool {
  readonly name = 'getMyPendingApprovals';
  readonly description = 'Get pending approval requests submitted by the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetMyPendingApprovalsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetMyPendingApprovalsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const approvals = await this.data.approvalRequest.findMany({ where: { tenantId: context.tenantId as string, status: 'PENDING', requestedById: context.userId }, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, resourceType: true, priority: true, status: true, createdAt: true } });
      return { success: true, data: { approvals: approvals.map(a => ({ id: a.id, title: a.title, resourceType: a.resourceType, priority: a.priority, status: a.status, createdAt: a.createdAt.toISOString() })), total: approvals.length }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get my pending approvals' }; }
  }
}
@Injectable()
export class ResubmitApprovalTool extends BaseStructuredTool {
  readonly name = 'resubmitApproval';
  readonly description = 'Resubmit a rejected approval request for review.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ResubmitApprovalInputSchema;
  readonly requiredPermissions = ['approval:create'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: ResubmitApprovalInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.data.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'REJECTED') return { success: false, error: `Can only resubmit rejected requests. Status: ${approval.status}` };
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      const updated = await this.approvalsService.resubmit(context.tenantId as string, input.approvalId);
      return { success: true, data: { approvalId: updated.id, title: updated.title, newStatus: 'PENDING' }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to resubmit approval' }; }
  }
}
@Injectable()
export class CancelApprovalRequestTool extends BaseStructuredTool {
  readonly name = 'cancelApprovalRequest';
  readonly description = 'Cancel a pending approval request (only by the requester).';
  readonly category = ToolCategory.API;
  readonly inputSchema = CancelApprovalRequestInputSchema;
  readonly requiredPermissions = ['approval:cancel'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: CancelApprovalRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.data.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'PENDING') return { success: false, error: `Can only cancel pending requests. Status: ${approval.status}` };
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      await this.approvalsService.cancel(context.tenantId as string, input.approvalId);
      return { success: true, data: { approvalId: approval.id, title: approval.title, newStatus: 'CANCELLED' }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to cancel approval request' }; }
  }
}
// P1: BUDGET & COST TOOLS
@Injectable()
export class GetCostReportTool extends BaseStructuredTool {
  readonly name = 'getCostReport';
  readonly description = 'Get cost breakdown over a date range, grouped by day/week/month.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostReportInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetCostReportInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const fromDate = input.fromDate ? new Date(input.fromDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = input.toDate ? new Date(input.toDate) : new Date();
      const records = await this.data.costRecord.findMany({ where: { tenantId: context.tenantId as string, windowStart: { gte: fromDate }, windowEnd: { lte: toDate } }, orderBy: { windowStart: 'asc' } });
      return { success: true, data: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), groupBy: input.groupBy ?? 'day', totalRecords: records.length, records: records.map(r => ({ provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costCents: Number(r.costCents), windowStart: r.windowStart.toISOString() })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost report' }; }
  }
}
@Injectable()
export class GetCostByDepartmentTool extends BaseStructuredTool {
  readonly name = 'getCostByDepartment';
  readonly description = 'Get costs grouped by department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostByDepartmentInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetCostByDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const fromDate = input.fromDate ? new Date(input.fromDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = input.toDate ? new Date(input.toDate) : new Date();
      const records = await this.data.costRecord.groupBy({ by: ['departmentId'], where: { tenantId: context.tenantId as string, windowStart: { gte: fromDate }, departmentId: { not: null } }, _sum: { costCents: true }, _count: { _all: true } });
      const deptIds = records.filter(r => r.departmentId).map(r => r.departmentId!);
      const depts = await this.data.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } });
      const deptMap = new Map(depts.map(d => [d.id, d.name]));
      return { success: true, data: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), byDepartment: records.map(r => ({ departmentId: r.departmentId, departmentName: deptMap.get(r.departmentId!) ?? 'Unknown', totalCostCents: r._sum?.costCents ? Number(r._sum.costCents) : 0, recordCount: r._count?._all ?? 0 })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost by department' }; }
  }
}
@Injectable()
export class GetCostByAgentTool extends BaseStructuredTool {
  readonly name = 'getCostByAgent';
  readonly description = 'Get costs grouped by agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostByAgentInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetCostByAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const fromDate = input.fromDate ? new Date(input.fromDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = input.toDate ? new Date(input.toDate) : new Date();
      const records = await this.data.costRecord.groupBy({ by: ['agentId'], where: { tenantId: context.tenantId as string, windowStart: { gte: fromDate }, agentId: { not: null } }, _sum: { costCents: true }, _count: { _all: true } });
      const agentIds = records.filter(r => r.agentId).map(r => r.agentId!);
      const agents = await this.data.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
      const agentMap = new Map(agents.map(a => [a.id, a.name]));
      return { success: true, data: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), byAgent: records.map(r => ({ agentId: r.agentId, agentName: agentMap.get(r.agentId!) ?? 'Unknown', totalCostCents: r._sum?.costCents ? Number(r._sum.costCents) : 0, recordCount: r._count?._all ?? 0 })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost by agent' }; }
  }
}
@Injectable()
export class GetCostByProjectTool extends BaseStructuredTool {
  readonly name = 'getCostByProject';
  readonly description = 'Get costs grouped by project. Note: Projects are linked via departments.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostByProjectInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetCostByProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const projects = await this.data.project.findMany({ where: { tenantId: context.tenantId }, select: { id: true, name: true, departmentId: true } });
      return { success: true, data: { projects: projects.map(p => ({ projectId: p.id, projectName: p.name, note: 'Cost records are attributed by department.' })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost by project' }; }
  }
}
@Injectable()
export class SetBudgetAlertTool extends BaseStructuredTool {
  readonly name = 'setBudgetAlert';
  readonly description = 'Configure a budget alert threshold.';
  readonly category = ToolCategory.API;
  readonly inputSchema = SetBudgetAlertInputSchema;
  readonly requiredPermissions = ['budget:configure'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly governanceRulesService?: GovernanceRulesService,
  ) { super(); }
  protected async executeImpl(input: SetBudgetAlertInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.governanceRulesService) return { success: false, error: 'GovernanceRulesService unavailable; refusing direct governance mutation' };
      const rule = await this.governanceRulesService.create(context.tenantId as string, { name: `Budget Alert ${input.thresholdPercent}%`, trigger: `cost.percentage >= ${input.thresholdPercent}`, actionType: 'ALERT', isActive: true, priority: 0 });
      return { success: true, data: { alertId: rule.id, thresholdPercent: input.thresholdPercent, departmentId: input.departmentId ?? 'tenant-wide', isActive: true }, metadata: { model: 'neurecore-budget-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to set budget alert' }; }
  }
}
@Injectable()
export class GetTodayCostTool extends BaseStructuredTool {
  readonly name = 'getTodayCost';
  readonly description = 'Get total platform cost for today.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTodayCostInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const result = await this.data.costRecord.aggregate({ where: { tenantId: context.tenantId as string, windowStart: { gte: todayStart }, windowEnd: { lte: todayEnd } }, _sum: { costCents: true } });
      const totalCents = result._sum?.costCents ? Number(result._sum.costCents) : 0;
      return { success: true, data: { date: todayStart.toISOString().split('T')[0], totalCostCents: totalCents, totalCostUsd: (totalCents / 100).toFixed(4), currency: 'USD' }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get today cost' }; }
  }
}
// P1: COMPANY SETTINGS TOOLS
@Injectable()
export class GetCompanyProfileTool extends BaseStructuredTool {
  readonly name = 'getCompanyProfile';
  readonly description = 'Get the company/tenant profile.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCompanyProfileInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenant = await this.data.tenant.findFirst({ where: { id: context.tenantId }, select: { id: true, name: true, logoUrl: true, website: true, industry: true, status: true, createdAt: true } });
      if (!tenant) return { success: false, error: 'Tenant not found' };
      return { success: true, data: { tenantId: tenant.id, name: tenant.name, logoUrl: tenant.logoUrl, website: tenant.website, industry: tenant.industry, status: tenant.status, createdAt: tenant.createdAt.toISOString() }, metadata: { model: 'neurecore-tenant-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get company profile' }; }
  }
}
@Injectable()
export class UpdateCompanyProfileTool extends BaseStructuredTool {
  readonly name = 'updateCompanyProfile';
  readonly description = 'Update the company/tenant profile.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateCompanyProfileInputSchema;
  readonly requiredPermissions = ['tenant:update'];
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly tenantsService?: TenantsService,
  ) { super(); }
  protected async executeImpl(input: UpdateCompanyProfileInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
      if (input.website !== undefined) updateData.website = input.website;
      if (input.industry !== undefined) updateData.industry = input.industry;
      if (!this.tenantsService) return { success: false, error: 'TenantsService unavailable; refusing direct tenant mutation' };
      const updated = await this.tenantsService.updateMine(context.tenantId as string, context.userId, updateData);
      return { success: true, data: { tenantId: updated.id, name: updated.name, logoUrl: updated.logoUrl, website: updated.website, industry: updated.industry, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-tenant-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to update company profile' }; }
  }
}
@Injectable()
export class GetTenantSettingsTool extends BaseStructuredTool {
  readonly name = 'getTenantSettings';
  readonly description = 'Get tenant settings and feature flags.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTenantSettingsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenant = await this.data.tenant.findFirst({ where: { id: context.tenantId }, select: { id: true, name: true, settings: true, metadata: true } });
      if (!tenant) return { success: false, error: 'Tenant not found' };
      return { success: true, data: { tenantId: tenant.id, name: tenant.name, settings: tenant.settings, metadata: tenant.metadata }, metadata: { model: 'neurecore-tenant-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get tenant settings' }; }
  }
}
// P1: NOTIFICATION TOOLS
@Injectable()
export class GetMyNotificationsTool extends BaseStructuredTool {
  readonly name = 'getMyNotifications';
  readonly description = 'Get notifications for the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetMyNotificationsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetMyNotificationsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, userId: context.userId };
      if (input.isRead !== undefined) where.isRead = input.isRead;
      const notifications = await this.data.notification.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true } });
      return { success: true, data: { notifications: notifications.map(n => ({ id: n.id, type: n.type, title: n.title, message: n.message, isRead: n.isRead, createdAt: n.createdAt.toISOString() })), total: notifications.length, unreadCount: notifications.filter(n => !n.isRead).length }, metadata: { model: 'neurecore-notification-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get notifications' }; }
  }
}
@Injectable()
export class MarkNotificationReadTool extends BaseStructuredTool {
  readonly name = 'markNotificationRead';
  readonly description = 'Mark a single notification as read.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkNotificationReadInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) { super(); }
  protected async executeImpl(input: MarkNotificationReadInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const notification = await this.data.notification.findFirst({ where: { id: input.notificationId, tenantId: context.tenantId } });
      if (!notification) return { success: false, error: 'Notification not found' };
      if (!this.notificationsService) return { success: false, error: 'NotificationsService unavailable; refusing direct notification mutation' };
      await this.notificationsService.markRead(input.notificationId, context.userId);
      return { success: true, data: { notificationId: input.notificationId, isRead: true }, metadata: { model: 'neurecore-notification-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to mark notification read' }; }
  }
}
@Injectable()
export class MarkAllNotificationsReadTool extends BaseStructuredTool {
  readonly name = 'markAllNotificationsRead';
  readonly description = 'Mark all notifications for the current user as read.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkAllNotificationsReadInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      if (!this.notificationsService) return { success: false, error: 'NotificationsService unavailable; refusing direct notification mutation' };
      const result = await this.notificationsService.markAllRead(context.userId, context.tenantId as string);
      return { success: true, data: { markedCount: result.count }, metadata: { model: 'neurecore-notification-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to mark all notifications read' }; }
  }
}
// P1: REPORTING TOOLS
@Injectable()
export class GetDashboardSummaryTool extends BaseStructuredTool {
  readonly name = 'getDashboardSummary';
  readonly description = 'Get a comprehensive dashboard summary.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetDashboardSummaryInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenantId = context.tenantId;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [agentStats, taskStats, deptCount, pendingApprovals, todayCost] = await Promise.all([
        this.data.agent.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.data.task.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.data.department.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => 0),
        this.data.approvalRequest.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
        this.data.costRecord.aggregate({ where: { tenantId, windowStart: { gte: new Date(now.setHours(0, 0, 0, 0)) } }, _sum: { costCents: true } }).catch(() => null),
      ]);
      const buildCounts = (rows: Array<{ status: string; _count: { _all: number } }>) => { const m: Record<string, number> = {}; let t = 0; for (const r of rows) { m[r.status] = r._count._all; t += r._count._all; } return { total: t, byStatus: m }; };
      return { success: true, data: { generatedAt: now.toISOString(), agents: buildCounts(agentStats), tasks: buildCounts(taskStats), departments: { active: deptCount }, approvals: { pending: pendingApprovals }, cost: { todayCents: todayCost?._sum?.costCents ? Number(todayCost._sum.costCents) : 0, currency: 'USD' } }, metadata: { model: 'neurecore-report-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get dashboard summary' }; }
  }
}
@Injectable()
export class GetOverdueTaskReportTool extends BaseStructuredTool {
  readonly name = 'getOverdueTaskReport';
  readonly description = 'Get all overdue tasks grouped by owner.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetOverdueTaskReportInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetOverdueTaskReportInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, status: { not: 'COMPLETED' } };
      if (input.departmentId) where.departmentId = input.departmentId;
      const tasks = await this.data.task.findMany({ where, take: input.limit ?? 50, orderBy: { createdAt: 'desc' }, include: { agent: { select: { id: true, name: true } } } });
      const overdue = tasks.filter(t => t.completedAt === null);
      const byAgent: Record<string, { agentId: string; agentName: string; tasks: number }> = {};
      for (const t of overdue) { if (t.agent) { const key = t.agent.id; if (!byAgent[key]) byAgent[key] = { agentId: t.agent.id, agentName: t.agent.name, tasks: 0 }; byAgent[key].tasks++; } }
      return { success: true, data: { overdueTasks: overdue.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agent: t.agent })), totalOverdue: overdue.length, byAgent: Object.values(byAgent) }, metadata: { model: 'neurecore-report-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get overdue task report' }; }
  }
}
// P1: INBOX TOOLS
@Injectable()
export class GetInboxSummaryTool extends BaseStructuredTool {
  readonly name = 'getInboxSummary';
  readonly description = 'Get inbox summary counts by type for the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetInboxSummaryInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const [pendingApprovals, unreadNotifications] = await Promise.all([
        this.data.approvalRequest.count({ where: { tenantId: context.tenantId as string, requestedById: context.userId, status: 'PENDING' } }),
        this.data.notification.count({ where: { tenantId: context.tenantId as string, userId: context.userId, isRead: false } }),
      ]);
      return { success: true, data: { pendingApprovals, unreadNotifications, totalItems: pendingApprovals + unreadNotifications }, metadata: { model: 'neurecore-inbox-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get inbox summary' }; }
  }
}
@Injectable()
export class ListInboxItemsTool extends BaseStructuredTool {
  readonly name = 'listInboxItems';
  readonly description = 'List inbox items (approvals, notifications) for the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListInboxItemsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: ListInboxItemsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const items: Array<{ id: string; type: string; title: string; status: string; createdAt: string }> = [];
      if (!input.type || input.type === 'approval') {
        const approvals = await this.data.approvalRequest.findMany({ where: { tenantId: context.tenantId as string, requestedById: context.userId, status: 'PENDING' }, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, createdAt: true } });
        items.push(...approvals.map(a => ({ id: a.id, type: 'approval', title: a.title, status: a.status, createdAt: a.createdAt.toISOString() })));
      }
      if (!input.type || input.type === 'notification') {
        const notifs = await this.data.notification.findMany({ where: { tenantId: context.tenantId as string, userId: context.userId }, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, isRead: true, createdAt: true } });
        items.push(...notifs.map(n => ({ id: n.id, type: 'notification', title: n.title, status: n.isRead ? 'read' : 'unread', createdAt: n.createdAt.toISOString() })));
      }
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { success: true, data: { items: items.slice(0, input.limit ?? 20), total: items.length }, metadata: { model: 'neurecore-inbox-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to list inbox items' }; }
  }
}
@Injectable()
export class GetInboxItemTool extends BaseStructuredTool {
  readonly name = 'getInboxItem';
  readonly description = 'Get detailed information about an inbox item.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetInboxItemInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }
  protected async executeImpl(input: GetInboxItemInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [approval, notification] = await Promise.all([
        this.data.approvalRequest.findFirst({ where: { id: input.itemId, tenantId: context.tenantId } }).catch(() => null),
        this.data.notification.findFirst({ where: { id: input.itemId, tenantId: context.tenantId } }).catch(() => null),
      ]);
      if (approval) return { success: true, data: { id: approval.id, type: 'approval', title: approval.title, description: approval.description, status: approval.status, priority: approval.priority, resourceType: approval.resourceType, createdAt: approval.createdAt.toISOString() }, metadata: { model: 'neurecore-inbox-v1' } };
      if (notification) return { success: true, data: { id: notification.id, type: notification.type, title: notification.title, message: notification.message, isRead: notification.isRead, createdAt: notification.createdAt.toISOString() }, metadata: { model: 'neurecore-inbox-v1' } };
      return { success: false, error: 'Inbox item not found' };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get inbox item' }; }
  }
}
@Injectable()
export class RespondToInboxItemTool extends BaseStructuredTool {
  readonly name = 'respondToInboxItem';
  readonly description = 'Approve, reject, or respond to an inbox item.';
  readonly category = ToolCategory.API;
  readonly inputSchema = RespondToInboxItemInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly approvalsService?: ApprovalsService,
  ) { super(); }
  protected async executeImpl(input: RespondToInboxItemInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.data.approvalRequest.findFirst({ where: { id: input.itemId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (!this.approvalsService) return { success: false, error: 'ApprovalsService unavailable; refusing direct approval mutation' };
      if (input.action === 'approve') {
        await this.approvalsService.approveRequest(context.tenantId as string, input.itemId, context.userId);
        return { success: true, data: { itemId: input.itemId, action: 'approved' }, metadata: { model: 'neurecore-inbox-v1' } };
      } else if (input.action === 'reject') {
        await this.approvalsService.rejectRequest(context.tenantId as string, input.itemId, context.userId, input.comment ?? 'Rejected');
        return { success: true, data: { itemId: input.itemId, action: 'rejected' }, metadata: { model: 'neurecore-inbox-v1' } };
      }
      return { success: true, data: { itemId: input.itemId, action: input.action, note: 'Response recorded' }, metadata: { model: 'neurecore-inbox-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to respond to inbox item' }; }
  }
}

// ─── Phase 3D: Project Memory Tools ────────────────────────────────────────────

@Injectable()
export class AddProjectMemoryTool extends BaseStructuredTool {
  readonly name = 'project_memory_add';
  readonly description = 'Add a memory entry to a project (append-only log).';
  readonly category = ToolCategory.API;
  readonly inputSchema = AddProjectMemoryInputSchema;
  constructor(private readonly memoryService: ProjectMemoryService) { super(); }
  protected async executeImpl(input: AddProjectMemoryInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      this.logger.debug?.(
        `[AddProjectMemoryTool] calling memoryService.create tenant=${context.tenantId} project=${input.projectId} category=${input.category}`,
      );
      const entry = await this.memoryService.create(context.tenantId, {
        projectId: input.projectId,
        category: input.category,
        content: input.content,
        authorType: input.authorType === 'HUMAN' ? 'HUMAN' : 'AI',
        authorId: context.agentId,
        isPinned: input.isPinned ?? false,
        isAiGenerated: input.authorType !== 'HUMAN',
        confidence: input.confidence ?? 80,
      });
      this.logger.debug?.(
        `[AddProjectMemoryTool] created memoryId=${entry.id}`,
      );
      return { success: true, data: { memoryId: entry.id, projectId: entry.projectId, category: entry.category, createdAt: entry.createdAt.toISOString() }, metadata: { model: 'neurecore-memory-v1' } };
    } catch (error) {
      this.logger.error(
        `[AddProjectMemoryTool] create failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add project memory' };
    }
  }
}

@Injectable()
export class SearchProjectMemoryTool extends BaseStructuredTool {
  readonly name = 'project_memory_search';
  readonly description = 'Search project memory entries by keyword.';
  readonly category = ToolCategory.API;
  readonly inputSchema = SearchProjectMemoryInputSchema;
  constructor(private readonly memoryService: ProjectMemoryService) { super(); }
  protected async executeImpl(input: SearchProjectMemoryInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const memories = await this.memoryService.search(
        input.projectId,
        input.query,
        context.tenantId,
      );
      const limit = input.limit ?? 10;
      const limited = memories.slice(0, limit).map((m) => ({
        id: m.id,
        category: m.category,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        isPinned: m.isPinned,
      }));
      return { success: true, data: { count: limited.length, memories: limited }, metadata: { model: 'neurecore-memory-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to search project memory' }; }
  }
}

@Injectable()
export class UpdateMemoryConfidenceTool extends BaseStructuredTool {
  readonly name = 'project_memory_update_confidence';
  readonly description = 'Update the confidence score of a memory entry (0-100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateMemoryConfidenceInputSchema;
  constructor(private readonly memoryService: ProjectMemoryService) { super(); }
  protected async executeImpl(input: UpdateMemoryConfidenceInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const updated = await this.memoryService.updateConfidence(
        input.memoryId,
        context.tenantId,
        input.confidence,
        input.supersededById ?? null,
      );
      return { success: true, data: { memoryId: updated.id, confidence: input.confidence }, metadata: { model: 'neurecore-memory-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to update memory confidence' }; }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER TOOL IMPLEMENTATIONS (2026-07-19)
// ═══════════════════════════════════════════════════════════════════════════
// Hermes can now create / read / list / update / archive customers via chat.
// All operations route through CustomersService so tenant isolation, the
// Prisma audit trail, and the @@unique([tenantId, name]) constraint are
// enforced consistently with the REST /api/v1/customers endpoints.

@Injectable()
export class CreateCustomerTool extends BaseStructuredTool {
  readonly name = 'createCustomer';
  readonly description =
    'Create a new customer record for this tenant. Routes through CustomersService so uniqueness, tenant isolation, and audit fields are enforced. Use when the user wants to add a client/company to the workspace — usually before linking them to a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateCustomerInputSchema;
  readonly requiredPermissions = ['customer:create'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly customersService?: CustomersService,
  ) {
    super();
  }

  protected async executeImpl(
    input: CreateCustomerInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (this.customersService) {
        // INDUSTRY-SETUP-CONCEPT.md §3.1 G3 — mirror the project tool:
        // when the caller didn't supply an `industry`, fall back to the
        // tenant's own industry slug so the new customer lands in the
        // same vertical as the rest of the workspace (downstream
        // IndustryCustomerFields depends on this matching).
        let resolvedIndustry: string | undefined =
          typeof input.industry === 'string' && input.industry.trim().length > 0
            ? input.industry.trim()
            : undefined;
        if (!resolvedIndustry) {
          try {
            const tenant = await this.data.tenant.findUnique({
              where: { id: context.tenantId as string },
              select: { industry: true },
            });
            resolvedIndustry = tenant?.industry ?? undefined;
          } catch {
            // Non-fatal — proceed without an industry.
          }
        }

        // Coerce empty strings to undefined for F&C fields. Empty strings
        // would be rejected by the DTO's IsIn validator and 400 the
        // entire request — turning the chat "create a customer" command
        // into a silent failure.
        const empty = (v: unknown) =>
          typeof v === 'string' && v.trim().length === 0 ? undefined : v;

        const customer = await this.customersService.create(
          {
            name: input.name,
            ...(resolvedIndustry !== undefined ? { industry: resolvedIndustry } : {}),
            ...(input.primaryEmail !== undefined ? { primaryEmail: input.primaryEmail } : {}),
            ...(input.primaryPhone !== undefined ? { primaryPhone: input.primaryPhone } : {}),
            ...(input.billingInfo !== undefined ? { billingInfo: input.billingInfo } : {}),
            ...(input.tags !== undefined ? { tags: input.tags } : {}),
            ...(empty(input.kycStatus) !== undefined ? { kycStatus: empty(input.kycStatus) as never } : {}),
            ...(empty(input.riskRating) !== undefined ? { riskRating: empty(input.riskRating) as never } : {}),
            ...(empty(input.taxId) !== undefined ? { taxId: empty(input.taxId) as string } : {}),
            ...(empty(input.financialSubType) !== undefined ? { financialSubType: empty(input.financialSubType) as never } : {}),
            ...(empty(input.lifecycleStage) !== undefined ? { lifecycleStage: empty(input.lifecycleStage) as never } : {}),
          },
          context.tenantId as string,
        );
        return {
          success: true,
          data: this.toDto(customer),
          metadata: { model: 'neurecore-customer-v1' },
        };
      }
      return { success: false, error: 'CustomersService unavailable; refusing direct customer mutation' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create customer' };
    }
  }

  private toDto(c: {
    id: string;
    name: string;
    industry: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    billingInfo: unknown;
    status: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      customerId: c.id,
      name: c.name,
      industry: c.industry,
      primaryEmail: c.primaryEmail,
      primaryPhone: c.primaryPhone,
      billingInfo: (c.billingInfo ?? null) as Record<string, unknown> | null,
      status: c.status,
      tags: c.tags,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class UpdateCustomerTool extends BaseStructuredTool {
  readonly name = 'updateCustomer';
  readonly description =
    'Update an existing customer. Only the fields you pass are changed — others are preserved. Routes through CustomersService so tenant isolation + (tenantId, name) uniqueness are enforced.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateCustomerInputSchema;
  readonly requiredPermissions = ['customer:update'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly customersService?: CustomersService,
  ) {
    super();
  }

  protected async executeImpl(
    input: UpdateCustomerInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const { customerId, ...patch } = input;
      if (this.customersService) {
        const customer = await this.customersService.update(
          customerId,
          context.tenantId as string,
          patch,
        );
        return {
          success: true,
          data: {
            customerId: customer.id,
            name: customer.name,
            industry: customer.industry,
            primaryEmail: customer.primaryEmail,
            primaryPhone: customer.primaryPhone,
            billingInfo: customer.billingInfo,
            status: customer.status,
            tags: customer.tags,
            updatedAt: customer.updatedAt.toISOString(),
          },
          metadata: { model: 'neurecore-customer-v1' },
        };
      }
      return { success: false, error: 'CustomersService unavailable; refusing direct customer mutation' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update customer' };
    }
  }
}

@Injectable()
export class GetCustomerTool extends BaseStructuredTool {
  readonly name = 'getCustomer';
  readonly description =
    'Fetch a single customer by ID — includes name, industry, contact info, billing, status, tags, and recent projects. Use when the user asks "show me details for customer X" or when you need to confirm a customerId before linking it to a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCustomerInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly customersService?: CustomersService,
  ) {
    super();
  }

  protected async executeImpl(
    input: GetCustomerInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const customer = await this.data.customer.findFirst({
        where: { id: input.customerId, tenantId: context.tenantId as string },
        include: {
          _count: { select: { projects: true, contacts: true } },
        },
      });
      if (!customer) return { success: false, error: 'Customer not found' };
      return {
        success: true,
        data: {
          customerId: customer.id,
          name: customer.name,
          industry: customer.industry,
          primaryEmail: customer.primaryEmail,
          primaryPhone: customer.primaryPhone,
          billingInfo: customer.billingInfo as Record<string, unknown> | null,
          status: customer.status,
          tags: customer.tags,
          projectCount: customer._count.projects,
          contactCount: customer._count.contacts,
          createdAt: customer.createdAt.toISOString(),
          updatedAt: customer.updatedAt.toISOString(),
        },
        metadata: { model: 'neurecore-customer-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get customer' };
    }
  }
}

@Injectable()
export class ListCustomersTool extends BaseStructuredTool {
  readonly name = 'listCustomers';
  readonly description =
    'List customers for this tenant. Supports free-text search across name/industry/email and filter by status. Use when the user asks "who are our clients?" or "show me customers tagged X".';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListCustomersInputSchema;

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly customersService?: CustomersService,
  ) {
    super();
  }

  protected async executeImpl(
    input: ListCustomersInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.status) {
        where.status = input.status;
      }
      if (input.search && input.search.trim().length > 0) {
        const q = input.search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { industry: { contains: q, mode: 'insensitive' } },
          { primaryEmail: { contains: q, mode: 'insensitive' } },
        ];
      }
      const limit = input.limit ?? 20;
      const page = input.page ?? 1;
      const sortKey = input.sortKey ?? 'name';
      const sortDir = input.sortDir ?? 'asc';

      const [data, total] = await Promise.all([
        this.data.customer.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { [sortKey]: sortDir },
          select: {
            id: true,
            name: true,
            industry: true,
            primaryEmail: true,
            primaryPhone: true,
            status: true,
            tags: true,
            createdAt: true,
            _count: { select: { projects: true } },
          },
        }),
        this.data.customer.count({ where }),
      ]);

      return {
        success: true,
        data: {
          customers: data.map((c) => ({
            customerId: c.id,
            name: c.name,
            industry: c.industry,
            primaryEmail: c.primaryEmail,
            primaryPhone: c.primaryPhone,
            status: c.status,
            tags: c.tags,
            projectCount: c._count.projects,
            createdAt: c.createdAt.toISOString(),
          })),
          total,
          page,
          limit,
          hasMore: page * limit < total,
        },
        metadata: { model: 'neurecore-customer-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list customers' };
    }
  }
}

@Injectable()
export class FindCustomerByNameTool extends BaseStructuredTool {
  readonly name = 'findCustomerByName';
  readonly description =
    'Look up a customer by name (case-insensitive substring match). Returns the best match plus any other close matches. Use when the user says "the BlueStar client" and you need the customerId before creating a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = FindCustomerByNameInputSchema;

  constructor(private readonly data: ToolDataAccessService) {
    super();
  }

  protected async executeImpl(
    input: FindCustomerByNameInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const q = input.name.trim();
      const matches = await this.data.customer.findMany({
        where: {
          tenantId: context.tenantId as string,
          OR: [
            { name: { equals: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 10,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          industry: true,
          primaryEmail: true,
          status: true,
        },
      });
      return {
        success: true,
        data: {
          query: q,
          matchCount: matches.length,
          bestMatch: matches[0] ?? null,
          matches: matches.map((m) => ({
            customerId: m.id,
            name: m.name,
            industry: m.industry,
            primaryEmail: m.primaryEmail,
            status: m.status,
          })),
        },
        metadata: { model: 'neurecore-customer-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to find customer' };
    }
  }
}

@Injectable()
export class ArchiveCustomerTool extends BaseStructuredTool {
  readonly name = 'archiveCustomer';
  readonly description =
    'Soft-archive a customer. Sets status to ARCHIVED but preserves the row (and its project history). Use when the user says "archive the BlueStar client" — the customer remains queryable but stops appearing in active lists.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveCustomerInputSchema;
  readonly requiredPermissions = ['customer:archive'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly customersService?: CustomersService,
  ) {
    super();
  }

  protected async executeImpl(
    input: ArchiveCustomerInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (this.customersService) {
        const customer = await this.customersService.archive(input.customerId, context.tenantId as string);
        return {
          success: true,
          data: { customerId: customer.id, name: customer.name, previousStatus: 'ACTIVE', newStatus: customer.status },
          metadata: { model: 'neurecore-customer-v1' },
        };
      }
      return { success: false, error: 'CustomersService unavailable; refusing direct customer mutation' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive customer' };
    }
  }
}

@Injectable()
export class UnarchiveCustomerTool extends BaseStructuredTool {
  readonly name = 'unarchiveCustomer';
  readonly description =
    'Restore an archived customer to ACTIVE. Use when the user says "reactivate the BlueStar client".';
  readonly category = ToolCategory.API;
  readonly inputSchema = UnarchiveCustomerInputSchema;
  readonly requiredPermissions = ['customer:archive'];

  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly customersService?: CustomersService,
  ) {
    super();
  }

  protected async executeImpl(
    input: UnarchiveCustomerInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (this.customersService) {
        const customer = await this.customersService.unarchive(input.customerId, context.tenantId as string);
        return {
          success: true,
          data: { customerId: customer.id, name: customer.name, previousStatus: 'ARCHIVED', newStatus: customer.status },
          metadata: { model: 'neurecore-customer-v1' },
        };
      }
      return { success: false, error: 'CustomersService unavailable; refusing direct customer mutation' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to unarchive customer' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7 EXPANSION — 25 NEW HERMES TOOLS
// ═══════════════════════════════════════════════════════════════════════════
// These tools fill gaps where the LLM was hallucinating tool names
// (e.g. "query") instead of using existing functionality. Each tool
// follows the same pattern: Zod input schema + service-based execution.

// ─── New enums ───────────────────────────────────────────────────────────

const ProjectStatusAllEnum = z.enum(['LEAD', 'PROPOSAL_SENT', 'WON', 'LOST', 'ACTIVE', 'ON_HOLD', 'REVIEW', 'COMPLETED', 'ARCHIVED']);
const WorkflowStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']);
const GoalStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED']);
const StageStatusEnum = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']);
const NotificationTypeEnum = z.enum(['INFO', 'WARNING', 'ERROR', 'SUCCESS', 'TASK', 'APPROVAL', 'BUDGET', 'SYSTEM']);
const ProjectRoleEnum = z.enum([
  'PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'RESEARCH_LEAD', 'QUALITY_LEAD',
  'REVIEWER', 'COMPLIANCE_OFFICER', 'CLIENT_LIAISON', 'DOCUMENTATION_LEAD',
  'KNOWLEDGE_MANAGER', 'CHIEF_OF_STAFF',
]);
const ActorTypeEnum = z.enum(['HUMAN', 'AI', 'SYSTEM']);

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTS — Fill the most critical gap (no listProjects!)
// ═══════════════════════════════════════════════════════════════════════════

export const ListProjectsInputSchema = z.object({
  status: ProjectStatusAllEnum.optional(),
  departmentId: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional().describe('Search by project name (case-insensitive substring)'),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;

@Injectable()
export class ListProjectsTool extends BaseStructuredTool {
  readonly name = 'listProjects';
  readonly description = 'List projects in the workspace. Use when the user asks about projects, wants to see active work, or needs a project ID.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListProjectsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListProjectsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.status) where.status = input.status;
      if (input.departmentId) where.departmentId = input.departmentId;
      if (input.customerId) where.customerId = input.customerId;
      if (input.search) where.name = { contains: input.search, mode: 'insensitive' };
      const projects = await this.data.project.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, status: true, priority: true,
          budgetType: true, budgetAmount: true, budgetCurrency: true,
          targetDate: true, createdAt: true, customerId: true, departmentId: true,
        },
      });
      return {
        success: true,
        data: {
          projects: projects.map((p) => ({
            id: p.id, name: p.name, status: p.status, priority: p.priority,
            budgetType: p.budgetType, budgetAmount: p.budgetAmount?.toString() ?? null,
            budgetCurrency: p.budgetCurrency, targetDate: p.targetDate?.toISOString() ?? null,
            customerId: p.customerId, departmentId: p.departmentId,
            createdAt: p.createdAt.toISOString(),
          })),
          total: projects.length,
        },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list projects' };
    }
  }
}

export const SearchProjectsInputSchema = z.object({
  query: z.string().min(1).describe('Free-text search across project name and description'),
  limit: z.number().int().positive().max(50).default(10).optional(),
});
export type SearchProjectsInput = z.infer<typeof SearchProjectsInputSchema>;

@Injectable()
export class SearchProjectsTool extends BaseStructuredTool {
  readonly name = 'searchProjects';
  readonly description = 'Full-text search across project names and descriptions. Use when the user asks for projects matching a specific topic.';
  readonly category = ToolCategory.API;
  readonly inputSchema = SearchProjectsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: SearchProjectsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const projects = await this.data.project.findMany({
        where: {
          tenantId: context.tenantId as string,
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { description: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        take: input.limit ?? 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true, description: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          projects: projects.map((p) => ({
            id: p.id, name: p.name, status: p.status,
            description: p.description?.slice(0, 200) ?? null,
            createdAt: p.createdAt.toISOString(),
          })),
          total: projects.length,
        },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search projects' };
    }
  }
}

export const GetProjectByNameInputSchema = z.object({
  name: z.string().min(1).describe('Project name to look up (exact or close match)'),
});
export type GetProjectByNameInput = z.infer<typeof GetProjectByNameInputSchema>;

@Injectable()
export class GetProjectByNameTool extends BaseStructuredTool {
  readonly name = 'getProjectByName';
  readonly description = 'Find a project by its name (case-insensitive substring match). Returns the best match plus any close alternatives.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetProjectByNameInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetProjectByNameInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const matches = await this.data.project.findMany({
        where: {
          tenantId: context.tenantId as string,
          name: { contains: input.name, mode: 'insensitive' },
        },
        take: 5,
        select: { id: true, name: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      if (matches.length === 0) {
        return { success: false, error: `No project found matching "${input.name}"` };
      }
      return {
        success: true,
        data: {
          project: matches[0],
          alternatives: matches.slice(1),
          total: matches.length,
        },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to find project' };
    }
  }
}

export const UpdateProjectStatusInputSchema = z.object({
  projectId: z.string().describe('Project ID'),
  status: ProjectStatusAllEnum,
  lostReason: z.string().optional().describe('Required when status is LOST or CANCELLED'),
});
export type UpdateProjectStatusInput = z.infer<typeof UpdateProjectStatusInputSchema>;

@Injectable()
export class UpdateProjectStatusTool extends BaseStructuredTool {
  readonly name = 'updateProjectStatus';
  readonly description = 'Change a project status (LEAD → ACTIVE → COMPLETED, etc). Returns the updated project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateProjectStatusInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectsService?: ProjectsService,
  ) { super(); }

  protected async executeImpl(input: UpdateProjectStatusInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const existing = await this.data.project.findFirst({
        where: { id: input.projectId, tenantId: context.tenantId as string },
        select: { id: true, status: true },
      });
      if (!existing) return { success: false, error: 'Project not found' };

      if (input.status === 'LOST' && !input.lostReason) {
        return { success: false, error: `lostReason is required when setting status to ${input.status}` };
      }

      if (!this.projectsService) return { success: false, error: 'ProjectsService unavailable; refusing direct project mutation' };
      const project = await this.projectsService.transitionStatus(input.projectId, context.tenantId as string, input.status as never, input.lostReason);
      return {
        success: true,
        data: { previousStatus: existing.status, project },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update project status' };
    }
  }
}

export const AddProjectMemberInputSchema = z.object({
  projectId: z.string(),
  actorId: z.string().describe('Agent or user ID to add as a member'),
  actorType: ActorTypeEnum.default('HUMAN'),
  role: ProjectRoleEnum.default('PROJECT_MANAGER'),
});
export type AddProjectMemberInput = z.infer<typeof AddProjectMemberInputSchema>;

@Injectable()
export class AddProjectMemberTool extends BaseStructuredTool {
  readonly name = 'addProjectMember';
  readonly description = 'Add an agent or user to a project as a member with a specific role.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AddProjectMemberInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectMembersService?: ProjectMembersService,
  ) { super(); }

  protected async executeImpl(input: AddProjectMemberInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({
        where: { id: input.projectId, tenantId: context.tenantId as string },
        select: { id: true },
      });
      if (!project) return { success: false, error: 'Project not found' };

      if (!this.projectMembersService) return { success: false, error: 'ProjectMembersService unavailable; refusing direct project member mutation' };
      const member = await this.projectMembersService.assign(input.projectId, context.tenantId as string, {
        actorId: input.actorId,
        actorType: input.actorType as never,
        role: input.role as never,
      });
      return {
        success: true,
        data: { memberId: member.id, projectId: member.projectId, actorId: member.actorId, role: member.role, assignedAt: member.assignedAt.toISOString() },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add project member' };
    }
  }
}

export const RemoveProjectMemberInputSchema = z.object({
  projectId: z.string(),
  memberId: z.string().describe('ProjectMember ID (not the actor ID)'),
});
export type RemoveProjectMemberInput = z.infer<typeof RemoveProjectMemberInputSchema>;

@Injectable()
export class RemoveProjectMemberTool extends BaseStructuredTool {
  readonly name = 'removeProjectMember';
  readonly description = 'Remove a member from a project by their ProjectMember ID.';
  readonly category = ToolCategory.API;
  readonly inputSchema = RemoveProjectMemberInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectMembersService?: ProjectMembersService,
  ) { super(); }

  protected async executeImpl(input: RemoveProjectMemberInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const member = await this.data.projectMember.findFirst({
        where: { id: input.memberId, projectId: input.projectId },
        select: { id: true },
      });
      if (!member) return { success: false, error: 'Member not found on this project' };
      if (!this.projectMembersService) return { success: false, error: 'ProjectMembersService unavailable; refusing direct project member mutation' };
      await this.projectMembersService.remove(input.projectId, context.tenantId as string, input.memberId);
      return { success: true, data: { memberId: input.memberId, removed: true }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove project member' };
    }
  }
}

export const ListProjectMembersInputSchema = z.object({
  projectId: z.string(),
});
export type ListProjectMembersInput = z.infer<typeof ListProjectMembersInputSchema>;

@Injectable()
export class ListProjectMembersTool extends BaseStructuredTool {
  readonly name = 'listProjectMembers';
  readonly description = 'List all members (agents and humans) on a project with their roles.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListProjectMembersInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListProjectMembersInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.data.project.findFirst({
        where: { id: input.projectId, tenantId: context.tenantId as string },
        select: { id: true, name: true },
      });
      if (!project) return { success: false, error: 'Project not found' };

      const members = await this.data.projectMember.findMany({
        where: { projectId: input.projectId },
        orderBy: { assignedAt: 'asc' },
      });
      const agentIds = members.filter((m) => m.actorType === 'AI').map((m) => m.actorId);
      const agents: Array<{ id: string; name: string; status: string }> = agentIds.length > 0
        ? await this.data.agent.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, status: true },
          })
        : [];
      const agentMap = new Map(agents.map((a) => [a.id, a]));

      return {
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          members: members.map((m) => ({
            id: m.id,
            actorId: m.actorId,
            actorType: m.actorType,
            role: m.role,
            assignedAt: m.assignedAt.toISOString(),
            actorName: agentMap.get(m.actorId)?.name ?? m.actorId,
            actorStatus: agentMap.get(m.actorId)?.status ?? null,
          })),
          total: members.length,
        },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list project members' };
    }
  }
}

export const ListProjectStagesInputSchema = z.object({
  projectId: z.string(),
});
export type ListProjectStagesInput = z.infer<typeof ListProjectStagesInputSchema>;

@Injectable()
export class ListProjectStagesTool extends BaseStructuredTool {
  readonly name = 'listProjectStages';
  readonly description = 'List the stages (milestones) of a project in order with their statuses.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListProjectStagesInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListProjectStagesInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const stages = await this.data.projectStage.findMany({
        where: { projectId: input.projectId },
        orderBy: { order: 'asc' },
        select: { id: true, name: true, description: true, order: true, status: true, startDate: true, endDate: true },
      });
      return {
        success: true,
        data: {
          projectId: input.projectId,
          stages: stages.map((s) => ({
            ...s,
            startDate: s.startDate?.toISOString() ?? null,
            endDate: s.endDate?.toISOString() ?? null,
          })),
          total: stages.length,
        },
        metadata: { model: 'neurecore-project-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list project stages' };
    }
  }
}

export const UpdateProjectStageInputSchema = z.object({
  stageId: z.string(),
  status: StageStatusEnum.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});
export type UpdateProjectStageInput = z.infer<typeof UpdateProjectStageInputSchema>;

@Injectable()
export class UpdateProjectStageTool extends BaseStructuredTool {
  readonly name = 'updateProjectStage';
  readonly description = 'Update a project stage (rename, change description, or mark status).';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateProjectStageInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly projectStagesService?: ProjectStagesService,
  ) { super(); }

  protected async executeImpl(input: UpdateProjectStageInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const data: Record<string, unknown> = {};
      if (input.status) data.status = input.status;
      if (input.name) data.name = input.name;
      if (input.description !== undefined) data.description = input.description;
      if (Object.keys(data).length === 0) {
        return { success: false, error: 'No fields to update' };
      }
      const existing = await this.data.projectStage.findFirst({
        where: { id: input.stageId, project: { tenantId: context.tenantId as string } },
        select: { id: true, projectId: true },
      });
      if (!existing) return { success: false, error: 'Project stage not found' };
      if (!this.projectStagesService) return { success: false, error: 'ProjectStagesService unavailable; refusing direct project stage mutation' };
      const stage = await this.projectStagesService.update(existing.projectId, context.tenantId as string, input.stageId, data as never);
      return { success: true, data: { stage }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update project stage' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOWS
// ═══════════════════════════════════════════════════════════════════════════

export const ListWorkflowsInputSchema = z.object({
  status: WorkflowStatusEnum.optional(),
  isActive: z.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});
export type ListWorkflowsInput = z.infer<typeof ListWorkflowsInputSchema>;

@Injectable()
export class ListWorkflowsTool extends BaseStructuredTool {
  readonly name = 'listWorkflows';
  readonly description = 'List workflows in the workspace. Use when user asks about automations, DAGs, or repeatable task sequences.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListWorkflowsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListWorkflowsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.status) where.status = input.status;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      const workflows = await this.data.workflow.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, description: true, status: true, isActive: true,
          executionCount: true, successRate: true, lastExecutedAt: true, createdAt: true,
        },
      });
      return {
        success: true,
        data: {
          workflows: workflows.map((w) => ({
            ...w,
            lastExecutedAt: w.lastExecutedAt?.toISOString() ?? null,
            createdAt: w.createdAt.toISOString(),
          })),
          total: workflows.length,
        },
        metadata: { model: 'neurecore-workflow-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list workflows' };
    }
  }
}

export const GetWorkflowInputSchema = z.object({
  workflowId: z.string(),
});
export type GetWorkflowInput = z.infer<typeof GetWorkflowInputSchema>;

@Injectable()
export class GetWorkflowTool extends BaseStructuredTool {
  readonly name = 'getWorkflow';
  readonly description = 'Get a single workflow by ID including its DAG definition and execution history.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetWorkflowInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetWorkflowInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const workflow = await this.data.workflow.findFirst({
        where: { id: input.workflowId, tenantId: context.tenantId as string },
        select: {
          id: true, name: true, description: true, status: true, isActive: true,
          executionCount: true, successRate: true,
          lastExecutedAt: true, createdAt: true, updatedAt: true,
        },
      });
      if (!workflow) return { success: false, error: 'Workflow not found' };
      const recentExecutions = await this.data.workflowExecution.findMany({
        where: { workflowId: input.workflowId },
        take: 5,
        orderBy: { startedAt: 'desc' },
        select: { id: true, status: true, startedAt: true, completedAt: true },
      });
      return {
        success: true,
        data: {
          workflow: {
            ...workflow,
            lastExecutedAt: workflow.lastExecutedAt?.toISOString() ?? null,
            createdAt: workflow.createdAt.toISOString(),
            updatedAt: workflow.updatedAt.toISOString(),
          },
          recentExecutions: recentExecutions.map((r) => ({
            ...r,
            startedAt: r.startedAt.toISOString(),
            completedAt: r.completedAt?.toISOString() ?? null,
          })),
        },
        metadata: { model: 'neurecore-workflow-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get workflow' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════════════════════

export const ListGoalsInputSchema = z.object({
  status: GoalStatusEnum.optional(),
  parentId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});
export type ListGoalsInput = z.infer<typeof ListGoalsInputSchema>;

@Injectable()
export class ListGoalsTool extends BaseStructuredTool {
  readonly name = 'listGoals';
  readonly description = 'List goals in the workspace. Use when user asks about objectives, OKRs, or progress.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListGoalsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListGoalsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.status) where.status = input.status;
      if (input.parentId) where.parentId = input.parentId;
      const goals = await this.data.goal.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, description: true, status: true, progress: true, level: true, parentId: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          goals: goals.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })),
          total: goals.length,
        },
        metadata: { model: 'neurecore-goal-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list goals' };
    }
  }
}

export const UpdateGoalProgressInputSchema = z.object({
  goalId: z.string(),
  progress: z.number().int().min(0).max(100).describe('Progress percentage 0-100'),
  status: GoalStatusEnum.optional(),
});
export type UpdateGoalProgressInput = z.infer<typeof UpdateGoalProgressInputSchema>;

@Injectable()
export class UpdateGoalProgressTool extends BaseStructuredTool {
  readonly name = 'updateGoalProgress';
  readonly description = "Update a goal's progress percentage (0-100) and optionally its status.";
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateGoalProgressInputSchema;
  constructor(
    private readonly data: ToolDataAccessService,
    @Optional() private readonly goalsService?: GoalsService,
  ) { super(); }

  protected async executeImpl(input: UpdateGoalProgressInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      if (!this.goalsService) return { success: false, error: 'GoalsService unavailable; refusing direct goal mutation' };
      const goal = await this.goalsService.update(input.goalId, context.tenantId as string, {
        progress: input.progress,
        ...(input.progress >= 100
          ? { status: 'COMPLETED' as const }
          : input.status
            ? { status: input.status as 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED' }
            : {}),
      } as never);
      return { success: true, data: { goal }, metadata: { model: 'neurecore-goal-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update goal progress' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BUDGET POLICIES
// ═══════════════════════════════════════════════════════════════════════════

export const ListBudgetPoliciesInputSchema = z.object({
  scope: z.enum(['TENANT', 'DEPARTMENT', 'AGENT', 'PROJECT']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});
export type ListBudgetPoliciesInput = z.infer<typeof ListBudgetPoliciesInputSchema>;

@Injectable()
export class ListBudgetPoliciesTool extends BaseStructuredTool {
  readonly name = 'listBudgetPolicies';
  readonly description = 'List budget policies (spending caps) at tenant, department, agent, or project scope.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListBudgetPoliciesInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListBudgetPoliciesInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.scope) where.scope = input.scope;
      const policies = await this.data.budgetPolicy.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, limitCents: true, period: true, scope: true, currentSpendCents: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          policies: policies.map((p) => ({
            ...p,
            limitCents: p.limitCents?.toString() ?? null,
            currentSpendCents: p.currentSpendCents?.toString() ?? null,
            createdAt: p.createdAt.toISOString(),
          })),
          total: policies.length,
        },
        metadata: { model: 'neurecore-budget-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list budget policies' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPARTMENTS — Additional read tools
// ═══════════════════════════════════════════════════════════════════════════

export const GetDepartmentInputSchema = z.object({
  departmentId: z.string().optional(),
  name: z.string().optional().describe('Look up department by name (exact match preferred)'),
});
export type GetDepartmentInput = z.infer<typeof GetDepartmentInputSchema>;

@Injectable()
export class GetDepartmentTool extends BaseStructuredTool {
  readonly name = 'getDepartment';
  readonly description = 'Get a single department by ID or name with agent/member counts and manager info.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetDepartmentInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!input.departmentId && !input.name) {
      return { success: false, error: 'Either departmentId or name is required' };
    }
    try {
      const department = input.departmentId
        ? await this.data.department.findFirst({
            where: { id: input.departmentId, tenantId: context.tenantId as string },
          })
        : await this.data.department.findFirst({
            where: { tenantId: context.tenantId as string, name: input.name! },
          });
      if (!department) return { success: false, error: 'Department not found' };
      const [agentCount, runningAgentCount] = await Promise.all([
        this.data.agent.count({ where: { departmentId: department.id } }),
        this.data.agent.count({ where: { departmentId: department.id, status: 'RUNNING' } }),
      ]);
      return {
        success: true,
        data: {
          department: {
            id: department.id,
            name: department.name,
            description: department.description,
            status: department.status,
            headAgentId: department.headAgentId,
            agentCount,
            runningAgentCount,
            createdAt: department.createdAt.toISOString(),
          },
        },
        metadata: { model: 'neurecore-dept-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get department' };
    }
  }
}

export const ListDepartmentMembersInputSchema = z.object({
  departmentId: z.string(),
  status: AgentStatusEnum.optional(),
});
export type ListDepartmentMembersInput = z.infer<typeof ListDepartmentMembersInputSchema>;

@Injectable()
export class ListDepartmentMembersTool extends BaseStructuredTool {
  readonly name = 'listDepartmentMembers';
  readonly description = 'List all agents that belong to a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListDepartmentMembersInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListDepartmentMembersInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { departmentId: input.departmentId };
      if (input.status) where.status = input.status;
      const agents = await this.data.agent.findMany({
        where: { departmentId: input.departmentId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true, status: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          departmentId: input.departmentId,
          agents: agents.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
          total: agents.length,
        },
        metadata: { model: 'neurecore-agent-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list department members' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS — Additional tools
// ═══════════════════════════════════════════════════════════════════════════

export const ListAgentsByDepartmentInputSchema = z.object({
  departmentId: z.string(),
  status: AgentStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50).optional(),
});
export type ListAgentsByDepartmentInput = z.infer<typeof ListAgentsByDepartmentInputSchema>;

@Injectable()
export class ListAgentsByDepartmentTool extends BaseStructuredTool {
  readonly name = 'listAgentsByDepartment';
  readonly description = 'List all agents in a specific department. More targeted than listAgents when user names a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListAgentsByDepartmentInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListAgentsByDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { departmentId: input.departmentId };
      if (input.status) where.status = input.status;
      const agents = await this.data.agent.findMany({
        where,
        take: input.limit ?? 50,
        orderBy: [{ name: 'asc' }],
        select: { id: true, name: true, type: true, status: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          departmentId: input.departmentId,
          agents: agents.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
          total: agents.length,
        },
        metadata: { model: 'neurecore-agent-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list agents' };
    }
  }
}

export const SearchAgentsInputSchema = z.object({
  query: z.string().min(1).describe('Search query for agent name or role'),
  limit: z.coerce.number().int().positive().max(50).default(10).optional(),
});
export type SearchAgentsInput = z.infer<typeof SearchAgentsInputSchema>;

@Injectable()
export class SearchAgentsTool extends BaseStructuredTool {
  readonly name = 'searchAgents';
  readonly description = 'Search agents by name or role across the workspace.';
  readonly category = ToolCategory.API;
  readonly inputSchema = SearchAgentsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: SearchAgentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agents = await this.data.agent.findMany({
        where: {
          tenantId: context.tenantId as string,
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { description: { contains: input.query, mode: 'insensitive' } },
          ],
        },
        take: input.limit ?? 10,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true, status: true, departmentId: true, description: true },
      });
      return {
        success: true,
        data: { agents, total: agents.length },
        metadata: { model: 'neurecore-agent-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search agents' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMERS — Additional tools
// ═══════════════════════════════════════════════════════════════════════════

export const GetCustomerProjectsInputSchema = z.object({
  customerId: z.string(),
});
export type GetCustomerProjectsInput = z.infer<typeof GetCustomerProjectsInputSchema>;

@Injectable()
export class GetCustomerProjectsTool extends BaseStructuredTool {
  readonly name = 'getCustomerProjects';
  readonly description = 'Get all projects that belong to a specific customer.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCustomerProjectsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetCustomerProjectsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const customer = await this.data.customer.findFirst({
        where: { id: input.customerId, tenantId: context.tenantId as string },
        select: { id: true, name: true },
      });
      if (!customer) return { success: false, error: 'Customer not found' };
      const projects = await this.data.project.findMany({
        where: { customerId: input.customerId, tenantId: context.tenantId as string },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true, budgetAmount: true, budgetCurrency: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          customer,
          projects: projects.map((p) => ({
            ...p,
            budgetAmount: p.budgetAmount?.toString() ?? null,
            createdAt: p.createdAt.toISOString(),
          })),
          total: projects.length,
        },
        metadata: { model: 'neurecore-customer-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get customer projects' };
    }
  }
}

export const ListCustomerContactsInputSchema = z.object({
  customerId: z.string(),
});
export type ListCustomerContactsInput = z.infer<typeof ListCustomerContactsInputSchema>;

@Injectable()
export class ListCustomerContactsTool extends BaseStructuredTool {
  readonly name = 'listCustomerContacts';
  readonly description = 'List contacts associated with a customer (primary, billing, technical, etc).';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListCustomerContactsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListCustomerContactsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const customer = await this.data.customer.findFirst({
        where: { id: input.customerId, tenantId: context.tenantId as string },
        select: { id: true, name: true },
      });
      if (!customer) return { success: false, error: 'Customer not found' };
      const contacts = await this.data.customerContact.findMany({
        where: { customerId: input.customerId },
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      });
      return {
        success: true,
        data: {
          customer,
          contacts: contacts.map((c) => ({
            id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.role,
            isPrimary: c.isPrimary, createdAt: c.createdAt.toISOString(),
          })),
          total: contacts.length,
        },
        metadata: { model: 'neurecore-customer-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list customer contacts' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS — Additional tools
// ═══════════════════════════════════════════════════════════════════════════

export const ListAllNotificationsInputSchema = z.object({
  unreadOnly: z.boolean().default(false).optional(),
  type: NotificationTypeEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});
export type ListAllNotificationsInput = z.infer<typeof ListAllNotificationsInputSchema>;

@Injectable()
export class ListAllNotificationsTool extends BaseStructuredTool {
  readonly name = 'listAllNotifications';
  readonly description = 'List all tenant notifications (across all users). Use for admin/dashboard views.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListAllNotificationsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListAllNotificationsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.unreadOnly) where.isRead = false;
      if (input.type) where.type = input.type;
      const notifications = await this.data.notification.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, title: true, message: true, isRead: true, userId: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          notifications: notifications.map((n) => ({
            ...n,
            message: n.message.slice(0, 200),
            createdAt: n.createdAt.toISOString(),
          })),
          total: notifications.length,
        },
        metadata: { model: 'neurecore-notification-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list notifications' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED
// ═══════════════════════════════════════════════════════════════════════════

export const GetActivityFeedInputSchema = z.object({
  since: z.string().optional().describe('ISO timestamp; only events after this are returned'),
  limit: z.coerce.number().int().positive().max(100).default(30).optional(),
  entityType: z.string().optional().describe('Filter by entity type (PROJECT, TASK, AGENT, etc)'),
});
export type GetActivityFeedInput = z.infer<typeof GetActivityFeedInputSchema>;

@Injectable()
export class GetActivityFeedTool extends BaseStructuredTool {
  readonly name = 'getActivityFeed';
  readonly description = 'Get recent activity events for the workspace (project created, task completed, etc).';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetActivityFeedInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetActivityFeedInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.since) where.createdAt = { gte: new Date(input.since) };
      if (input.entityType) where.entityType = input.entityType;
      const events = await this.data.activityEvent.findMany({
        where,
        take: input.limit ?? 30,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, actorType: true, actorId: true, type: true, title: true,
          description: true, entityType: true, entityId: true, severity: true, createdAt: true,
        },
      });
      return {
        success: true,
        data: {
          events: events.map((e) => ({
            ...e,
            description: e.description?.slice(0, 200) ?? null,
            createdAt: e.createdAt.toISOString(),
          })),
          total: events.length,
        },
        metadata: { model: 'neurecore-activity-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get activity feed' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVALS — Additional tools
// ═══════════════════════════════════════════════════════════════════════════

export const ListMyApprovalHistoryInputSchema = z.object({
  status: ApprovalStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20).optional(),
});
export type ListMyApprovalHistoryInput = z.infer<typeof ListMyApprovalHistoryInputSchema>;

@Injectable()
export class ListMyApprovalHistoryTool extends BaseStructuredTool {
  readonly name = 'listMyApprovalHistory';
  readonly description = 'List approvals I have actioned (approved/rejected), as opposed to those still pending.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListMyApprovalHistoryInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: ListMyApprovalHistoryInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context?.userId) return { success: false, error: 'User context required' };
    try {
      const where: Record<string, unknown> = {
        tenantId: context.tenantId,
        reviewedById: context.userId,
        status: { in: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'] },
      };
      if (input.status) where.status = input.status;
      const approvals = await this.data.approvalRequest.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, approvedAt: true, rejectedAt: true, rejectionReason: true, resourceType: true, resourceId: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          approvals: approvals.map((a) => ({
            id: a.id, title: a.title, status: a.status,
            approvedAt: a.approvedAt?.toISOString() ?? null,
            rejectedAt: a.rejectedAt?.toISOString() ?? null,
            reason: a.rejectionReason,
            resourceType: a.resourceType, resourceId: a.resourceId,
            createdAt: a.createdAt.toISOString(),
          })),
          total: approvals.length,
        },
        metadata: { model: 'neurecore-approval-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list approval history' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS — Additional tools
// ═══════════════════════════════════════════════════════════════════════════

export const SearchTasksInputSchema = z.object({
  query: z.string().min(1).describe('Search by task title or description'),
  status: TaskStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(50).default(20).optional(),
});
export type SearchTasksInput = z.infer<typeof SearchTasksInputSchema>;

@Injectable()
export class SearchTasksTool extends BaseStructuredTool {
  readonly name = 'searchTasks';
  readonly description = 'Full-text search across task titles and descriptions.';
  readonly category = ToolCategory.API;
  readonly inputSchema = SearchTasksInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: SearchTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = {
        tenantId: context.tenantId,
        OR: [
          { title: { contains: input.query, mode: 'insensitive' } },
          { description: { contains: input.query, mode: 'insensitive' } },
        ],
      };
      if (input.status) where.status = input.status;
      const tasks = await this.data.task.findMany({
        where,
        take: input.limit ?? 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true, priority: true, agentId: true, createdAt: true },
      });
      return {
        success: true,
        data: {
          tasks: tasks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })),
          total: tasks.length,
        },
        metadata: { model: 'neurecore-task-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search tasks' };
    }
  }
}

export const GetTaskStatsInputSchema = z.object({
  agentId: z.string().optional().describe('Stats for a specific agent'),
  departmentId: z.string().optional().describe('Stats for a specific department'),
});
export type GetTaskStatsInput = z.infer<typeof GetTaskStatsInputSchema>;

@Injectable()
export class GetTaskStatsTool extends BaseStructuredTool {
  readonly name = 'getTaskStats';
  readonly description = 'Get task statistics: counts by status, by priority, overdue count. Optionally filter by agent or department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTaskStatsInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GetTaskStatsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const baseWhere: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.agentId) baseWhere.agentId = input.agentId;
      if (input.departmentId) baseWhere.departmentId = input.departmentId;

      const [byStatus, byPriority, overdueCount] = await Promise.all([
        this.data.task.groupBy({
          by: ['status'],
          where: baseWhere,
          _count: { _all: true },
        }),
        this.data.task.groupBy({
          by: ['priority'],
          where: baseWhere,
          _count: { _all: true },
        }),
        this.data.task.count({
          where: { ...baseWhere, status: { in: ['PENDING', 'QUEUED', 'RUNNING'] }, scheduledAt: { lt: new Date() } },
        }),
      ]);

      const statusMap = Object.fromEntries(byStatus.map((b) => [b.status, b._count._all]));
      const priorityMap = Object.fromEntries(byPriority.map((b) => [b.priority, b._count._all]));
      const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

      return {
        success: true,
        data: {
          total,
          byStatus: statusMap,
          byPriority: priorityMap,
          overdueCount,
          filter: { agentId: input.agentId ?? null, departmentId: input.departmentId ?? null },
        },
        metadata: { model: 'neurecore-task-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get task stats' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════

export const GlobalSearchInputSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  limit: z.coerce.number().int().positive().max(50).default(10).optional(),
});
export type GlobalSearchInput = z.infer<typeof GlobalSearchInputSchema>;

@Injectable()
export class GlobalSearchTool extends BaseStructuredTool {
  readonly name = 'globalSearch';
  readonly description = 'Search across projects, tasks, agents, customers, and departments in one call. Returns mixed results grouped by entity type.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GlobalSearchInputSchema;
  constructor(private readonly data: ToolDataAccessService) { super(); }

  protected async executeImpl(input: GlobalSearchInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenantId = context.tenantId as string;
      const limit = input.limit ?? 10;
      const [projects, tasks, agents, customers, departments] = await Promise.all([
        this.data.project.findMany({
          where: { tenantId, OR: [{ name: { contains: input.query, mode: 'insensitive' } }, { description: { contains: input.query, mode: 'insensitive' } }] },
          take: limit,
          select: { id: true, name: true, status: true },
        }),
        this.data.task.findMany({
          where: { tenantId, OR: [{ title: { contains: input.query, mode: 'insensitive' } }, { description: { contains: input.query, mode: 'insensitive' } }] },
          take: limit,
          select: { id: true, title: true, status: true },
        }),
        this.data.agent.findMany({
          where: { tenantId, OR: [{ name: { contains: input.query, mode: 'insensitive' } }, { description: { contains: input.query, mode: 'insensitive' } }] },
          take: limit,
          select: { id: true, name: true, type: true, status: true },
        }),
        this.data.customer.findMany({
          where: { tenantId, OR: [{ name: { contains: input.query, mode: 'insensitive' } }] },
          take: limit,
          select: { id: true, name: true, status: true },
        }),
        this.data.department.findMany({
          where: { tenantId, OR: [{ name: { contains: input.query, mode: 'insensitive' } }] },
          take: limit,
          select: { id: true, name: true, status: true },
        }),
      ]);

      return {
        success: true,
        data: {
          query: input.query,
          total: projects.length + tasks.length + agents.length + customers.length + departments.length,
          projects, tasks, agents, customers, departments,
        },
        metadata: { model: 'neurecore-search-v1' },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to perform global search' };
    }
  }
}
