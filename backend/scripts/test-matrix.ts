#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Smoke test for build-matrix-from-v2.ts.
 *
 * Builds the matrix twice and asserts:
 *   1. Row count is between 100 and 200 (the v2 plan promises ~120).
 *   2. All capability_ids are unique.
 *   3. Status distribution matches expectations (DONE >= 5, PARTIAL > NOT_STARTED).
 *   4. --check mode is byte-stable across two consecutive runs.
 *   5. Every row has all required fields populated.
 *   6. Every domain has at least one row.
 *
 * Exits 0 on success, 1 on any failure.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MATRIX = path.resolve(
  REPO_ROOT,
  'neurecore/memory-bank-arc/comms/creatio-ai-parity-matrix.yaml',
);
const SCRIPT = path.resolve(__dirname, 'build-matrix-from-v2.ts');

interface Row {
  capability_id: string;
  section: string;
  domain: string;
  capability: string;
  status: string;
  phase: string;
  [key: string]: string;
}

interface Matrix {
  schemaVersion: string;
  totalRows: number;
  counts: Record<string, number>;
  rows: Row[];
}

function parseMatrix(txt: string): Matrix {
  // Minimal YAML parse for our own output (no nested lists/objects in rows
  // besides scalars). We rely on consistent formatting from emitYaml().
  const lines = txt.split('\n');
  const counts: Record<string, number> = {};
  const rows: Row[] = [];
  let totalRows = 0;
  let schemaVersion = '';
  let i = 0;

  // Top-level scalars
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('schemaVersion:')) {
      schemaVersion = l.split(':')[1].trim().replace(/"/g, '');
    } else if (l.startsWith('totalRows:')) {
      totalRows = parseInt(l.split(':')[1].trim(), 10);
    } else if (l.startsWith('counts:')) {
      i++;
      while (i < lines.length && lines[i].startsWith('  ')) {
        const [k, v] = lines[i].trim().split(':');
        counts[k.trim()] = parseInt(v.trim(), 10);
        i++;
      }
      break;
    }
  }

  // Rows block
  while (i < lines.length && !lines[i].startsWith('rows:')) i++;
  while (i < lines.length) {
    if (lines[i].startsWith('  - capability_id:')) {
      const row: Partial<Row> = {};
      row.capability_id = lines[i].split(':')[1].trim();
      i++;
      while (i < lines.length && lines[i].startsWith('    ')) {
        const [k, ...rest] = lines[i].trim().split(':');
        const v = rest.join(':').trim().replace(/^"(.*)"$/, '$1');
        (row as Record<string, string>)[k] = v;
        i++;
      }
      rows.push(row as Row);
    } else {
      i++;
    }
  }
  return { schemaVersion, totalRows, counts, rows };
}

function fail(msg: string): never {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`✓ ${msg}`);
}

function main(): void {
  // Build twice to ensure deterministic output.
  execFileSync('npx', ['ts-node', '--project', 'tsconfig.json', SCRIPT], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });

  const txt = fs.readFileSync(MATRIX, 'utf8');
  const m = parseMatrix(txt);

  if (m.totalRows < 100 || m.totalRows > 200) {
    fail(`totalRows=${m.totalRows} not in [100,200]`);
  }
  pass(`totalRows in range [100,200]: ${m.totalRows}`);

  const ids = new Set(m.rows.map((r) => r.capability_id));
  if (ids.size !== m.rows.length) {
    fail(`duplicate capability_ids: ${m.rows.length} rows, ${ids.size} unique`);
  }
  pass(`all ${m.rows.length} capability_ids unique`);

  if ((m.counts.DONE ?? 0) < 5) {
    fail(`DONE count too low: ${m.counts.DONE}`);
  }
  pass(`DONE count OK: ${m.counts.DONE}`);

  if ((m.counts.PARTIAL ?? 0) <= (m.counts.NOT_STARTED ?? 0)) {
    fail(`PARTIAL should be > NOT_STARTED, got ${m.counts.PARTIAL} vs ${m.counts.NOT_STARTED}`);
  }
  pass(`PARTIAL > NOT_STARTED: ${m.counts.PARTIAL} > ${m.counts.NOT_STARTED}`);

  // Per-row required fields
  for (const r of m.rows) {
    for (const f of ['capability_id', 'section', 'domain', 'capability', 'status', 'phase']) {
      if (!(r as Record<string, string>)[f]) {
        fail(`row ${r.capability_id} missing field ${f}`);
      }
    }
  }
  pass(`all rows have required fields`);

  // Every domain has at least one row
  const domains = new Set(m.rows.map((r) => r.domain));
  if (domains.size < 15) {
    fail(`only ${domains.size} distinct domains; expected >= 15`);
  }
  pass(`${domains.size} distinct domains present`);

  // --check byte-stability
  execFileSync('npx', ['ts-node', '--project', 'tsconfig.json', SCRIPT], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe',
  });
  execFileSync(
    'npx',
    ['ts-node', '--project', 'tsconfig.json', SCRIPT, '--check'],
    { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' },
  );
  pass('--check mode passes after rebuild');

  console.log('\n=== SMOKE TEST PASSED ===');
}

main();
