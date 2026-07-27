// scripts/certification-dashboard.ts
/**
 * Phase 9 G9 — Certification Dashboard Generator.
 *
 * Consumes the JSON report produced by the certification suite
 * (`g9-machine-readable.json`) and emits:
 *
 *   1. `g9-dashboard.html` — operator-friendly report
 *   2. `g9-summary.json` — flattened G9 gate summary
 *
 * Usage:
 *   pnpm ts-node scripts/certification-dashboard.ts \
 *       --in src/test/certification/reports/g9-machine-readable.json \
 *       --out src/test/certification/reports
 *
 * Per NC-AWL-IMP-1 §11.4:
 *   "Machine-readable results and Certification dashboard"
 */

import * as fs from 'fs';
import * as path from 'path';

interface Args {
  inPath: string;
  outDir: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let inPath = 'src/test/certification/reports/g9-machine-readable.json';
  let outDir = 'src/test/certification/reports';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') inPath = argv[++i];
    else if (argv[i] === '--out') outDir = argv[++i];
  }
  return { inPath, outDir };
}

interface CertificationRunReport {
  runId: string;
  timestamp: string;
  gateG9: {
    totalScenarios: number;
    passed: number;
    failed: number;
    passRate: number;
    cleanRunPassRate: number;
    duplicateSuppressionRate: number;
    workerRecoveryRate: number;
    transientRecoveryRate: number;
    revisionSuccessRate: number;
    sessionExpiryResilienceRate: number;
    socketDisabledRecoveryRate: number;
    crossTenantDenialRate: number;
    zeroDuplicateEffects: boolean;
    zeroCrossTenantExposure: boolean;
    everyRunHasEvidence: boolean;
    releaseApproved: boolean;
  };
  results: Array<{
    scenarioId: string;
    type: string;
    passed: boolean;
    duration: number;
    startedAt: string;
    finishedAt: string;
    errors: string[];
    expectedErrors: string[];
    metrics: Record<string, number>;
    failureRecords: ReadonlyArray<{ mode: string; recovered: boolean }>;
    correlationTrail: ReadonlyArray<{ correlationId: string }>;
  }>;
}

interface DashboardReport {
  runId: string;
  timestamp: string;
  summary: Record<string, number | boolean | string>;
  results: CertificationRunReport['results'];
  gateG9: CertificationRunReport['gateG9'];
}

function classifyGate(g: CertificationRunReport['gateG9']): { ok: string[]; failing: string[] } {
  const ok: string[] = [];
  const failing: string[] = [];
  const rules: Array<[string, boolean]> = [
    ['100% critical-path tests pass', g.passed === g.totalScenarios && g.totalScenarios > 0],
    ['Zero duplicate projects/tasks from retries', g.zeroDuplicateEffects],
    ['Zero cross-tenant data exposure', g.zeroCrossTenantExposure],
    ['All runs preserve evidence trail', g.everyRunHasEvidence],
    ['>=98% clean runs complete without engineering intervention', g.cleanRunPassRate >= 0.98],
    ['Duplicate suppression >=99%', g.duplicateSuppressionRate >= 0.99],
    ['Worker recovery >=99%', g.workerRecoveryRate >= 0.99],
    ['Transient failure recovery >=90%', g.transientRecoveryRate >= 0.9],
    ['Revision cycle reliability >=99%', g.revisionSuccessRate >= 0.99],
    ['Session expiry resilience >=99%', g.sessionExpiryResilienceRate >= 0.99],
    ['Socket-disabled recovery >=99%', g.socketDisabledRecoveryRate >= 0.99],
    ['Cross-tenant denial =100%', g.crossTenantDenialRate === 1],
  ];
  for (const [label, ok_] of rules) (ok_ ? ok : failing).push(label);
  return { ok, failing };
}

