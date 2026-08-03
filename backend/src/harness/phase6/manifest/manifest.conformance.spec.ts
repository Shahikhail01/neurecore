/**
 * NeureCore Harness - Phase 6 Manifest Conformance
 *
 * Document ID: NC-HARNESS-PHASE6-MANIFEST-CONFORMANCE-001
 * Version: 1.0
 */

import {
  SimManifestSchema,
  SimIndustrySchema,
  SimLaneSchema,
  FeFirstModeSchema,
  TenantCohortEntrySchema,
  TenantCohortSchema,
  StateAssertionTypeSchema,
  StateAssertionSchema,
  EvidenceChannelSchema,
  JourneyActionSchema,
  JourneyStepSchema,
  CriticalJourneySchema,
  ViewportProfileSchema,
  BrowserProfileSchema,
  AccessibilityProfileSchema,
  BrowserMatrixSchema,
  KnownDefectSchema,
  PHASE6_SIM_VERSION,
  PHASE6_SIM_COMPATIBILITY_POLICY,
  computeSimManifestChecksum,
  canonicalizeSimManifest,
} from './index';
import {
  buildSim04Manifest,
  buildSim05Manifest,
  buildSim06Manifest,
  buildSim07Manifest,
  buildSim08Manifest,
  buildSim09Manifest,
  buildSim10Manifest,
  buildSim11Manifest,
  SIM_BUILDERS,
  NC_SIM04_002,
  NC_SIM04_005,
} from '../migration';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function baseManifest() {
  return {
    schemaVersion: '1.0.0',
    manifestId: 'm1',
    manifestVersion: '1.0.0',
    simulationId: 'SIM-04',
    simulationVersion: '1.0.0',
    title: 'Test SIM',
    industry: 'ACCOUNTING' as const,
    lane: 'TENANT_HQ' as const,
    feFirst: 'STRICT' as const,
    riskTier: 'CRITICAL' as const,
    executionMode: 'DETERMINISTIC' as const,
    environmentClass: 'STAGING' as const,
    requiredCapabilities: ['customer.create'],
    cohort: {
      cohortId: 'c1',
      provisionedAt: new Date().toISOString(),
      source: 'PROVISIONED_BY_SCRIPT' as const,
      entries: [
        {
          tenantId: TENANT_A,
          tenantSlug: 'sim04-test',
          userId: USER_A,
          email: 'a@example.test',
          preRunDuplicateCounts: { customers: 0, projects: 0, goals: 0 },
        },
      ],
    },
    matrix: {
      viewports: ['DESKTOP_1080P'] as Array<'DESKTOP_1080P'>,
      browsers: ['CHROMIUM_DESKTOP'] as Array<'CHROMIUM_DESKTOP'>,
      sessions: 1,
      accessibility: ['STANDARD'] as Array<'STANDARD'>,
    },
    journeys: [
      {
        journeyId: 'j1',
        name: 'j',
        steps: [
          {
            stepId: 's1',
            name: 's',
            action: 'CLICK' as const,
            selector: '#btn',
            postconditions: [
              {
                assertionId: 'a1',
                type: 'NO_API_FALLBACK' as const,
                expression: 'TEST_API',
                message: 'no api fallback',
              },
            ],
          },
        ],
      },
    ],
    evidenceChannels: [
      {
        channelId: 'ui.dom',
        mediaType: 'application/x-playwright-dom',
        captureMode: 'ON_FAILURE' as const,
        retentionClass: 'MEDIUM_TERM' as const,
        redactionRequired: false,
      },
    ],
    knownDefects: [],
  };
}

