/**
 * NeureCore Harness - Phase 6 Migration Conformance
 *
 * Document ID: NC-HARNESS-PHASE6-MIGRATION-CONFORMANCE-001
 * Version: 1.0
 */

import {
  SIM_BUILDERS,
  buildSim04Manifest,
  buildSim05Manifest,
  buildSim06Manifest,
  buildSim07Manifest,
  buildSim08Manifest,
  buildSim09Manifest,
  buildSim10Manifest,
  buildSim11Manifest,
  NC_SIM04_002,
  NC_SIM04_005,
} from './index';
import { SimManifestSchema } from '../manifest';

describe('Phase 6 / Migration', () => {
  it('SIM_BUILDERS exposes all 8 SIMs', () => {
    expect(SIM_BUILDERS).toHaveLength(8);
    const ids = SIM_BUILDERS.map((b) => b.simulationId);
    expect(ids).toEqual([
      'SIM-04',
      'SIM-05',
      'SIM-06',
      'SIM-07',
      'SIM-08',
      'SIM-09',
      'SIM-10',
      'SIM-11',
    ]);
  });

  it('SIM-04 manifest preserves the 12-stage journey intent', () => {
    const m = buildSim04Manifest();
    expect(m.journeys).toHaveLength(1);
    expect(m.journeys[0].steps).toHaveLength(12);
  });

  it('SIM-04 manifests keep NC-SIM04-002 as a blocking defect', () => {
    const m = buildSim04Manifest();
    const ids = m.knownDefects.map((d) => d.defectId);
    expect(ids).toContain(NC_SIM04_002.defectId);
    expect(NC_SIM04_002.isBlocking).toBe(true);
    expect(NC_SIM04_002.blockingCapability).toBe('customer.create');
  });

  it('SIM-04 manifests keep NC-SIM04-005 as a blocking defect', () => {
    const m = buildSim04Manifest();
    const ids = m.knownDefects.map((d) => d.defectId);
    expect(ids).toContain(NC_SIM04_005.defectId);
    expect(NC_SIM04_005.isBlocking).toBe(true);
  });

  it('every SIM-04 step has NO_API_FALLBACK + TENANT_ISOLATION postconditions', () => {
    const m = buildSim04Manifest();
    for (const s of m.journeys[0].steps) {
      const types = s.postconditions.map((p) => p.type);
      expect(types).toContain('NO_API_FALLBACK');
      expect(types).toContain('TENANT_ISOLATION');
    }
  });

  it('SIM-05 manifest preserves the financial services intent', () => {
    const m = buildSim05Manifest();
    expect(m.industry).toBe('FINANCIAL_SERVICES');
    expect(m.requiredCapabilities).toContain('compliance.run');
  });

  it('SIM-06 manifest preserves the technology intent', () => {
    const m = buildSim06Manifest();
    expect(m.industry).toBe('TECHNOLOGY');
    expect(m.simulationId).toBe('SIM-06');
    expect(m.requiredCapabilities).toContain('sprint.plan');
  });

  it('SIM-07 manifest preserves professional services intent', () => {
    const m = buildSim07Manifest();
    expect(m.industry).toBe('PROFESSIONAL_BUSINESS');
    expect(m.simulationId).toBe('SIM-07');
  });

  it('SIM-08 manifest preserves retail intent', () => {
    const m = buildSim08Manifest();
    expect(m.industry).toBe('RETAIL_COMMERCE');
    expect(m.simulationId).toBe('SIM-08');
  });

  it('SIM-09 manifest preserves media intent', () => {
    const m = buildSim09Manifest();
    expect(m.industry).toBe('MEDIA_COMMUNICATIONS');
    expect(m.simulationId).toBe('SIM-09');
  });

  it('SIM-10 manifest preserves nonprofit intent', () => {
    const m = buildSim10Manifest();
    expect(m.industry).toBe('NONPROFIT');
    expect(m.simulationId).toBe('SIM-10');
  });

  it('SIM-11 manifest preserves special-purpose intent', () => {
    const m = buildSim11Manifest();
    expect(m.industry).toBe('SPECIAL_PURPOSE');
    expect(m.simulationId).toBe('SIM-11');
  });

  it('every SIM-05..SIM-11 manifest is FE-first STRICT', () => {
    const all = [
      buildSim05Manifest(),
      buildSim06Manifest(),
      buildSim07Manifest(),
      buildSim08Manifest(),
      buildSim09Manifest(),
      buildSim10Manifest(),
      buildSim11Manifest(),
    ];
    for (const m of all) {
      expect(m.feFirst).toBe('STRICT');
    }
  });

  it('every SIM-05..SIM-11 manifest is CRITICAL risk tier', () => {
    const all = [
      buildSim05Manifest(),
      buildSim06Manifest(),
      buildSim07Manifest(),
      buildSim08Manifest(),
      buildSim09Manifest(),
      buildSim10Manifest(),
      buildSim11Manifest(),
    ];
    for (const m of all) {
      expect(m.riskTier).toBe('CRITICAL');
    }
  });

  it('every SIM-05..SIM-11 manifest is TENANT_HQ lane', () => {
    const all = [
      buildSim05Manifest(),
      buildSim06Manifest(),
      buildSim07Manifest(),
      buildSim08Manifest(),
      buildSim09Manifest(),
      buildSim10Manifest(),
      buildSim11Manifest(),
    ];
    for (const m of all) {
      expect(m.lane).toBe('TENANT_HQ');
    }
  });

  it('every migrated manifest validates against SimManifestSchema', () => {
    for (const { build } of SIM_BUILDERS) {
      expect(SimManifestSchema.safeParse(build()).success).toBe(true);
    }
  });

  it('every SIM-04..SIM-11 manifest has at least one evidence channel', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      expect(m.evidenceChannels.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every SIM-04..SIM-11 manifest has a non-empty cohort with fresh tenants', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      expect(m.cohort.entries.length).toBeGreaterThanOrEqual(1);
      for (const e of m.cohort.entries) {
        expect(e.preRunDuplicateCounts.customers).toBe(0);
        expect(e.preRunDuplicateCounts.projects).toBe(0);
        expect(e.preRunDuplicateCounts.goals).toBe(0);
      }
    }
  });

  it('every SIM-04..SIM-11 manifest has at least one journey', () => {
    for (const { build } of SIM_BUILDERS) {
      expect(build().journeys.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every SIM-04..SIM-11 manifest has a browser matrix with at least one viewport', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      expect(m.matrix.viewports.length).toBeGreaterThanOrEqual(1);
      expect(m.matrix.browsers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every SIM-04..SIM-11 manifest has unique stepIds within a journey', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      for (const j of m.journeys) {
        const ids = j.steps.map((s) => s.stepId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('every SIM-04..SIM-11 step has a unique assertionId within its postconditions', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      for (const j of m.journeys) {
        for (const s of j.steps) {
          const ids = s.postconditions.map((p) => p.assertionId);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }
    }
  });

  it('SIM-04 known defects explicitly mention the FE-first rule', () => {
    expect(NC_SIM04_002.note).toMatch(/API/i);
    expect(NC_SIM04_005.note).toMatch(/chat|project/i);
  });

  it('migrated SIM-04 preserves the cohort clean-tenant requirements', () => {
    const m = buildSim04Manifest({ cohortCount: 3 });
    expect(m.cohort.entries).toHaveLength(3);
    for (const e of m.cohort.entries) {
      expect(e.preRunDuplicateCounts).toEqual({
        customers: 0,
        projects: 0,
        goals: 0,
      });
    }
  });

  it('SIM-04 journey covers the original SIM-04 prompt business scope', () => {
    const m = buildSim04Manifest();
    const desc = m.journeys[0].description ?? '';
    expect(desc).toMatch(/create customer|create project|approval|COMPLETED/i);
  });
});
