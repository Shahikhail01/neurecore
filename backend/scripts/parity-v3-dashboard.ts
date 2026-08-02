// scripts/parity-v3-dashboard.ts
/**
 * P9 — Render the parity-v3 dashboard from the machine-readable JSON.
 *
 * Usage:
 *   pnpm ts-node scripts/parity-v3-dashboard.ts \
 *       --in backend/src/test/certification/parity-v3/reports/parity-v3-machine-readable.json \
 *       --out backend/src/test/certification/parity-v3/reports
 */

import * as fs from 'fs';
import * as path from 'path';

interface Args {
  inPath: string;
  outDir: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let inPath = path.join(
    __dirname,
    '..',
    'src',
    'test',
    'certification',
    'parity-v3',
    'reports',
    'parity-v3-machine-readable.json',
  );
  let outDir = path.join(
    __dirname,
    '..',
    'src',
    'test',
    'certification',
    'parity-v3',
    'reports',
  );
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') inPath = argv[++i];
    else if (argv[i] === '--out') outDir = argv[++i];
  }
  return { inPath, outDir };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDashboard(jsonPath: string): string {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const report = JSON.parse(raw) as {
    runId: string;
    timestamp: string;
    gateP9: {
      approved: boolean;
      rules: ReadonlyArray<{
        id: string;
        description: string;
        ok: boolean;
        observed: string;
      }>;
      totals: {
        baselineRows: number;
        inScopeRows: number;
        certifiedOrIntentional: number;
      };
    };
    benchmarkTenants: { tenantAId: string; tenantBId: string };
    scenarioResults: ReadonlyArray<{
      scenario: {
        scenarioId: string;
        capabilityIds: ReadonlyArray<string>;
        criticalJourney: boolean;
      };
      passed: boolean;
      durationMs: number;
    }>;
  };
  const verdictClass = report.gateP9.approved
    ? 'verdict-approved'
    : 'verdict-blocked';
  const verdictText = report.gateP9.approved ? 'APPROVED' : 'BLOCKED';
  const ruleRows = report.gateP9.rules
    .map(
      (r) =>
        `<tr class="${r.ok ? 'ok' : 'fail'}"><td>${escapeHtml(r.id)}</td>` +
        `<td>${escapeHtml(r.description)}</td>` +
        `<td>${r.ok ? 'PASS' : 'FAIL'}</td>` +
        `<td>${escapeHtml(r.observed)}</td></tr>`,
    )
    .join('');
  const scenarioRows = report.scenarioResults
    .map(
      (r) =>
        `<tr class="${r.passed ? 'ok' : 'fail'}"><td>${escapeHtml(r.scenario.scenarioId)}</td>` +
        `<td>${escapeHtml(r.scenario.capabilityIds.join(', '))}</td>` +
        `<td>${r.scenario.criticalJourney ? 'YES' : 'no'}</td>` +
        `<td>${r.passed ? 'PASS' : 'FAIL'}</td>` +
        `<td>${r.durationMs} ms</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Parity v3 — P9 Certification Dashboard</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { margin: 0 0 8px 0; }
  .${verdictClass} { padding: 12px 16px; border-radius: 8px; font-weight: 700; font-size: 18px; display: inline-block; }
  .verdict-approved { background: #d3f3d3; color: #115522; }
  .verdict-blocked { background: #fbd3d3; color: #5a1111; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  tr.ok td { background: #f4faf4; }
  tr.fail td { background: #faf4f4; }
  .meta { margin-top: 12px; color: #444; }
</style>
</head>
<body>
<h1>Parity v3 — P9 Certification Dashboard</h1>
<div class="${verdictClass}">${verdictText}</div>
<div class="meta">
  <div>Run ID: ${escapeHtml(report.runId)}</div>
  <div>Timestamp: ${escapeHtml(report.timestamp)}</div>
  <div>Tenant A: ${escapeHtml(report.benchmarkTenants.tenantAId)}</div>
  <div>Tenant B: ${escapeHtml(report.benchmarkTenants.tenantBId)}</div>
  <div>Baseline rows: ${report.gateP9.totals.baselineRows} (in-scope: ${report.gateP9.totals.inScopeRows})</div>
  <div>Certified / intentional: ${report.gateP9.totals.certifiedOrIntentional}</div>
</div>
<h2>Gate P9 rules</h2>
<table>
  <thead><tr><th>ID</th><th>Description</th><th>Status</th><th>Observed</th></tr></thead>
  <tbody>${ruleRows}</tbody>
</table>
<h2>Scenario results</h2>
<table>
  <thead><tr><th>Scenario</th><th>Capabilities</th><th>Critical</th><th>Status</th><th>Duration</th></tr></thead>
  <tbody>${scenarioRows}</tbody>
</table>
</body>
</html>`;
}

function main(): void {
  const args = parseArgs();
  const html = renderDashboard(args.inPath);
  fs.mkdirSync(args.outDir, { recursive: true });
  const outPath = path.join(args.outDir, 'parity-v3-dashboard.html');
  fs.writeFileSync(outPath, html, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Dashboard rendered: ${outPath}`);
}

if (require.main === module) {
  main();
}