describe('Phase 6 / Manifest', () => {
  it('version constant is exposed', () => {
    expect(PHASE6_SIM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PHASE6_SIM_COMPATIBILITY_POLICY).toMatch(/strict-v1/);
  });

  it('rejects unknown industry', () => {
    const result = SimIndustrySchema.safeParse('ASTRONAUT');
    expect(result.success).toBe(false);
  });

  it('accepts all 8 industries', () => {
    const industries = [
      'ACCOUNTING',
      'FINANCIAL_SERVICES',
      'TECHNOLOGY',
      'PROFESSIONAL_BUSINESS',
      'RETAIL_COMMERCE',
      'MEDIA_COMMUNICATIONS',
      'NONPROFIT',
      'SPECIAL_PURPOSE',
    ];
    for (const i of industries) {
      expect(SimIndustrySchema.safeParse(i).success).toBe(true);
    }
  });

  it('rejects unknown lane', () => {
    expect(SimLaneSchema.safeParse('BEACH').success).toBe(false);
  });

  it('feFirst enum is strict-only', () => {
    expect(FeFirstModeSchema.options).toEqual(['STRICT', 'RELAXED']);
    expect(FeFirstModeSchema.safeParse('LAX').success).toBe(false);
  });

  it('rejects tenant cohort entry with negative pre-run duplicate count', () => {
    const bad = TenantCohortEntrySchema.safeParse({
      tenantId: TENANT_A,
      tenantSlug: 'x',
      userId: USER_A,
      email: 'a@example.test',
      preRunDuplicateCounts: { customers: -1, projects: 0, goals: 0 },
    });
    expect(bad.success).toBe(false);
  });

  it('rejects tenant cohort with empty entries', () => {
    const bad = TenantCohortSchema.safeParse({
      cohortId: 'c',
      provisionedAt: new Date().toISOString(),
      source: 'PROVISIONED_BY_SCRIPT',
      entries: [],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects journey with empty steps', () => {
    const bad = CriticalJourneySchema.safeParse({
      journeyId: 'j',
      name: 'j',
      steps: [],
    });
    expect(bad.success).toBe(false);
  });

  it('rejects step without postconditions', () => {
    const bad = JourneyStepSchema.safeParse({
      stepId: 's',
      name: 's',
      action: 'CLICK',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects invalid action', () => {
    const bad = JourneyActionSchema.safeParse('TAP');
    expect(bad.success).toBe(false);
  });

  it('rejects invalid assertion type', () => {
    const bad = StateAssertionTypeSchema.safeParse('MAGIC');
    expect(bad.success).toBe(false);
  });

  it('StateAssertion requires message', () => {
    const bad = StateAssertionSchema.safeParse({
      assertionId: 'a',
      type: 'DOM_PRESENT',
      expression: '.x',
    });
    expect(bad.success).toBe(false);
  });

  it('EvidenceChannel requires positive redaction flag', () => {
    const bad = EvidenceChannelSchema.safeParse({
      channelId: 'x',
      mediaType: 'application/json',
      captureMode: 'CONTINUOUS',
      retentionClass: 'LONG_TERM',
      redactionRequired: 'maybe',
    });
    expect(bad.success).toBe(false);
  });

  it('BrowserMatrix requires at least one viewport', () => {
    const bad = BrowserMatrixSchema.safeParse({
      viewports: [],
      browsers: ['CHROMIUM_DESKTOP'],
      sessions: 1,
      accessibility: ['STANDARD'],
    });
    expect(bad.success).toBe(false);
  });

  it('viewport, browser, accessibility enums accept canonical values', () => {
    expect(ViewportProfileSchema.safeParse('DESKTOP_1080P').success).toBe(true);
    expect(BrowserProfileSchema.safeParse('CHROMIUM_DESKTOP').success).toBe(
      true,
    );
    expect(AccessibilityProfileSchema.safeParse('STANDARD').success).toBe(true);
    expect(ViewportProfileSchema.safeParse('NARNIA').success).toBe(false);
  });

  it('KnownDefect requires blockingCapability', () => {
    const bad = KnownDefectSchema.safeParse({
      defectId: 'X',
      title: 't',
      isBlocking: true,
    });
    expect(bad.success).toBe(false);
  });

  it('top-level SimManifest accepts a well-formed payload', () => {
    expect(SimManifestSchema.safeParse(baseManifest()).success).toBe(true);
  });

  it('top-level SimManifest rejects missing journeys', () => {
    const bad = SimManifestSchema.safeParse({
      ...baseManifest(),
      journeys: [],
    });
    expect(bad.success).toBe(false);
  });

  it('top-level SimManifest rejects missing required capabilities', () => {
    const bad = SimManifestSchema.safeParse({
      ...baseManifest(),
      requiredCapabilities: [],
    });
    expect(bad.success).toBe(false);
  });

  it('computeSimManifestChecksum is deterministic', () => {
    const m = baseManifest();
    const c1 = computeSimManifestChecksum(m);
    const c2 = computeSimManifestChecksum(m);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('computeSimManifestChecksum changes when the manifest changes', () => {
    const m1 = baseManifest();
    const m2 = { ...baseManifest(), title: 'Other' };
    expect(computeSimManifestChecksum(m1)).not.toBe(
      computeSimManifestChecksum(m2),
    );
  });

  it('canonicalizeSimManifest sorts keys', () => {
    const a = canonicalizeSimManifest(baseManifest());
    expect(a.startsWith('{')).toBe(true);
  });

  it('SIM-04 manifest includes known defects NC-SIM04-002 and NC-SIM04-005', () => {
    const m = buildSim04Manifest();
    const ids = m.knownDefects.map((d) => d.defectId);
    expect(ids).toContain(NC_SIM04_002.defectId);
    expect(ids).toContain(NC_SIM04_005.defectId);
  });

  it('SIM-04 manifest has STRICT feFirst and TENANT_HQ lane', () => {
    const m = buildSim04Manifest();
    expect(m.feFirst).toBe('STRICT');
    expect(m.lane).toBe('TENANT_HQ');
  });

  it('every SIM builder produces a valid SimManifest', () => {
    for (const { build, simulationId } of SIM_BUILDERS) {
      const m = build();
      expect(m.simulationId).toBe(simulationId);
      expect(SimManifestSchema.safeParse(m).success).toBe(true);
    }
  });

  it('SIM-05 manifest has no blocking defects', () => {
    const m = buildSim05Manifest();
    expect(m.knownDefects.filter((d) => d.isBlocking)).toHaveLength(0);
  });

  it('every SIM manifest has at least one evidence channel', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      expect(m.evidenceChannels.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every SIM manifest has a non-empty cohort', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      expect(m.cohort.entries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every SIM manifest has at least one journey with at least one step', () => {
    for (const { build } of SIM_BUILDERS) {
      const m = build();
      for (const j of m.journeys) {
        expect(j.steps.length).toBeGreaterThanOrEqual(1);
        for (const s of j.steps) {
          expect(s.postconditions.length).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('SIM-06..SIM-11 manifests are uniquely identified', () => {
    const seen = new Set<string>();
    const all = [
      buildSim04Manifest(),
      buildSim05Manifest(),
      buildSim06Manifest(),
      buildSim07Manifest(),
      buildSim08Manifest(),
      buildSim09Manifest(),
      buildSim10Manifest(),
      buildSim11Manifest(),
    ];
    for (const m of all) {
      expect(seen.has(m.manifestId)).toBe(false);
      seen.add(m.manifestId);
    }
  });

  it('rejects unknown top-level fields via strict()', () => {
    const bad = SimManifestSchema.safeParse({
      ...baseManifest(),

      unexpectedField: 'nope',
    } as any);
    expect(bad.success).toBe(false);
  });

  it('SIM-04 cohort entries all have zero pre-run duplicate counts', () => {
    const m = buildSim04Manifest();
    for (const e of m.cohort.entries) {
      expect(e.preRunDuplicateCounts.customers).toBe(0);
      expect(e.preRunDuplicateCounts.projects).toBe(0);
      expect(e.preRunDuplicateCounts.goals).toBe(0);
    }
  });

  it('SIM-04 risk tier is CRITICAL', () => {
    expect(buildSim04Manifest().riskTier).toBe('CRITICAL');
  });
});
