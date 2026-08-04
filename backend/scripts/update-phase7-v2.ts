#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 7 — v2.md row updater.
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
  // §5.4.3 / §5.4.17 — actually built in Phase 1 (LLM Registry) and
  // Phase 7 (XAI envelope). The v2.md was lagging — bring up to date.
  { section: '5.4.3', status: '✅' },
  { section: '5.17.4', status: '✅' },
  { section: '5.17.5', status: '✅' },
  // §5.9 service-platform extras.
  { section: '5.9.1', status: '✅' },
  { section: '5.9.2', status: '✅' },
  { section: '5.9.3', status: '✅' },
  // 5.9.4 = self-service chatbot persona (Phase 7.1)
  { section: '5.9.4', status: '✅' },
  // 5.9.8 = knowledge self-curation (Phase 7.1)
  { section: '5.9.8', status: '✅' },
  // 5.10.1 = intent signals (Phase 7.1)
  { section: '5.10.1', status: '✅' },
  // 5.10.4 / 5.10.5 — events + partners (Phase 7.1)
  { section: '5.10.4', status: '✅' },
  { section: '5.10.5', status: '✅' },
  // 5.11.3 / 5.11.4 / 5.11.5 — quotes / field sales / lead routing
  { section: '5.11.3', status: '✅' },
  { section: '5.11.4', status: '✅' },
  { section: '5.11.5', status: '✅' },
  // 5.11.2 — outreach (data model present; full orchestrator is a
  // Phase 8 candidate) — leave PARTIAL.
  // 5.13.13 — No-code Governance Automation (composes Phase 2)
  { section: '5.13.13', status: '✅' },
  // 5.14.3 — Custom governance controls
  { section: '5.14.3', status: '✅' },
  // 5.14.8 / 5.14.9 / 5.14.12 — Operational / Security / Internal
  { section: '5.14.8', status: '✅' },
  { section: '5.14.9', status: '✅' },
  { section: '5.14.12', status: '✅' },
  // 5.4.17 — Explainable AI
  { section: '5.4.17', status: '✅' },
  // 5.4.19 — Bias awareness (documented, not a product gate)
  { section: '5.4.19', status: '✅' },
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
