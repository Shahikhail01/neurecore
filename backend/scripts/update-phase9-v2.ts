#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 9 — v2.md row updater.
 *
 * Promotes the remaining NOT_STARTED rows whose work was completed in
 * Phase 1 / Phase 8 / Phase 9. Promotes 5.17.7 (Phase 9.1).
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
  // Coding Agent SDK Bridge — Phase 8.1.
  { section: '5.1.2', status: '✅' },
  // AI Twin wizard — Phase 1 (permission mirror) + Phase 8.1 (deploy gate).
  { section: '5.3.1', status: '✅' },
  { section: '5.3.2', status: '✅' },
  { section: '5.3.3', status: '✅' },
  // Regional / data residency — Phase 9.1.
  { section: '5.17.7', status: '✅' },
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
