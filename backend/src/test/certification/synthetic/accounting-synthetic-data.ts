// src/test/certification/synthetic/accounting-synthetic-data.ts
/**
 * Phase 9 — Synthetic accounting dataset generator.
 *
 * Produces deterministic, per-run-isolated synthetic data for the
 * golden-path bookkeeping scenario. All identifiers embed the run
 * id so cleanup is exact and never touches unrelated tenant data.
 *
 * NC-AWL-IMP-1 §2.6 / §11.1: deterministic tenant provisioning,
 * synthetic accounting data, unique run IDs, record labeling.
 */

import { createHash, randomUUID } from 'crypto';

export interface SyntheticCustomer {
  id: string;
  tenantId: string;
  name: string;
  industry: string;
  runId: string;
}

export interface SyntheticProject {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  goal: string;
  runId: string;
}

export interface SyntheticTask {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  runId: string;
}

export interface SyntheticAIAgent {
  id: string;
  tenantId: string;
  role: string;
  capabilities: string[];
  runId: string;
}

export interface SyntheticAccountingDataset {
  runId: string;
  customer: SyntheticCustomer;
  project: SyntheticProject;
  tasks: SyntheticTask[];
  agents: SyntheticAIAgent[];
  attachments: SyntheticAttachment[];
  bankStatements: SyntheticBankStatement[];
}

export interface SyntheticAttachment {
  id: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  runId: string;
}

export interface SyntheticBankStatement {
  id: string;
  tenantId: string;
  accountNumber: string;
  month: string;
  openingBalance: number;
  closingBalance: number;
  transactionCount: number;
  runId: string;
}

const ACCOUNTING_CUSTOMER_NAMES = [
  'Acme Accounting LLC',
  'Beacon Hill Bookkeeping',
  'Cedar & Pine CPA',
  'Northbridge Financial',
  'Riverside Ledger Co.',
];

const ACCOUNTING_PROJECT_NAMES = [
  'Monthly Close Q3 2026',
  'Year-End Reconciliation 2026',
  'Quarterly Bookkeeping Review',
  'Annual Audit Preparation 2026',
  'Tax Preparation FY2026',
];

const ACCOUNTING_TASK_TITLES = [
  'Reconcile bank statements',
  'Categorize transactions',
  'Review general ledger',
  'Prepare journal entries',
  'Verify accounts payable',
  'Generate trial balance',
  'Reconcile credit card accounts',
  'Process payroll entries',
  'Review fixed asset register',
  'Prepare financial statements',
];

const ACCOUNTING_AGENT_CAPS = [
  ['data_entry', 'reconciliation', 'reporting'],
  ['bookkeeping', 'journal_entries', 'reporting'],
  ['reconciliation', 'audit', 'compliance'],
];

export function generateSyntheticDataset(
  tenantId: string,
  seedRunId?: string,
): SyntheticAccountingDataset {
  const runId = seedRunId ?? `run-${randomUUID()}`;

  const customerId = `cust-${runId}`;
  const projectId = `proj-${runId}`;

  const customer: SyntheticCustomer = {
    id: customerId,
    tenantId,
    name: pickDeterministic(ACCOUNTING_CUSTOMER_NAMES, runId),
    industry: 'accounting',
    runId,
  };

  const project: SyntheticProject = {
    id: projectId,
    tenantId,
    customerId,
    name: pickDeterministic(ACCOUNTING_PROJECT_NAMES, runId),
    goal: 'Complete monthly accounting close with reconciled books',
    runId,
  };

  const tasks: SyntheticTask[] = ACCOUNTING_TASK_TITLES.slice(0, 6).map(
    (title, idx) => ({
      id: `task-${runId}-${idx}`,
      tenantId,
      projectId,
      title,
      runId,
    }),
  );

  const agents: SyntheticAIAgent[] = [
    {
      id: `agent-${runId}-primary`,
      tenantId,
      role: 'Staff Accountant',
      capabilities: ACCOUNTING_AGENT_CAPS[0],
      runId,
    },
    {
      id: `agent-${runId}-backup`,
      tenantId,
      role: 'Senior Accountant',
      capabilities: ACCOUNTING_AGENT_CAPS[1],
      runId,
    },
  ];

  const attachments: SyntheticAttachment[] = [
    {
      id: `att-${runId}-bank-stmt`,
      tenantId,
      filename: `bank-statement-${runId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 24576,
      checksum: sha256(`bank-stmt-${runId}`),
      runId,
    },
    {
      id: `att-${runId}-ledger`,
      tenantId,
      filename: `general-ledger-${runId}.csv`,
      mimeType: 'text/csv',
      sizeBytes: 8192,
      checksum: sha256(`ledger-${runId}`),
      runId,
    },
  ];

  const bankStatements: SyntheticBankStatement[] = [
    {
      id: `stmt-${runId}-checking`,
      tenantId,
      accountNumber: maskedAccount(runId, 0),
      month: '2026-07',
      openingBalance: 12500.5,
      closingBalance: 8923.18,
      transactionCount: 47,
      runId,
    },
    {
      id: `stmt-${runId}-savings`,
      tenantId,
      accountNumber: maskedAccount(runId, 1),
      month: '2026-07',
      openingBalance: 50000.0,
      closingBalance: 50000.0,
      transactionCount: 1,
      runId,
    },
  ];

  return {
    runId,
    customer,
    project,
    tasks,
    agents,
    attachments,
    bankStatements,
  };
}

export interface DatasetCleanupManifest {
  tenantId: string;
  runId: string;
  customerId: string;
  projectId: string;
  taskIds: string[];
  agentIds: string[];
  attachmentIds: string[];
  statementIds: string[];
}

export function toCleanupManifest(
  ds: SyntheticAccountingDataset,
): DatasetCleanupManifest {
  return {
    tenantId: ds.customer.tenantId,
    runId: ds.runId,
    customerId: ds.customer.id,
    projectId: ds.project.id,
    taskIds: ds.tasks.map((t) => t.id),
    agentIds: ds.agents.map((a) => a.id),
    attachmentIds: ds.attachments.map((a) => a.id),
    statementIds: ds.bankStatements.map((b) => b.id),
  };
}

function pickDeterministic<T>(arr: T[], seed: string): T {
  const idx = simpleHash(seed) % arr.length;
  return arr[idx];
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function maskedAccount(runId: string, suffix: number): string {
  const seed = `${runId}-acct-${suffix}`;
  const h = simpleHash(seed).toString().padStart(10, '0');
  return `****${h.slice(-4)}`;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
