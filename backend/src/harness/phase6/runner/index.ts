/**
 * NeureCore Harness - Phase 6: Simulation Runner
 *
 * Common orchestrator for SIM-04..SIM-11. Wraps the FE-first Playwright
 * adapter and produces a versioned simulation report that the harness
 * certification engine (Phase 9) consumes.
 *
 * Document ID: NC-HARNESS-PHASE6-RUNNER-001
 * Version: 1.0
 * Status: PHASE_6_IMPLEMENTED
 */

import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import {
  type SimManifest,
  type KnownDefect,
  computeSimManifestChecksum,
} from '../manifest';
import {
  FeFirstAdapter,
  type FeFirstAdapterConfig,
  type IFeFirstBrowserLauncher,
  type IEvidenceSink,
  type IToolEventSink,
  type IDomainEventSink,
  type IApiCallWatchdog,
  type StepResult,
  InMemoryEvidenceSink,
  InMemoryToolEventSink,
  InMemoryDomainEventSink,
  InMemoryApiCallWatchdog,
} from '../adapter';
import { UuidSchema, IsoDateTimeSchema, SemverSchema } from '../../contracts';
import { computeContentChecksum } from '../../evidence';

// ============================================================
// RUNNER VERSION
// ============================================================

export const PHASE6_RUNNER_VERSION = '1.0.0';

// ============================================================
// SIMULATION RUN RESULT
// ============================================================

export const SimulationVerdictSchema = z.enum([
  'PASSED',
  'FAILED',
  'BLOCKED_KNOWN_DEFECT',
  'INFRA_ERROR',
  'INCONCLUSIVE',
  'INSUFFICIENT_EVIDENCE',
]);
export type SimulationVerdict = z.infer<typeof SimulationVerdictSchema>;

export const CohortRunResultSchema = z
  .object({
    cohortEntry: z
      .object({
        tenantId: UuidSchema,
        userId: UuidSchema,
        email: z.string().email(),
        tenantSlug: z.string().min(1),
      })
      .strict(),
    journeyResults: z.array(
      z
        .object({
          journeyId: z.string().min(1),
          runId: UuidSchema,
          correlationId: UuidSchema,
          stepResults: z.array(z.unknown()),
          evidenceIds: z.array(UuidSchema),
          apiFallbackDetected: z.boolean(),
          verdict: SimulationVerdictSchema,
        })
        .strict(),
    ),
  })
  .strict();
export type CohortRunResult = z.infer<typeof CohortRunResultSchema>;

