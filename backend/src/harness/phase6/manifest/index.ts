/**
 * NeureCore Harness - Phase 6: Simulation Manifest Contracts
 *
 * Common simulation (SIM) manifest schema for SIM-04..SIM-11.
 * Runtime-validated, versioned, and content-addressed.
 *
 * Document ID: NC-HARNESS-PHASE6-MANIFEST-001
 * Version: 1.0
 * Status: PHASE_6_IMPLEMENTED
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import {
  SemverSchema,
  UuidSchema,
  IsoDateTimeSchema,
  ScenarioManifestSchema,
  type ScenarioManifest,
  RiskTierSchema,
  ExecutionModeSchema,
  EnvironmentClassSchema,
} from '../../contracts';

export const PHASE6_SIM_VERSION = '1.0.0';
export const PHASE6_SIM_COMPATIBILITY_POLICY =
  'strict-v1: additive-optional = minor, required-added-or-removed-or-narrowed = major';

// ============================================================
// SIM-04..SIM-11 INDUSTRY IDENTITY
// ============================================================

export const SimIndustrySchema = z.enum([
  'ACCOUNTING',
  'FINANCIAL_SERVICES',
  'TECHNOLOGY',
  'PROFESSIONAL_BUSINESS',
  'RETAIL_COMMERCE',
  'MEDIA_COMMUNICATIONS',
  'NONPROFIT',
  'SPECIAL_PURPOSE',
]);
export type SimIndustry = z.infer<typeof SimIndustrySchema>;

export const SimLaneSchema = z.enum([
  'TENANT_HQ',
  'CONTROL_CENTER',
  'PUBLIC_MARKETING',
]);
export type SimLane = z.infer<typeof SimLaneSchema>;

export const FeFirstModeSchema = z.enum([
  'STRICT', // Every business mutation through the browser; never fall back to API
  'RELAXED', // Allow API fallback when a frontend step fails (default OFF per SIM-04 lesson)
]);
export type FeFirstMode = z.infer<typeof FeFirstModeSchema>;

// ============================================================
// TENANT COHORT (provisions fresh tenants for the simulation)
// ============================================================

export const TenantCohortEntrySchema = z
  .object({
    tenantId: UuidSchema,
    tenantSlug: z.string().min(1),
    userId: UuidSchema,
    email: z.string().email(),
    preRunDuplicateCounts: z
      .object({
        customers: z.number().int().nonnegative(),
        projects: z.number().int().nonnegative(),
        goals: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type TenantCohortEntry = z.infer<typeof TenantCohortEntrySchema>;

export const TenantCohortSchema = z
  .object({
    cohortId: z.string().min(1),
    provisionedAt: IsoDateTimeSchema,
    source: z.enum([
      'MANUAL',
      'PROVISIONED_BY_RUNNER',
      'PROVISIONED_BY_SCRIPT',
    ]),
    entries: z.array(TenantCohortEntrySchema).min(1),
  })
  .strict();
export type TenantCohort = z.infer<typeof TenantCohortSchema>;

// ============================================================
// STATE ASSERTION (postcondition oracle for a journey step)
// ============================================================

export const StateAssertionTypeSchema = z.enum([
  'URL_PATH',
  'DOM_PRESENT',
  'DOM_TEXT',
  'TOOL_EXECUTED',
  'TOOL_NOT_EXECUTED',
  'EVENT_EMITTED',
  'OUTBOX_RECORD_PRESENT',
  'TENANT_ISOLATION',
  'NO_API_FALLBACK',
]);
export type StateAssertionType = z.infer<typeof StateAssertionTypeSchema>;

export const StateAssertionSchema = z
  .object({
    assertionId: z.string().min(1),
    type: StateAssertionTypeSchema,
    expression: z.string().min(1),
    expected: z.unknown().optional(),
    message: z.string().min(1),
  })
  .strict();
export type StateAssertion = z.infer<typeof StateAssertionSchema>;

// ============================================================
// EVIDENCE CHANNEL (per-scenario evidence capture)
// ============================================================

export const EvidenceChannelSchema = z
  .object({
    channelId: z.string().min(1),
    mediaType: z.string().min(1),
    captureMode: z.enum([
      'CONTINUOUS',
      'ON_FAILURE',
      'ON_SUCCESS',
      'ON_DEMAND',
    ]),
    retentionClass: z.enum([
      'SHORT_TERM',
      'MEDIUM_TERM',
      'LONG_TERM',
      'PERMANENT',
    ]),
    redactionRequired: z.boolean(),
  })
  .strict();
export type EvidenceChannel = z.infer<typeof EvidenceChannelSchema>;

// ============================================================
// JOURNEY STEP (FE-first action in the browser)
// ============================================================

export const JourneyActionSchema = z.enum([
  'NAVIGATE',
  'LOGIN',
  'CLICK',
  'FILL',
  'SELECT',
  'WAIT_FOR',
  'ASSERT_DOM',
  'CHAT_SEND',
  'APPROVE_CARD',
  'OBSERVE_TOOL',
  'SCREENSHOT',
  'CUSTOM',
]);
export type JourneyAction = z.infer<typeof JourneyActionSchema>;

export const JourneyStepSchema = z
  .object({
    stepId: z.string().min(1),
    name: z.string().min(1),
    action: JourneyActionSchema,
    description: z.string().min(1).optional(),
    selector: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    preconditions: z.array(z.string().min(1)).optional(),
    postconditions: z.array(StateAssertionSchema).min(1),
  })
  .strict();
export type JourneyStep = z.infer<typeof JourneyStepSchema>;

// ============================================================
// CRITICAL JOURNEY (ordered, FE-first steps)
// ============================================================

export const CriticalJourneySchema = z
  .object({
    journeyId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1).optional(),
    steps: z.array(JourneyStepSchema).min(1),
  })
  .strict();
export type CriticalJourney = z.infer<typeof CriticalJourneySchema>;

// ============================================================
// BROWSER MATRIX (viewport / browser / session / a11y)
// ============================================================

export const ViewportProfileSchema = z.enum([
  'MOBILE_PORTRAIT',
  'MOBILE_LANDSCAPE',
  'TABLET_PORTRAIT',
  'DESKTOP_1080P',
  'DESKTOP_1440P',
  'WIDESCREEN',
]);
export type ViewportProfile = z.infer<typeof ViewportProfileSchema>;

export const BrowserProfileSchema = z.enum([
  'CHROMIUM_DESKTOP',
  'CHROMIUM_MOBILE',
  'FIREFOX_DESKTOP',
  'WEBKIT_DESKTOP',
]);
export type BrowserProfile = z.infer<typeof BrowserProfileSchema>;

export const AccessibilityProfileSchema = z.enum([
  'STANDARD',
  'HIGH_CONTRAST',
  'REDUCED_MOTION',
  'SCREEN_READER',
]);
export type AccessibilityProfile = z.infer<typeof AccessibilityProfileSchema>;

export const BrowserMatrixSchema = z
  .object({
    viewports: z.array(ViewportProfileSchema).min(1),
    browsers: z.array(BrowserProfileSchema).min(1),
    sessions: z.number().int().positive(),
    accessibility: z.array(AccessibilityProfileSchema).min(1),
  })
  .strict();
export type BrowserMatrix = z.infer<typeof BrowserMatrixSchema>;

// ============================================================
// KNOWN DEFECT GATE (mandatory "fail closed" blockers)
// ============================================================

export const KnownDefectSchema = z
  .object({
    defectId: z.string().min(1),
    title: z.string().min(1),
    blockingCapability: z.string().min(1),
    isBlocking: z.boolean(),
    note: z.string().min(1).optional(),
  })
  .strict();
export type KnownDefect = z.infer<typeof KnownDefectSchema>;

// ============================================================
// SIMULATION MANIFEST (top-level)
// ============================================================

export const SimManifestSchema = z
  .object({
    schemaVersion: SemverSchema,
    manifestId: z.string().min(1),
    manifestVersion: SemverSchema,
    simulationId: z.string().min(1),
    simulationVersion: SemverSchema,
    title: z.string().min(1),
    industry: SimIndustrySchema,
    lane: SimLaneSchema,
    feFirst: FeFirstModeSchema,
    riskTier: RiskTierSchema,
    executionMode: ExecutionModeSchema,
    environmentClass: EnvironmentClassSchema,
    requiredCapabilities: z.array(z.string().min(1)).min(1),
    cohort: TenantCohortSchema,
    matrix: BrowserMatrixSchema,
    journeys: z.array(CriticalJourneySchema).min(1),
    evidenceChannels: z.array(EvidenceChannelSchema).min(1),
    knownDefects: z.array(KnownDefectSchema),
    scenarioManifest: ScenarioManifestSchema.optional(),
    parents: z.array(z.string().min(1)).optional(),
  })
  .strict();
export type SimManifest = z.infer<typeof SimManifestSchema>;

// ============================================================
// CHECKSUM (content-addressed, deterministic)
// ============================================================

export function canonicalizeSimManifest(manifest: SimManifest): string {
  return JSON.stringify(manifest, Object.keys(manifest).sort());
}

export function computeSimManifestChecksum(manifest: SimManifest): string {
  return `sha256:${createHash('sha256')
    .update(canonicalizeSimManifest(manifest))
    .digest('hex')}`;
}

// ============================================================
// RE-EXPORT BASE
// ============================================================

export type { ScenarioManifest };
