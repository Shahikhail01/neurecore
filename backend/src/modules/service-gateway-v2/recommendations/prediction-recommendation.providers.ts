/**
 * Concrete Prediction/Recommendation providers — Phase 5.
 *
 * Wires the canonical PredictionService and RecommendationService to the
 * narrow provider ports (IPredictionProvider / IRecommendationProvider).
 *
 * Both are exported via the existing injection tokens
 * (PREDICTION_PROVIDER, RECOMMENDATION_PROVIDER) so the rest of the
 * gateway stays untouched.
 */

import { Injectable } from '@nestjs/common';
import {
  IPredictionProvider,
  IRecommendationProvider,
  Prediction,
  PredictionInput,
  Recommendation,
  RecommendationInput,
} from '../interfaces';
import { PredictionService } from '../../analytics/services/prediction.service';
import { RecommendationService } from '../../analytics/services/recommendation.service';

@Injectable()
export class PredictionProvider implements IPredictionProvider {
  constructor(private readonly inner: PredictionService) {}

  predict(input: PredictionInput): Promise<Prediction> {
    return this.inner.predict(input);
  }
}

@Injectable()
export class RecommendationProvider implements IRecommendationProvider {
  constructor(private readonly inner: RecommendationService) {}

  recommend(input: RecommendationInput): Promise<Recommendation[]> {
    return this.inner.recommend(input);
  }
}
