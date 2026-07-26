export type TenantMutationRoute = 'legacy' | 'canonical';
export type MutationType = 'initiation' | 'project_creation';
export type AggregateEngine = 'legacy' | 'canonical-v1';

export interface LegacyIsolationConfig {
  tenantId: string;
  mutationType: MutationType;
  route: TenantMutationRoute;
}

export function resolveInitiationRoute(
  tenantFlag: TenantMutationRoute,
  mutationType: MutationType,
  aggregateEngine?: AggregateEngine,
): TenantMutationRoute {
  if (aggregateEngine === 'canonical-v1' && tenantFlag !== 'canonical') {
    throw new Error('CANONICAL_AGGREGATE_ROUTE_DISABLED');
  }

  if (aggregateEngine === 'legacy' && tenantFlag === 'canonical') {
    throw new Error('LEGACY_AGGREGATE_REQUIRES_MIGRATION');
  }

  if (aggregateEngine === 'canonical-v1') {
    return 'canonical';
  }

  if (aggregateEngine === 'legacy') {
    return 'legacy';
  }

  return tenantFlag === 'canonical' || mutationType === 'initiation'
    ? tenantFlag
    : 'legacy';
}

export const LEGACY_ISOLATION_RULES = {
  resolveRoute: resolveInitiationRoute,
};
