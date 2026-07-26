import { LEGACY_ISOLATION_RULES } from './legacy-isolation';

describe('Enterprise initiation legacy isolation', () => {
  it('routes canonical tenant mutations to the canonical path', () => {
    expect(
      LEGACY_ISOLATION_RULES.resolveRoute('canonical', 'project_creation'),
    ).toBe('canonical');
  });

  it('does not allow canonical aggregates to fall back to legacy writes', () => {
    expect(() =>
      LEGACY_ISOLATION_RULES.resolveRoute('legacy', 'project_creation', 'canonical-v1'),
    ).toThrow('CANONICAL_AGGREGATE_ROUTE_DISABLED');
  });

  it('does not allow legacy aggregates to be mutated by canonical route without migration', () => {
    expect(() =>
      LEGACY_ISOLATION_RULES.resolveRoute('canonical', 'project_creation', 'legacy'),
    ).toThrow('LEGACY_AGGREGATE_REQUIRES_MIGRATION');
  });
});
