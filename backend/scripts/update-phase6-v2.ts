#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 6 — v2.md row updater.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const V2 = path.resolve(
  REPO_ROOT,
  'neurecore/memory-bank-arc/comms/creatio-ai-parity-implementation-plan-v2.md',
);

interface RowUpdate {
  section: string;
  status: string;
}

const UPDATES: RowUpdate[] = [
  // Studio codegen (AI-Driven Development) — 5.13.6/7/8
  { section: '5.13.6', status: '✅' },
  { section: '5.13.7', status: '✅' },
  { section: '5.13.8', status: '✅' },
  // Custom components
  { section: '5.13.10', status: '✅' },
  // Marketplace publish flow
  { section: '5.13.11', status: '✅' },
  // Pre-built + custom integrations
  { section: '5.13.14', status: '🟡' },
  // ALM (environments, pipelines)
  { section: '5.13.15', status: '✅' },
  // DevOps and Continuous Delivery
  { section: '5.13.17', status: '✅' },
  // Analytics & Dashboards (deeper than observability)
  { section: '5.13.18', status: '✅' },
  // ─── Governance (5.14) ─────────────────────────────────────
  // Environments
  { section: '5.14.1', status: '✅' },
  // Scheduled audits (runner + cron + executor shipped)
  { section: '5.14.4', status: '✅' },
  // App health + escalation
  { section: '5.14.5', status: '🟡' },
  // Data governance (sensitive-data recognition still a follow-up)
  { section: '5.14.6', status: '🟡' },
  // User access governance (review tool still follow-up)
  { section: '5.14.7', status: '🟡' },
  // ─── Service (5.9) ─────────────────────────────────────────
  // SLA intelligence
  { section: '5.9.5', status: '✅' },
  // Root-cause analysis
  { section: '5.9.6', status: '✅' },
  // Field work order dispatch
  { section: '5.9.7', status: '✅' },
  // Knowledge self-curation
  { section: '5.9.8', status: '🟡' },
  // ─── Marketing (5.10) ──────────────────────────────────────
  // Landing page builder
  { section: '5.10.2', status: '✅' },
  // ─── Localization (5.20) ───────────────────────────────────
  // Per-user locale override
  { section: '5.20.4', status: '✅' },
];

function main(): void {
  const txt = fs.readFileSync(V2, 'utf8');
  const lines = txt.split('\n');
  let updated = 0;
  for (const upd of UPDATES) {
    const re = new RegExp(`^\\| ${upd.section.replace(/\./g, '\\.')} \\|`);
    let targetIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx < 0) {
      console.warn(`section ${upd.section} not found`);
      continue;
    }
    const cells = lines[targetIdx].split('|');
    if (cells.length < 4) continue;
    cells[3] = ` ${upd.status} `;
    lines[targetIdx] = cells.join('|');
    updated++;
  }
  fs.writeFileSync(V2, lines.join('\n'), 'utf8');
  console.log(
    `updated ${updated} sections across ${UPDATES.length} capability rows in ${path.relative(REPO_ROOT, V2)}`,
  );
}

main();
