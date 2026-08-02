/**
 * IPredictionProvider — Phase 5 predictive models
 *
 * SRP: One interface per prediction kind. Each implementation is named
 * explicitly (lead-score, opportunity-win, forecast, pipeline-health,
 * case-classify) and returns the canonical Prediction contract with
 * provenance, confidence and limitations.
 */

export type PredictionSubjectKind =
  | 'lead'
  | 'opportunity'
  | 'case'
  | 'campaign'
  | 'forecast'
  | 'pipeline'
  | 'knowledge_article';

export interface PredictionProviderInput {
  tenantId: string;
  modelId: string;
  modelVersion: string;
  subject: { type: PredictionSubjectKind; id: string };
  features: Record<string, number | string | boolean | null>;
}

export interface PredictionFactor {
  readonly name: string;
  readonly value: number | string;
  readonly contribution: number;
}

export interface ProviderPrediction {
  readonly score: number;
  readonly confidence: number;
  readonly label?: string;
  readonly factors: readonly PredictionFactor[];
  readonly limitations: readonly string[];
}

export interface IPredictionProvider {
  readonly kind: PredictionSubjectKind;
  score(input: PredictionProviderInput): Promise<ProviderPrediction>;
}

export const LEAD_SCORE_PROVIDER = Symbol('LEAD_SCORE_PROVIDER');
export const OPPORTUNITY_WIN_PROVIDER = Symbol('OPPORTUNITY_WIN_PROVIDER');
export const FORECAST_PROVIDER = Symbol('FORECAST_PROVIDER');
export const PIPELINE_HEALTH_PROVIDER = Symbol('PIPELINE_HEALTH_PROVIDER');
export const CASE_CLASSIFY_PROVIDER = Symbol('CASE_CLASSIFY_PROVIDER');
