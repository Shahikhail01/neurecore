export interface IAnalyticsProvider {
  score(
    tenantId: string,
    modelId: string,
    features: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getModels(
    tenantId: string,
  ): Promise<Array<{ id: string; name: string; version: string }>>;
}

export interface IModelRunner {
  runModel(
    modelId: string,
    features: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export const MODEL_RUNNER = Symbol('MODEL_RUNNER');