function renderHtml(report: DashboardReport): string {
  const { ok, failing } = classifyGate(report.gateG9);
  const passPct = (report.gateG9.passRate * 100).toFixed(2);
  const cleanPct = (report.gateG9.cleanRunPassRate * 100).toFixed(2);
  const dupPct = (report.gateG9.duplicateSuppressionRate * 100).toFixed(2);
  const restartPct = (report.gateG9.workerRecoveryRate * 100).toFixed(2);
  const transientPct = (report.gateG9.transientRecoveryRate * 100).toFixed(2);
  const revisionPct = (report.gateG9.revisionSuccessRate * 100).toFixed(2);
  const sessionPct = (report.gateG9.sessionExpiryResilienceRate * 100).toFixed(2);
  const socketPct = (report.gateG9.socketDisabledRecoveryRate * 100).toFixed(2);
  const xtenantPct = (report.gateG9.crossTenantDenialRate * 100).toFixed(2);

  const rows = report.results
    .map(
      (r) => `<tr class="${r.passed ? 'pass' : 'fail'}">
        <td>${r.scenarioId}</td>
        <td>${r.type}</td>
        <td>${r.passed ? 'PASS' : 'FAIL'}</td>
        <td>${r.duration}ms</td>
        <td>${r.errors.length === 0 ? '—' : r.errors.join('; ')}</td>
      </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Phase 9 G9 — Certification Dashboard</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 2rem; color: #111; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #666; margin-bottom: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .card { padding: 1rem; border: 1px solid #ddd; border-radius: 6px; }
  .card .pct { font-size: 1.6rem; font-weight: 600; }
  .card .label { color: #666; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #eee; }
  tr.pass td { background: #f4fbf4; }
  tr.fail td { background: #fbf4f4; }
  ul.ok { color: #0a7a2a; }
  ul.fail { color: #b00020; }
  .verdict { padding: 1rem; border-radius: 6px; font-weight: 600; }
  .verdict.approved { background: #e9f7ec; color: #0a7a2a; }
  .verdict.rejected { background: #fce8eb; color: #b00020; }
</style>
</head>
<body>
  <h1>Phase 9 G9 — Golden-Path Certification Dashboard</h1>
  <div class="meta">Run <code>${report.runId}</code> · ${report.timestamp}</div>

  <div class="verdict ${report.gateG9.releaseApproved ? 'approved' : 'rejected'}">
    ${report.gateG9.releaseApproved ? 'RELEASE APPROVED' : 'RELEASE BLOCKED'}
  </div>

  <div class="grid">
    <div class="card"><div class="pct">${passPct}%</div><div class="label">Pass rate</div></div>
    <div class="card"><div class="pct">${cleanPct}%</div><div class="label">Clean runs</div></div>
    <div class="card"><div class="pct">${dupPct}%</div><div class="label">Dup suppression</div></div>
    <div class="card"><div class="pct">${restartPct}%</div><div class="label">Worker recovery</div></div>
    <div class="card"><div class="pct">${transientPct}%</div><div class="label">Transient recovery</div></div>
    <div class="card"><div class="pct">${revisionPct}%</div><div class="label">Revision cycles</div></div>
    <div class="card"><div class="pct">${sessionPct}%</div><div class="label">Session expiry</div></div>
    <div class="card"><div class="pct">${socketPct}%</div><div class="label">Socket recovery</div></div>
    <div class="card"><div class="pct">${xtenantPct}%</div><div class="label">Cross-tenant denial</div></div>
  </div>

  <h2>Gate G9</h2>
  <ul class="ok">${ok.map((s) => `<li>${s}</li>`).join('')}</ul>
  ${
    failing.length > 0
      ? `<ul class="fail">${failing.map((s) => `<li>${s}</li>`).join('')}</ul>`
      : '<p>No failing rules.</p>'
  }

  <h2>Per-scenario results</h2>
  <table>
    <thead><tr><th>Scenario</th><th>Type</th><th>Result</th><th>Duration</th><th>Errors</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function main(): void {
  const args = parseArgs();
  if (!fs.existsSync(args.inPath)) {
    console.error(`Input not found: ${args.inPath}`);
    process.exit(1);
  }

  const report: CertificationRunReport = JSON.parse(
    fs.readFileSync(args.inPath, 'utf-8'),
  );

  fs.mkdirSync(args.outDir, { recursive: true });

  const summary: DashboardReport['summary'] = {
    runId: report.runId,
    timestamp: report.timestamp,
    totalScenarios: report.gateG9.totalScenarios,
    passed: report.gateG9.passed,
    failed: report.gateG9.failed,
    passRate: report.gateG9.passRate,
    cleanRunPassRate: report.gateG9.cleanRunPassRate,
    duplicateSuppressionRate: report.gateG9.duplicateSuppressionRate,
    workerRecoveryRate: report.gateG9.workerRecoveryRate,
    transientRecoveryRate: report.gateG9.transientRecoveryRate,
    revisionSuccessRate: report.gateG9.revisionSuccessRate,
    sessionExpiryResilienceRate: report.gateG9.sessionExpiryResilienceRate,
    socketDisabledRecoveryRate: report.gateG9.socketDisabledRecoveryRate,
    crossTenantDenialRate: report.gateG9.crossTenantDenialRate,
    zeroDuplicateEffects: report.gateG9.zeroDuplicateEffects,
    zeroCrossTenantExposure: report.gateG9.zeroCrossTenantExposure,
    everyRunHasEvidence: report.gateG9.everyRunHasEvidence,
    releaseApproved: report.gateG9.releaseApproved,
  };

  const dashboard: DashboardReport = {
    runId: report.runId,
    timestamp: report.timestamp,
    summary,
    results: report.results,
    gateG9: report.gateG9,
  };

  const htmlPath = path.join(args.outDir, 'g9-dashboard.html');
  const summaryPath = path.join(args.outDir, 'g9-summary.json');

  fs.writeFileSync(htmlPath, renderHtml(dashboard), 'utf-8');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');

  console.log(`Wrote ${htmlPath}`);
  console.log(`Wrote ${summaryPath}`);
  console.log(
    `Gate G9 verdict: ${report.gateG9.releaseApproved ? 'APPROVED' : 'BLOCKED'} (${passFailSummary(report.gateG9)})`,
  );
}

function passFailSummary(g: CertificationRunReport['gateG9']): string {
  return `${g.passed}/${g.totalScenarios} passed, ${(g.passRate * 100).toFixed(2)}% pass rate`;
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
