/**
 * Phase 30 — Cost ceiling view types (CR-AI-1305).
 *
 * Mirrors the backend `CostDimension` union and the dashboard read
 * model, so the admin console cannot drift from the API contract.
 *
 * SOLID
 *   SRP — owns ONLY the view vocabulary.
 */

export const COST_DIMENSIONS = [
  'MONTHLY_SPEND_CENTS',
  'DAILY_SPEND_CENTS',
  'MONTHLY_TOKENS',
  'REQUESTS_PER_MINUTE',
] as const;

export type CostDimension = (typeof COST_DIMENSIONS)[number];

/** Human labels for the operator console. */
export const DIMENSION_LABEL: Readonly<Record<CostDimension, string>> = {
  MONTHLY_SPEND_CENTS: 'Monthly spend',
  DAILY_SPEND_CENTS: 'Daily spend',
  MONTHLY_TOKENS: 'Monthly tokens',
  REQUESTS_PER_MINUTE: 'Requests / minute',
};

export interface CostCeilingEntry {
  readonly dimension: CostDimension;
  readonly unit: string;
  readonly used: number;
  readonly limitValue: number;
  readonly exceeded: boolean;
  readonly utilization: number;
}

export interface CostResilienceDashboard {
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly totalSpentCents: number;
  readonly totalBudgetCents: number;
  readonly ceilings: ReadonlyArray<CostCeilingEntry>;
  readonly containmentActive: boolean;
  readonly denialRate: number;
  readonly latencyP95Ms: number;
  readonly duplicateEffects: number;
  readonly recoveries: number;
}
