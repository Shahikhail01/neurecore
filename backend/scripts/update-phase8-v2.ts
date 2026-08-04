#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 8.3 — Promote Phase 8 work in v2.md.
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
  // AI Twin wizard extras — built in Phase 1 + Phase 8.1.
  { section: '5.3.4', status: '✅' },
  { section: '5.3.5', status: '✅' },
  { section: '5.3.6', status: '✅' },
  { section: '5.3.7', status: '✅' },
  // Sales outreach orchestrator — built Phase 8.2.
  { section: '5.11.2', status: '✅' },
  // Mobile omnichannel experiences — Phase 5.4 (mobile companion) +
  // Phase 8.2 (mobile session persistence).
  { section: '5.13.16', status: '✅' },
  // AI-Driven Development — Studio codegen ships in Phase 6.
  { section: '5.13.6', status: '✅' },
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
