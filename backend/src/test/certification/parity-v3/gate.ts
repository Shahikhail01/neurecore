/**
 * P9 — Gate P9 verdict computation.
 *
 * Reference: parity-v3/NEURECORE-CREATIO-AI-PARITY-GAP-CLOSURE-PLAN-v3 §5
 *  (Gate P9), §7 (thresholds), §8 (artifacts).
 *
 * The gate consumes:
 *   - the parity-v3 baseline YAML (`creatio-parity-baseline.yaml`)
 *   - the requirements traceability matrix YAML
 *     (`requirements-traceability-matrix.yaml`)
 *   - a list of cross-tenant probe results (zero required)
 *   - the suite results (clean-run rate, scenario pass/fail)
 *   - SLO / cost / resilience / rollback evidence (provided by the
 *     CI pipeline that runs the suite)
 *
 * The verdict is APPROVED only when ALL rules pass:
 *   1. 100% in-scope baseline rows are CERTIFIED or
 *      INTENTIONAL_DIFFERENCE.
 *   2. Zero critical/high security defects.
 *   3. Zero cross-tenant exposure.
 *   4. Zero approval bypass.
 *   5. Zero duplicate external effects.
 *   6. Critical journeys 100%.
 *   7. Clean-run rate >= 98%.
 *   8. a11y / SLO / cost / resilience / rollback thresholds pass.
 */

export type BaselineStatus =
  | 'CERTIFIED'
  | 'INTENTIONAL_DIFFERENCE'
  | 'IN_PROGRESS'
  | 'NOT_STARTED'
  | 'BLOCKED';

export interface BaselineRow {
  readonly id: string;
  readonly status: BaselineStatus;
  readonly inScope: boolean;
  readonly intentionalDifference: boolean;
}

export interface CrossTenantProbeResult {
  readonly scenarioId: string;
  readonly denied: boolean;
}

export interface P9SuiteResult {
  readonly scenarioId: string;
  readonly criticalJourney: boolean;
  readonly passed: boolean;
}

export interface P9SecurityDefect {
  readonly id: string;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly title: string;
}

export interface P9Thresholds {
  readonly cleanRunRateMin: number;
  readonly crossTenantDenialRateMin: number;
  readonly criticalJourneyPassRateMin: number;
}

export interface P9AuxiliaryEvidence {
  readonly a11yPassed: boolean;
  readonly sloPassed: boolean;
  readonly costPassed: boolean;
  readonly resiliencePassed: boolean;
  readonly rollbackPassed: boolean;
}

export interface GateP9Input {
  readonly baseline: ReadonlyArray<BaselineRow>;
  readonly rtmCapabilityIds: ReadonlyArray<string>;
  readonly crossTenantProbes: ReadonlyArray<CrossTenantProbeResult>;
  readonly suiteResults: ReadonlyArray<P9SuiteResult>;
  readonly securityDefects: ReadonlyArray<P9SecurityDefect>;
  readonly duplicateExternalEffects: number;
  readonly approvalBypasses: number;
  readonly thresholds: P9Thresholds;
  readonly auxiliary: P9AuxiliaryEvidence;
}

export interface GateP9Rule {
  readonly id: string;
  readonly description: string;
  readonly ok: boolean;
  readonly observed: string;
}

export interface GateP9Summary {
  readonly approved: boolean;
  readonly rules: ReadonlyArray<GateP9Rule>;
  readonly totals: {
    readonly baselineRows: number;
    readonly inScopeRows: number;
    readonly certifiedOrIntentional: number;
    readonly uncertifiedInScope: number;
    readonly unmappedCapabilities: number;
    readonly cleanRunRate: number;
    readonly criticalJourneyPassRate: number;
    readonly crossTenantDenialRate: number;
    readonly criticalSecurityDefects: number;
    readonly highSecurityDefects: number;
    readonly duplicateExternalEffects: number;
    readonly approvalBypasses: number;
  };
}

