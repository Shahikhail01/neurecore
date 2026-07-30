import { z } from 'zod';

export const NC_TOOL_NAMES = [
  'nc.plan_workflow',
  'nc.list_customers',
  'nc.create_customer',
  'nc.create_project',
  'nc.create_goal',
  'nc.create_task',
  'nc.assign_task',
  'nc.update_task_status',
  'nc.submit_for_approval',
  'nc.send_notification',
  'nc.search_memory',
] as const;

export type NcToolName = (typeof NC_TOOL_NAMES)[number];

const id = z.union([z.string().uuid(), z.string().cuid()]);
const text = z.string().trim().min(1);

export const ncToolSchemas: Record<NcToolName, z.ZodTypeAny> = {
  'nc.plan_workflow': z.object({
    steps: z.array(z.object({
      order: z.number().int().min(1),
      action: text,
      tool: z.string().optional(),
      rationale: z.string().optional(),
    })).min(1),
  }).passthrough(),
  'nc.list_customers': z.object({ query: z.string().default(''), limit: z.number().int().min(1).max(50).default(10) }).strict(),
  'nc.create_customer': z.object({
    name: text,
    financialSubType: z.enum(['BANKING', 'INSURANCE', 'WEALTH_MANAGEMENT', 'INVESTMENT', 'FINTECH', 'ACCOUNTING_AUDIT']),
    lifecycleStage: z.enum(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED']),
  }).strict(),
  'nc.create_project': z.object({ name: text, customerId: id, projectTypeId: id, stageTemplate: z.array(z.object({ name: text, description: z.string().optional() }).strict()).min(1) }).strict(),
  'nc.create_goal': z.object({ projectId: id, name: text, description: text }).strict(),
  'nc.create_task': z.object({ projectId: id, goalId: id, title: text, dueDate: z.string().datetime() }).strict(),
  'nc.assign_task': z.object({ taskId: id, agentProfileId: id }).strict(),
  'nc.update_task_status': z.object({ taskId: id, status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']), evidence: z.record(z.unknown()).optional() }).strict(),
  'nc.submit_for_approval': z.object({ entityType: text, entityId: id, payload: z.record(z.unknown()) }).strict(),
  'nc.send_notification': z.object({ userId: id, title: text, body: text, link: z.string().max(2048) }).strict(),
  'nc.search_memory': z.object({ query: text, limit: z.number().int().min(1).max(50).default(10) }).strict(),
};

export const approvalRequiredTools = new Set<NcToolName>([
  'nc.create_customer',
  'nc.create_project',
  'nc.send_notification',
]);
