/**
 * NeureCore Harness - Phase 6: Public API
 *
 * Re-exports the manifest, FE-first Playwright adapter, simulation runner,
 * and migration adapters. Phase 6 wiring lives in this file so callers
 * don't need to know the module layout.
 *
 * Document ID: NC-HARNESS-PHASE6-001
 * Version: 1.0
 * Status: PHASE_6_IMPLEMENTED
 */

import { type SimManifest, PHASE6_SIM_VERSION } from './manifest';
import { SIM_BUILDERS } from './migration';

export * from './manifest';
export * from './adapter';
export * from './runner';
export * from './migration';

export const PHASE6_VERSION = PHASE6_SIM_VERSION;

export interface BuiltSimManifest {
  simulationId: string;
  manifest: SimManifest;
}

const BUILDERS: ReadonlyArray<{
  simulationId: string;
  build: () => SimManifest;
}> = SIM_BUILDERS;

export function buildAllSimManifests(): BuiltSimManifest[] {
  return BUILDERS.map((b) => ({
    simulationId: b.simulationId,
    manifest: b.build(),
  }));
}