export const DEFAULT_THRESHOLDS: P9Thresholds = {
  cleanRunRateMin: 0.98,
  crossTenantDenialRateMin: 1,
  criticalJourneyPassRateMin: 1,
};

export function computeGateP9(input: GateP9Input): GateP9Summary {
  const inScopeRows = input.baseline.filter((r) => r.inScope);
  const certifiedOrIntentional = inScopeRows.filter(
    (r) =>
      r.status === 'CERTIFIED' ||
      (r.status === 'INTENTIONAL_DIFFERENCE' && r.intentionalDifference),
  );
  const uncertifiedInScope = inScopeRows.filter(
    (r) =>
      !(
        r.status === 'CERTIFIED' ||
        (r.status === 'INTENTIONAL_DIFFERENCE' && r.intentionalDifference)
      ),
  );

  const baselineIds = new Set(input.baseline.map((r) => r.id));
  const unmappedCapabilities = input.rtmCapabilityIds.filter(
    (id) => !baselineIds.has(id),
  );

  const totalScenarios = input.suiteResults.length;
  const cleanRuns = input.suiteResults.filter((r) => r.passed);
  const cleanRunRate =
    totalScenarios === 0 ? 0 : cleanRuns.length / totalScenarios;

  const criticalJourneys = input.suiteResults.filter((r) => r.criticalJourney);
  const criticalPassed = criticalJourneys.filter((r) => r.passed);
  const criticalJourneyPassRate =
    criticalJourneys.length === 0
      ? 1
      : criticalPassed.length / criticalJourneys.length;

  const deniedProbes = input.crossTenantProbes.filter((r) => r.denied);
  const crossTenantDenialRate =
    input.crossTenantProbes.length === 0
      ? 1
      : deniedProbes.length / input.crossTenantProbes.length;

  const criticalSecurityDefects = input.securityDefects.filter(
    (d) => d.severity === 'critical',
  ).length;
  const highSecurityDefects = input.securityDefects.filter(
    (d) => d.severity === 'high',
  ).length;

  const rules: GateP9Rule[] = [
    {
      id: 'P9-01',
      description:
        '100% in-scope baseline rows are CERTIFIED or INTENTIONAL_DIFFERENCE',
      ok: uncertifiedInScope.length === 0,
      observed: `${certifiedOrIntentional.length}/${inScopeRows.length} in-scope rows pass`,
    },
    {
      id: 'P9-02',
      description: 'Zero critical security defects',
      ok: criticalSecurityDefects === 0,
      observed: `${criticalSecurityDefects} critical defects`,
    },
    {
      id: 'P9-03',
      description: 'Zero high security defects',
      ok: highSecurityDefects === 0,
      observed: `${highSecurityDefects} high defects`,
    },
    {
      id: 'P9-04',
      description: 'Zero cross-tenant exposure',
      ok: crossTenantDenialRate >= input.thresholds.crossTenantDenialRateMin,
      observed: `denial rate ${(crossTenantDenialRate * 100).toFixed(2)}%`,
    },
    {
      id: 'P9-05',
      description: 'Zero approval bypass',
      ok: input.approvalBypasses === 0,
      observed: `${input.approvalBypasses} bypasses`,
    },
    {
      id: 'P9-06',
      description: 'Zero duplicate external effects',
      ok: input.duplicateExternalEffects === 0,
      observed: `${input.duplicateExternalEffects} duplicates`,
    },
    {
      id: 'P9-07',
      description: 'Critical journeys 100%',
      ok:
        criticalJourneyPassRate >= input.thresholds.criticalJourneyPassRateMin,
      observed: `${(criticalJourneyPassRate * 100).toFixed(2)}%`,
    },
    {
      id: 'P9-08',
      description: `Clean-run rate >= ${(input.thresholds.cleanRunRateMin * 100).toFixed(0)}%`,
      ok: cleanRunRate >= input.thresholds.cleanRunRateMin,
      observed: `${(cleanRunRate * 100).toFixed(2)}%`,
    },
    {
      id: 'P9-09',
      description: 'a11y thresholds pass',
      ok: input.auxiliary.a11yPassed,
      observed: input.auxiliary.a11yPassed ? 'passed' : 'failed',
    },
    {
      id: 'P9-10',
      description: 'SLO thresholds pass',
      ok: input.auxiliary.sloPassed,
      observed: input.auxiliary.sloPassed ? 'passed' : 'failed',
    },
    {
      id: 'P9-11',
      description: 'Cost thresholds pass',
      ok: input.auxiliary.costPassed,
      observed: input.auxiliary.costPassed ? 'passed' : 'failed',
    },
    {
      id: 'P9-12',
      description: 'Resilience thresholds pass',
      ok: input.auxiliary.resiliencePassed,
      observed: input.auxiliary.resiliencePassed ? 'passed' : 'failed',
    },
    {
      id: 'P9-13',
      description: 'Rollback thresholds pass',
      ok: input.auxiliary.rollbackPassed,
      observed: input.auxiliary.rollbackPassed ? 'passed' : 'failed',
    },
    {
      id: 'P9-14',
      description: 'Zero unmapped RTM capabilities',
      ok: unmappedCapabilities.length === 0,
      observed: `${unmappedCapabilities.length} unmapped`,
    },
  ];

  const approved = rules.every((r) => r.ok);

  return {
    approved,
    rules,
    totals: {
      baselineRows: input.baseline.length,
      inScopeRows: inScopeRows.length,
      certifiedOrIntentional: certifiedOrIntentional.length,
      uncertifiedInScope: uncertifiedInScope.length,
      unmappedCapabilities: unmappedCapabilities.length,
      cleanRunRate,
      criticalJourneyPassRate,
      crossTenantDenialRate,
      criticalSecurityDefects,
      highSecurityDefects,
      duplicateExternalEffects: input.duplicateExternalEffects,
      approvalBypasses: input.approvalBypasses,
    },
  };
}

