/**
 * Prediction and Recommendation Contracts — Phase 5
 *
 * Canonical contracts for next-best-action and predictive intelligence.
 * Predictions and recommendations are explainable, versioned, measured,
 * and governed before action.
 *
 * The narrow provider interfaces (IPredictionProvider, IRecommendationProvider)
 * live in `../interfaces` alongside the canonical Prediction/Recommendation
 * types. Concrete implementations live in `prediction-recommendation.providers.ts`
 * and are bound to the PREDICTION_PROVIDER / RECOMMENDATION_PROVIDER injection
 * tokens by ServiceGatewayV2Module.
 *
 * The previous StubPredictionProvider / StubRecommendationProvider have been
 * removed; the production wiring now uses real Prisma-backed providers that
 * abstain when confidence, freshness, or evidence is insufficient.
 */

export type {
  IPredictionProvider,
  IRecommendationProvider,
  Prediction,
  PredictionInput,
  Recommendation,
  RecommendationInput,
  SupportingEvidence,
  RankedAction,
} from '../interfaces';

export const PREDICTION_QUALITY_THRESHOLDS = {
  MIN_CONFIDENCE: 0.7,
  MAX_STALENESS_HOURS: 24,
  MIN_EVIDENCE_COUNT: 3,
} as const;

/**
 * Check if a prediction meets quality thresholds
 */
export function isPredictionQualityAcceptable(prediction: {
  confidence: number;
  generatedAt: string;
  explanation: string[];
}): boolean {
  const staleHours =
    (Date.now() - new Date(prediction.generatedAt).getTime()) /
    (1000 * 60 * 60);

  return (
    prediction.confidence >= PREDICTION_QUALITY_THRESHOLDS.MIN_CONFIDENCE &&
    staleHours <= PREDICTION_QUALITY_THRESHOLDS.MAX_STALENESS_HOURS &&
    prediction.explanation.length >=
      PREDICTION_QUALITY_THRESHOLDS.MIN_EVIDENCE_COUNT
  );
}
