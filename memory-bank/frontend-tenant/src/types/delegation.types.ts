'use client';

/**
 * delegation.types.ts — Task Delegation type contracts (tenant portal)
 *
 * S: type definitions only
 */

export type AuthorityLevel = 'EXECUTE' | 'APPROVE_THRESHOLD' | 'APPROVE_ME';

export interface DelegationStep {
  id: number;
  label: string;
  description: string;
}

export const DELEGATION_STEPS: DelegationStep[] = [
  { id: 1, label: 'Description',  description: 'Describe the task you want to delegate' },
  { id: 2, label: 'Department',   description: 'Choose the responsible department' },
  { id: 3, label: 'Agent',        description: 'Assign to a specific agent (optional)' },
  { id: 4, label: 'Parameters',   description: 'Set execution parameters and constraints' },
  { id: 5, label: 'Authority',    description: 'Define approval authority level' },
  { id: 6, label: 'Review',       description: 'Review and confirm delegation' },
];

export interface DelegationFormData {
  // Step 1
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Step 2
  departmentId: string;
  departmentName: string;

  // Step 3
  agentId: string | null;
  agentName: string | null;

  // Step 4
  deadline: string;         // ISO date string or ''
  maxRetries: number;
  tags: string[];

  // Step 5
  authority: AuthorityLevel;
  approvalThreshold: number | null; // for APPROVE_THRESHOLD

  // Computed
  estimatedCost?: number;
}

export const EMPTY_FORM: DelegationFormData = {
  title:             '',
  description:       '',
  priority:          'MEDIUM',
  departmentId:      '',
  departmentName:    '',
  agentId:           null,
  agentName:         null,
  deadline:          '',
  maxRetries:        3,
  tags:              [],
  authority:         'EXECUTE',
  approvalThreshold: null,
};
