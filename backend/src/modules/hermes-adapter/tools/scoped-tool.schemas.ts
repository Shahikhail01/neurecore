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
  'nc.score_lead',
  'nc.next_best_step',
  'nc.forecast_pipeline',
  'nc.generate_quote',
  'nc.resolve_case',
  'nc.search_kb',
  'nc.customer_360',
  'nc.run_ai_twin',
  'nc.dispatch_channel',
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
  }).strict(),
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
  'nc.score_lead': z.object({ leadId: z.string().uuid() }).strict(),
  'nc.next_best_step': z.object({
    dealId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
  }).strict().refine((v) => !!v.dealId || !!v.contactId, {
    message: 'either dealId or contactId is required',
  }),
  'nc.forecast_pipeline': z.object({
    quarter: z.string().optional(),
    horizonDays: z.number().int().min(1).max(365).optional(),
  }).strict(),
  'nc.generate_quote': z.object({
    dealId: z.string().uuid(),
    items: z.array(z.object({ sku: z.string(), quantity: z.number().int().min(1), unitPrice: z.number() }).strict()).min(1),
  }).strict(),
  'nc.resolve_case': z.object({
    caseId: z.string().uuid(),
    action: z.enum(['classify', 'suggest', 'draft_reply']),
  }).strict(),
  'nc.search_kb': z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).optional(),
  }).strict(),
  'nc.customer_360': z.object({ customerId: z.string().uuid() }).strict(),
  'nc.run_ai_twin': z.object({ twinId: z.string().uuid(), intent: z.string().min(1) }).strict(),
  'nc.dispatch_channel': z.object({
    channelKind: z.string(),
    targetId: z.string(),
    payload: z.record(z.unknown()),
  }).strict(),
};

export const approvalRequiredTools = new Set<NcToolName>([
  'nc.create_customer',
  'nc.create_project',
  'nc.send_notification',
  'nc.score_lead',
  'nc.next_best_step',
  'nc.generate_quote',
  'nc.resolve_case',
  'nc.run_ai_twin',
  'nc.dispatch_channel',
]);