export const SimulationReportSchema = z
  .object({
    schemaVersion: SemverSchema,
    reportId: UuidSchema,
    simulationId: z.string().min(1),
    simulationVersion: SemverSchema,
    manifestChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    runnerVersion: z.string().min(1),
    startedAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema,
    verdict: SimulationVerdictSchema,
    cohort: z.array(CohortRunResultSchema),
    defectGate: z
      .object({
        blocking: z.array(z.string().min(1)),
        acknowledged: z.array(z.string().min(1)),
        gateOpen: z.boolean(),
      })
      .strict(),
    feFirstViolations: z.array(
      z
        .object({
          tenantId: UuidSchema,
          journeyId: z.string().min(1),
          stepId: z.string().min(1),
          call: z.string().min(1),
        })
        .strict(),
    ),
    aggregate: z
      .object({
        totalRuns: z.number().int().nonnegative(),
        passedRuns: z.number().int().nonnegative(),
        failedRuns: z.number().int().nonnegative(),
        blockedRuns: z.number().int().nonnegative(),
        apiFallbackRuns: z.number().int().nonnegative(),
      })
      .strict(),
    reportChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();
export type SimulationReport = z.infer<typeof SimulationReportSchema>;

// ============================================================
// RUNNER CONFIG
// ============================================================

export const RunnerConfigSchema = z
  .object({
    baseUrl: z.string().url(),
    tenantId: UuidSchema,
    actorId: z.string().min(1),
    feFirstMode: z.enum(['STRICT', 'RELAXED']),
    evidenceClassification: z.enum([
      'PUBLIC',
      'INTERNAL',
      'CONFIDENTIAL',
      'RESTRICTED',
      'REGULATED',
    ]),
  })
  .strict();
export type RunnerConfig = z.infer<typeof RunnerConfigSchema>;

// ============================================================
// SIMULATION RUNNER
// ============================================================

export interface SimulationRunnerDeps {
  launcher: IFeFirstBrowserLauncher;
  evidence?: IEvidenceSink;
  tools?: IToolEventSink;
  events?: IDomainEventSink;
  watchdog?: IApiCallWatchdog;
}

export class SimulationRunner {
  private readonly launcher: IFeFirstBrowserLauncher;
  private readonly evidence: IEvidenceSink;
  private readonly tools: IToolEventSink;
  private readonly events: IDomainEventSink;
  private readonly watchdog: IApiCallWatchdog;
  private readonly config: RunnerConfig;

  constructor(config: RunnerConfig, deps: SimulationRunnerDeps) {
    this.config = config;
    this.launcher = deps.launcher;
    this.evidence = deps.evidence ?? new InMemoryEvidenceSink();
    this.tools = deps.tools ?? new InMemoryToolEventSink();
    this.events = deps.events ?? new InMemoryDomainEventSink();
    this.watchdog = deps.watchdog ?? new InMemoryApiCallWatchdog();
  }

  // ------------------------------------------------------------
  // Defect gate (mandatory "fail closed" blockers)
  // ------------------------------------------------------------

  evaluateDefectGate(knownDefects: KnownDefect[]): {
    blocking: string[];
    acknowledged: string[];
    gateOpen: boolean;
  } {
    const blocking = knownDefects
      .filter((d) => d.isBlocking)
      .map((d) => d.defectId);
    const acknowledged = knownDefects
      .filter((d) => !d.isBlocking)
      .map((d) => d.defectId);
    return {
      blocking,
      acknowledged,
      gateOpen: blocking.length === 0,
    };
  }

  // ------------------------------------------------------------
  // Verdict helpers
  // ------------------------------------------------------------

  classifyCohortVerdict(
    apiFallbackDetected: boolean,
    stepResults: StepResult[],
    defectGateOpen: boolean,
  ): SimulationVerdict {
    if (!defectGateOpen) return 'BLOCKED_KNOWN_DEFECT';
    if (apiFallbackDetected) return 'INCONCLUSIVE';
    const failed = stepResults.find(
      (s) => s.outcome === 'FAILED' || s.outcome === 'TIMEOUT',
    );
    if (failed) return 'FAILED';
    if (stepResults.length === 0) return 'INSUFFICIENT_EVIDENCE';
    return 'PASSED';
  }

  // ------------------------------------------------------------
  // Main entry
  // ------------------------------------------------------------

  async run(manifest: SimManifest): Promise<SimulationReport> {
    const startedAt = new Date().toISOString();
    const defectGate = this.evaluateDefectGate(manifest.knownDefects);

    // If known defects are blocking, return a fail-closed verdict without
    // running the simulation. Per SIM-04 lesson: "known SIM-04 defects
    // remain explicit blockers until fixed."
    if (!defectGate.gateOpen) {
      const completedAt = new Date().toISOString();
      const report: Omit<SimulationReport, 'reportChecksum'> = {
        schemaVersion: '1.0.0',
        reportId: randomUUID(),
        simulationId: manifest.simulationId,
        simulationVersion: manifest.simulationVersion,
        manifestChecksum: computeSimManifestChecksum(manifest),
        runnerVersion: PHASE6_RUNNER_VERSION,
        startedAt,
        completedAt,
        verdict: 'BLOCKED_KNOWN_DEFECT',
        cohort: [],
        defectGate,
        feFirstViolations: [],
        aggregate: {
          totalRuns: 0,
          passedRuns: 0,
          failedRuns: 0,
          blockedRuns: manifest.cohort.entries.length,
          apiFallbackRuns: 0,
        },
      };
      return {
        ...report,
        reportChecksum: `sha256:${createHash('sha256')
          .update(JSON.stringify(report))
          .digest('hex')}`,
      };
    }

    const adapterConfig: FeFirstAdapterConfig = {
      feFirstMode: this.config.feFirstMode,
      evidenceClassification: this.config.evidenceClassification,
      tenantId: this.config.tenantId,
      actorId: this.config.actorId,
      baseUrl: this.config.baseUrl,
      defaultTimeoutMs: 30_000,
    };
    const adapter = new FeFirstAdapter({
      launcher: this.launcher,
      evidence: this.evidence,
      tools: this.tools,
      events: this.events,
      watchdog: this.watchdog,
      config: adapterConfig,
      manifest,
    });

    const cohortResults: CohortRunResult[] = [];
    const feFirstViolations: Array<{
      tenantId: string;
      journeyId: string;
      stepId: string;
      call: string;
    }> = [];

    for (const entry of manifest.cohort.entries) {
      for (const journey of manifest.journeys) {
        const journeyRun = await adapter.runJourney(manifest, journey, {
          tenantId: entry.tenantId,
          userId: entry.userId,
          email: entry.email,
        });

        const stepResults = journeyRun.stepResults;
        const verdict = this.classifyCohortVerdict(
          journeyRun.apiFallbackDetected,
          stepResults,
          defectGate.gateOpen,
        );

        for (const step of stepResults) {
          if (step.apiFallbackDetected) {
            feFirstViolations.push({
              tenantId: entry.tenantId,
              journeyId: journey.journeyId,
              stepId: step.stepId,
              call: 'TEST_API observed during step',
            });
          }
        }

        cohortResults.push({
          cohortEntry: {
            tenantId: entry.tenantId,
            userId: entry.userId,
            email: entry.email,
            tenantSlug: entry.tenantSlug,
          },
          journeyResults: [
            {
              journeyId: journey.journeyId,
              runId: journeyRun.runId,
              correlationId: journeyRun.correlationId,
              stepResults: stepResults as unknown as Array<
                Record<string, unknown>
              >,
              evidenceIds: journeyRun.evidenceIds,
              apiFallbackDetected: journeyRun.apiFallbackDetected,
              verdict,
            },
          ],
        });
      }
    }

    const completedAt = new Date().toISOString();
    const totalRuns = cohortResults.reduce(
      (acc, c) => acc + c.journeyResults.length,
      0,
    );
    const passedRuns = cohortResults.reduce(
      (acc, c) =>
        acc + c.journeyResults.filter((j) => j.verdict === 'PASSED').length,
      0,
    );
    const failedRuns = cohortResults.reduce(
      (acc, c) =>
        acc + c.journeyResults.filter((j) => j.verdict === 'FAILED').length,
      0,
    );
    const blockedRuns = cohortResults.reduce(
      (acc, c) =>
        acc +
        c.journeyResults.filter((j) => j.verdict === 'BLOCKED_KNOWN_DEFECT')
          .length,
      0,
    );
    const apiFallbackRuns = cohortResults.reduce(
      (acc, c) =>
        acc + c.journeyResults.filter((j) => j.apiFallbackDetected).length,
      0,
    );

    let overallVerdict: SimulationVerdict = 'PASSED';
    if (blockedRuns > 0) overallVerdict = 'BLOCKED_KNOWN_DEFECT';
    else if (apiFallbackRuns > 0) overallVerdict = 'INCONCLUSIVE';
    else if (failedRuns > 0) overallVerdict = 'FAILED';
    else if (passedRuns === 0) overallVerdict = 'INSUFFICIENT_EVIDENCE';

    const report: Omit<SimulationReport, 'reportChecksum'> = {
      schemaVersion: '1.0.0',
      reportId: randomUUID(),
      simulationId: manifest.simulationId,
      simulationVersion: manifest.simulationVersion,
      manifestChecksum: computeSimManifestChecksum(manifest),
      runnerVersion: PHASE6_RUNNER_VERSION,
      startedAt,
      completedAt,
      verdict: overallVerdict,
      cohort: cohortResults,
      defectGate,
      feFirstViolations,
      aggregate: {
        totalRuns,
        passedRuns,
        failedRuns,
        blockedRuns,
        apiFallbackRuns,
      },
    };
    return {
      ...report,
      reportChecksum: `sha256:${createHash('sha256')
        .update(JSON.stringify(report))
        .digest('hex')}`,
    };
  }
}

// ============================================================
// COVERAGE MAP
// ============================================================

export interface SimulationCoverage {
  manifestId: string;
  title: string;
  industry: string;
  lane: string;
  requiredCapabilities: string[];
  journeyCount: number;
  stepCount: number;
  matrixViewports: number;
  matrixBrowsers: number;
  matrixSessions: number;
  matrixAccessibility: number;
  hasKnownDefects: boolean;
  feFirstMode: string;
}

export function buildCoverageMap(manifest: SimManifest): SimulationCoverage {
  return {
    manifestId: manifest.manifestId,
    title: manifest.title,
    industry: manifest.industry,
    lane: manifest.lane,
    requiredCapabilities: manifest.requiredCapabilities,
    journeyCount: manifest.journeys.length,
    stepCount: manifest.journeys.reduce((acc, j) => acc + j.steps.length, 0),
    matrixViewports: manifest.matrix.viewports.length,
    matrixBrowsers: manifest.matrix.browsers.length,
    matrixSessions: manifest.matrix.sessions,
    matrixAccessibility: manifest.matrix.accessibility.length,
    hasKnownDefects: manifest.knownDefects.length > 0,
    feFirstMode: manifest.feFirst,
  };
}

export const _internal = { computeContentChecksum };
