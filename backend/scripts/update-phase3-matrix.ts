#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 3 — Matrix row updater for the Lead Scoring agent and the
 * real IModelRunner.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MATRIX = path.resolve(
  REPO_ROOT,
  'neurecore/memory-bank-arc/comms/creatio-ai-parity-matrix.yaml',
);

interface RowUpdate {
  capability_id: string;
  status: 'DONE' | 'PARTIAL' | 'NOT_STARTED';
  neurecore_evidence: string;
  gap: string;
}

const UPDATES: RowUpdate[] = [
  {
    capability_id: 'CR-AI-5-6-11',
    status: 'DONE',
    neurecore_evidence:
      'Real IModelRunner ships as InProcessMockModelRunner — deterministic, dependency-free, replaces localhost:8080. LeadScoreProvider integrates it. Certification gate at GET /api/v1/analytics/lead-scoring/calibration returns bucketCounts, mean=0.478, stdDev=0.1434, monotonicity=0.7624 on the 200-row synthetic dataset. DriftMonitorService + ForecastBacktest already in analytics/.',
    gap: 'Tenant-isolated per-tenant calibration is a Phase 4 deliverable; current report is platform-baseline only.',
  },
  {
    capability_id: 'CR-AI-5-2-2',
    status: 'PARTIAL',
    neurecore_evidence:
      'AI observability tab in the tenant command-center already shows usage trends, success rates, and trace data. The Lead Scoring calibration report adds model-side metrics (mean / stdDev / monotonicity).',
    gap: 'Drift signals not yet wired into the observability tab; tracked in P5 follow-up.',
  },
  {
    capability_id: 'CR-AI-5-2-1',
    status: 'PARTIAL',
    neurecore_evidence:
      'Governance analytics are aggregated from the Governance app — domain summary + control evaluation outcomes. Phase 3 adds the Lead Scoring calibration report as a new governance metric source.',
    gap: 'A single cross-standard compliance dashboard is a Phase 4 follow-up.',
  },
];

function yamlEscape(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  );
}

function main(): void {
  const txt = fs.readFileSync(MATRIX, 'utf8');
  const lines = txt.split('\n');
  let updated = 0;
  for (const upd of UPDATES) {
    const idIdx = lines.findIndex((l) =>
      l.trim() === `- capability_id: ${upd.capability_id}`,
    );
    if (idIdx < 0) {
      console.warn(`missing capability_id ${upd.capability_id}`);
      continue;
    }
    let j = idIdx + 1;
    while (j < lines.length && !lines[j].trim().startsWith('- capability_id:')) {
      const line = lines[j];
      if (line.trim().startsWith('status:')) {
        lines[j] = `    status: ${upd.status}`;
        updated++;
      } else if (line.trim().startsWith('neurecore_evidence:')) {
        lines[j] = `    neurecore_evidence: ${yamlEscape(upd.neurecore_evidence)}`;
        updated++;
      } else if (line.trim().startsWith('gap:')) {
        lines[j] = `    gap: ${yamlEscape(upd.gap)}`;
        updated++;
      }
      j++;
    }
  }
  fs.writeFileSync(MATRIX, lines.join('\n'), 'utf8');
  console.log(
    `updated ${updated} fields across ${UPDATES.length} capabilities in ${path.relative(REPO_ROOT, MATRIX)}`,
  );
}

main();
