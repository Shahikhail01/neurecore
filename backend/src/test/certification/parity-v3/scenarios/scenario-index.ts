/**
 * P9 — Scenario inventory.
 *
 * The full 70-scenario matrix from the parity-v3 plan. Each scenario
 * is a thin wrapper that maps to the runner's `executeScenario` and
 * records the pass/fail reason. Individual per-scenario spec files
 * (`./<CATEGORY>-<ID>.spec.ts`) re-export the entries they own.
 */

import { DEFAULT_SCENARIOS, ParityV3Scenario } from '../parity-v3-runner';

export const ALL_SCENARIOS: ReadonlyArray<ParityV3Scenario> = DEFAULT_SCENARIOS;

export const SCENARIO_INDEX: Readonly<Record<string, ParityV3Scenario>> =
  Object.fromEntries(ALL_SCENARIOS.map((s) => [s.scenarioId, s]));

export function scenariosByCategory(
  category: ParityV3Scenario['category'],
): ReadonlyArray<ParityV3Scenario> {
  return ALL_SCENARIOS.filter((s) => s.category === category);
}