/**
 * Pure-YAML helpers. The runner uses these to ingest the baseline
 * without pulling in a YAML dependency; the format produced by the
 * upstream baseline editor is line-oriented and stable.
 */
export function parseBaselineStatuses(
  raw: string,
  inScopeIds: ReadonlySet<string>,
): BaselineRow[] {
  const lines = raw.split(/\r?\n/);
  const rows: BaselineRow[] = [];
  let currentId: string | null = null;
  let currentStatus: BaselineStatus | null = null;
  let intentionalDifference = false;
  for (const line of lines) {
    const idMatch = line.match(/^\s+- id: (CR-AI-\d+)/);
    if (idMatch) {
      if (currentId) {
        rows.push({
          id: currentId,
          status: currentStatus ?? 'NOT_STARTED',
          inScope: inScopeIds.has(currentId),
          intentionalDifference,
        });
      }
      currentId = idMatch[1];
      currentStatus = null;
      intentionalDifference = false;
      continue;
    }
    const statusMatch = line.match(/^\s+status: ([A-Z_]+)/);
    if (statusMatch && currentId) {
      currentStatus = statusMatch[1] as BaselineStatus;
      continue;
    }
    const diffMatch = line.match(/^\s+intentional_difference: (?!null)(.+)/);
    if (diffMatch && currentId) {
      intentionalDifference = true;
    }
  }
  if (currentId) {
    rows.push({
      id: currentId,
      status: currentStatus ?? 'NOT_STARTED',
      inScope: inScopeIds.has(currentId),
      intentionalDifference,
    });
  }
  return rows;
}

export function parseRtmCapabilityIds(raw: string): string[] {
  const matches = [...raw.matchAll(/^\s+- capability_id: (CR-AI-\d+)/gm)];
  return matches.map((m) => m[1]);
}
