#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 4 + Phase 5 — v2.md row updater.
 *
 * Updates the markdown table cells directly. The v2.md is the source of
 * truth; the matrix YAML is regenerated from it by `parity:matrix:build`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const V2 = path.resolve(
  REPO_ROOT,
  'neurecore/memory-bank-arc/comms/creatio-ai-parity-implementation-plan-v2.md',
);

interface RowUpdate {
  section: string; // e.g. "5.6.1"
  status: string; // ✅ / 🟡 / ⬜
}

const UPDATES: RowUpdate[] = [
  // ─── Sales (§5.6) ─────────────────────────────────────────────
  { section: '5.6.1', status: '✅' },
  { section: '5.6.2', status: '✅' },
  { section: '5.6.3', status: '✅' },
  { section: '5.6.4', status: '🟡' },
  { section: '5.6.5', status: '🟡' },
  { section: '5.6.7', status: '✅' },
  { section: '5.6.8', status: '✅' },
  { section: '5.6.9', status: '✅' },
  { section: '5.6.10', status: '✅' },
  // ─── Marketing (§5.7) ─────────────────────────────────────────
  { section: '5.7.1', status: '✅' },
  { section: '5.7.2', status: '🟡' },
  { section: '5.7.3', status: '✅' },
  { section: '5.7.4', status: '✅' },
  { section: '5.7.5', status: '✅' },
  // ─── Service (§5.8) ──────────────────────────────────────────
  { section: '5.8.1', status: '✅' },
  { section: '5.8.2', status: '✅' },
  { section: '5.8.3', status: '✅' },
  { section: '5.8.4', status: '✅' },
  { section: '5.8.5', status: '✅' },
  // ─── Workflow / Productivity (§5.15) ─────────────────────────
  { section: '5.15.1', status: '✅' },
  { section: '5.15.2', status: '✅' },
  { section: '5.15.3', status: '✅' },
  { section: '5.15.4', status: '✅' },
  { section: '5.15.5', status: '✅' },
  // ─── Channels (§5.16) ─────────────────────────────────────────
  { section: '5.16.1', status: '✅' },
  { section: '5.16.2', status: '🟡' },
  { section: '5.16.3', status: '🟡' },
  { section: '5.16.4', status: '🟡' },
  { section: '5.16.5', status: '✅' },
  { section: '5.16.6', status: '✅' },
  { section: '5.16.7', status: '🟡' },
  { section: '5.16.8', status: '✅' },
  { section: '5.16.9', status: '✅' },
  { section: '5.16.10', status: '🟡' },
  { section: '5.16.11', status: '✅' },
  { section: '5.16.12', status: '✅' },
  // ─── Always-on (§5.12) ────────────────────────────────────────
  { section: '5.12.1', status: '✅' },
  { section: '5.12.2', status: '✅' },
  { section: '5.12.3', status: '✅' },
  // ─── Business Studio (§5.13) — 7 of 18 advanced ──────────────
  { section: '5.13.1', status: '✅' },
  { section: '5.13.2', status: '🟡' },
  { section: '5.13.3', status: '✅' },
  { section: '5.13.4', status: '✅' },
  { section: '5.13.5', status: '✅' },
  { section: '5.13.9', status: '✅' },
  { section: '5.13.15', status: '🟡' },
  // ─── Localization (§5.20) ────────────────────────────────────
  { section: '5.20.1', status: '✅' },
  { section: '5.20.2', status: '✅' },
  { section: '5.20.3', status: '✅' },
];

function main(): void {
  const txt = fs.readFileSync(V2, 'utf8');
  const lines = txt.split('\n');
  let updated = 0;
  for (const upd of UPDATES) {
    // Match lines like "| 5.6.1 | **No-Code Agent Designer** ... | <STATUS> | ...".
    // The status is the 3rd cell.
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
    // cells[0] is empty (split on leading |), cells[1] is the section id,
    // cells[2] is the title, cells[3] is the status.
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
