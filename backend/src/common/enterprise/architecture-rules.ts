// src/common/enterprise/architecture-rules.ts
export const ARCHITECTURE_RULES = {
  layers: ['domain', 'application', 'adapters', 'composition'],

  allowedDependencyPaths: [
    ['application', 'domain'],
    ['adapters', 'application'],
    ['adapters', 'domain'],
    ['composition', 'adapters'],
    ['composition', 'application'],
    ['composition', 'domain'],
  ],

  forbiddenDependencyPaths: [
    ['domain', 'application'],
    ['domain', 'adapters'],
    ['domain', 'tools'],
    ['application', 'adapters'],
    ['tools', 'infrastructure'],
  ],

  approvedPrismaImportLocations: [
    /\/repositories\//,
    /\/infrastructure\//,
    /\/interfaces\/repositories/,
    /\/testing\//,
    /\/seeds?\//,
    /\/fixtures\//,
  ],

  forbiddenPrismaCallLocations: [
    /\/modules\/tools\/built-in\//,
    /\/modules\/hermes\//,
    /\/modules\/agents\/services\//,
  ],
};

export type Layer = 'domain' | 'application' | 'adapters' | 'composition';

export interface DependencyEdge {
  from: string;
  to: string;
  allowed: boolean;
}
