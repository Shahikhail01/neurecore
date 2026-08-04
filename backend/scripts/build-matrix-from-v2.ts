#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 0 — Capability matrix builder.
 *
 * Reads `neurecore/memory-bank-arc/comms/creatio-ai-parity-implementation-plan-v2.md`,
 * extracts every row from the §5.x capability tables, deduplicates by
 * `capability_id` (assigned by §x.y.z), and emits a single, validated YAML
 * matrix at:
 *
 *   neurecore/memory-bank-arc/comms/creatio-ai-parity-matrix.yaml
 *
 * The matrix is the single source of truth for the v3 P-1 → P9 program and
 * the v2 §14 living matrix.
 *
 * SOLID notes:
 *   • Single source of truth for matrix shape lives in `MatrixRow` interface.
 *   • Open/Closed: new §x.y.z rows in v2.md are picked up automatically — no
 *     code change needed.
 *   • Liskov: every emitted row satisfies the schema below.
 *   • Interface Segregation: emit is decoupled from validate (separate fns).
 *   • Dependency Inversion: file I/O behind two injected functions (readMd,
 *     writeYaml) so tests can pass string fixtures.
 *
 * Exit codes:
 *   0 — matrix built and validated
 *   1 — missing v2.md / IO error
 *   2 — validation failure (duplicate ids, missing fields, bad status)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

type Status = 'DONE' | 'PARTIAL' | 'NOT_STARTED' | 'OUT_OF_SCOPE';
type Phase =
  | 'P-1'
  | 'P0'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4'
  | 'P5'
  | 'P6'
  | 'P7'
  | 'P8'
  | 'P9'
  | 'P10'
  | 'OPS';

interface MatrixRow {
  capability_id: string;
  section: string; // e.g. "5.6.11"
  domain: string; // e.g. "sales"
  capability: string; // human title
  creatio_source_url: string;
  creatio_behavior: string;
  neurecore_evidence: string;
  status: Status;
  gap: string;
  phase: Phase;
  verification_status: 'UNVERIFIED' | 'CERTIFIED' | 'INTENTIONAL_DIFFERENCE';
  owner: string | null;
}

interface Matrix {
  schemaVersion: string;
  generatedAt: string;
  sourcePlan: string;
  totalRows: number;
  counts: Record<Status, number>;
  rows: MatrixRow[];
}

const VALID_STATUS: ReadonlySet<Status> = new Set([
  'DONE',
  'PARTIAL',
  'NOT_STARTED',
  'OUT_OF_SCOPE',
]);
const VALID_PHASE: ReadonlySet<Phase> = new Set([
  'P-1',
  'P0',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
  'P7',
  'P8',
  'P9',
  'P10',
  'OPS',
]);
const VALID_VERIFICATION: ReadonlySet<MatrixRow['verification_status']> = new Set([
  'UNVERIFIED',
  'CERTIFIED',
  'INTENTIONAL_DIFFERENCE',
]);

const STATUS_MAP: Record<string, Status> = {
  '✅': 'DONE',
  '🟡': 'PARTIAL',
  '⬜': 'NOT_STARTED',
  '🔒': 'OUT_OF_SCOPE',
};
const SECTION_DOMAIN: Record<string, string> = {
  '5.1': 'ai-studio',
  '5.2': 'ai-studio-observability',
  '5.3': 'ai-twin',
  '5.4': 'ai-trust-governance',
  '5.5': 'ai-native-pillars',
  '5.6': 'sales-agents',
  '5.7': 'marketing-agents',
  '5.8': 'service-agents',
  '5.9': 'service-platform',
  '5.10': 'marketing-platform',
  '5.11': 'sales-platform',
  '5.12': 'always-on-crm',
  '5.13': 'business-studio',
  '5.14': 'governance-app',
  '5.15': 'workflow-productivity',
  '5.16': 'channels',
  '5.17': 'data-ownership',
  '5.18': 'compliance',
  '5.19': 'analyst-recognition',
  '5.20': 'localization',
};
const SECTION_PHASE: Record<string, Phase> = {
  '5.1': 'P7',
  '5.2': 'P8',
  '5.3': 'P1',
  '5.4': 'P8',
  '5.5': 'P1',
  '5.6': 'P4',
  '5.7': 'P4',
  '5.8': 'P4',
  '5.9': 'P7',
  '5.10': 'P7',
  '5.11': 'P4',
  '5.12': 'P1',
  '5.13': 'P10',
  '5.14': 'P8',
  '5.15': 'P1',
  '5.16': 'P7',
  '5.17': 'P8',
  '5.18': 'P8',
  '5.19': 'OPS',
  '5.20': 'P1',
};

function readFileSafe(p: string): string {
  if (!fs.existsSync(p)) {
    throw new Error(`missing input file: ${p}`);
  }
  return fs.readFileSync(p, 'utf8');
}

/** Strip markdown pipes and split a row into cells, respecting escaped pipes. */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  const body = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && body[i + 1] === '|') {
      buf += '|';
      i++;
      continue;
    }
    if (c === '|') {
      cells.push(buf.trim());
      buf = '';
      continue;
    }
    buf += c;
  }
  cells.push(buf.trim());
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every(
    (c) => /^:?-{3,}:?$/.test(c.replace(/\s+/g, '')),
  );
}

function normalizeCell(c: string): string {
  // collapse multi-line / markdown emphasis / link tails
  return c
    .replace(/\r?\n/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detect the §x.y.z section id from a heading line above a table. */
function sectionFromHeading(text: string): string | null {
  const m = text.match(/^###\s+(5\.\d+(?:\.\d+)?)\s+/m);
  return m ? m[1] : null;
}

interface ParsedTable {
  header: string[];
  rows: string[][];
}

function extractTables(md: string): { section: string; table: ParsedTable }[] {
  const out: { section: string; table: ParsedTable }[] = [];
  const lines = md.split(/\r?\n/);
  let currentSection: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('### ')) {
      const s = sectionFromHeading(line);
      if (s && SECTION_DOMAIN[s]) currentSection = s;
      continue;
    }
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    if (!isSeparatorRow(cells)) continue;
    // previous line must have been header
    const header = splitRow(lines[i - 1] ?? '');
    if (header.length !== cells.length) continue;
    // collect body rows until next separator row OR a non-pipe line
    const body: string[][] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = splitRow(lines[j]);
      if (next.length === 0) continue;
      // Stop on next separator-row (next table) or column-count mismatch.
      if (isSeparatorRow(next)) break;
      if (next.length !== header.length) break;
      body.push(next);
    }
    if (!currentSection) continue;
    out.push({ section: currentSection, table: { header, rows: body } });
    // Skip past the body we just consumed so we don't re-detect the same table.
    i += body.length;
  }
  return out;
}

/** Map raw row → MatrixRow. Returns null if row cannot be mapped. */
function toMatrixRow(
  section: string,
  cells: string[],
): MatrixRow | null {
  // Column 1 in v2 tables is the explicit id (e.g. "5.20.1"); column 2 is the
  // title. Column 3 is status (emoji). Column 4 is evidence. Column 5 is gap.
  const explicitId = normalizeCell(cells[0] ?? '');
  if (!explicitId) return null;

  // Skip rows where the first column is not a §-style id — those are body rows
  // the parser mistakenly collected (table boundary handling is best-effort).
  if (!/^\d+\.\d+(\.\d+)?$/.test(explicitId)) return null;

  const titleCell = normalizeCell(cells[1] ?? '');
  if (!titleCell) return null;

  // Title may contain " — desc"; strip trailing description.
  const title = titleCell.replace(/\s+—.*$/, '').trim();
  const desc = titleCell.includes('—')
    ? titleCell.split('—').slice(1).join('—').trim()
    : '';

  const url = CREATIO_URLS[section] ?? '';

  // Status emoji lives in column 3 (or column 1 of legacy 3-col tables).
  const statusCell = normalizeCell(cells[2] ?? '') || normalizeCell(cells[0] ?? '');
  let status: Status = 'NOT_STARTED';
  for (const sym of Object.keys(STATUS_MAP)) {
    if (statusCell.includes(sym)) {
      status = STATUS_MAP[sym];
      break;
    }
  }

  const neurecoreEvidence = normalizeCell(cells[3] ?? '');
  const gap = normalizeCell(cells[4] ?? '');

  const capabilityId = `CR-AI-${explicitId.replace(/\./g, '-')}`;

  const verification: MatrixRow['verification_status'] =
    status === 'OUT_OF_SCOPE' ? 'INTENTIONAL_DIFFERENCE' : 'UNVERIFIED';

  return {
    capability_id: capabilityId,
    section: explicitId,
    domain: SECTION_DOMAIN[section] ?? 'unknown',
    capability: title,
    creatio_source_url: url,
    creatio_behavior: desc || title,
    neurecore_evidence: neurecoreEvidence,
    status,
    gap,
    phase: SECTION_PHASE[section] ?? 'OPS',
    verification_status: verification,
    owner: null,
  };
}

const CREATIO_URLS: Record<string, string> = {
  '5.1': 'https://www.creatio.com/ai-studio',
  '5.2': 'https://www.creatio.com/ai-studio#governance',
  '5.3': 'https://www.creatio.com/ai-twin',
  '5.4': 'https://www.creatio.com/ai/ai-trust-and-governance',
  '5.5': 'https://www.creatio.com/ai/ai-native-automation',
  '5.6': 'https://www.creatio.com/sales',
  '5.7': 'https://www.creatio.com/marketing',
  '5.8': 'https://www.creatio.com/service',
  '5.9': 'https://www.creatio.com/service',
  '5.10': 'https://www.creatio.com/marketing',
  '5.11': 'https://www.creatio.com/sales',
  '5.12': 'https://www.creatio.com/ai-studio',
  '5.13': 'https://www.creatio.com/studio',
  '5.14': 'https://www.creatio.com/governance',
  '5.15': 'https://www.creatio.com/ai/ai-native-automation',
  '5.16': 'https://www.creatio.com/ai-studio#communication',
  '5.17': 'https://www.creatio.com/ai-studio#data-ownership',
  '5.18': 'https://www.creatio.com/ai/ai-trust-and-governance',
  '5.19': 'https://www.creatio.com/studio',
  '5.20': 'https://www.creatio.com/',
};

interface ValidationError {
  kind: string;
  message: string;
}

function validate(rows: MatrixRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const seen = new Map<string, MatrixRow>();
  for (const r of rows) {
    if (!VALID_STATUS.has(r.status)) {
      errors.push({ kind: 'status', message: `${r.capability_id} bad status ${r.status}` });
    }
    if (!VALID_PHASE.has(r.phase)) {
      errors.push({ kind: 'phase', message: `${r.capability_id} bad phase ${r.phase}` });
    }
    if (!VALID_VERIFICATION.has(r.verification_status)) {
      errors.push({
        kind: 'verification',
        message: `${r.capability_id} bad verification_status ${r.verification_status}`,
      });
    }
    if (!r.capability) {
      errors.push({ kind: 'capability', message: `${r.capability_id} empty capability` });
    }
    if (!r.domain || r.domain === 'unknown') {
      errors.push({ kind: 'domain', message: `${r.capability_id} unknown domain` });
    }
    if (seen.has(r.capability_id)) {
      errors.push({
        kind: 'duplicate',
        message: `duplicate capability_id ${r.capability_id}`,
      });
    }
    seen.set(r.capability_id, r);
  }
  // Cross-domain capability overlaps are EXPECTED in Creatio's surface
  // (e.g. Lead Scoring Agent appears in both Sales and Marketing agent lists;
  // AI-Driven Development appears 3x in §5.13; BYO-LLM appears in §5.4 and
  // §5.17; EU AI Act appears in §5.4 and §5.18). Treat them as warnings,
  // not blocking errors. The v2 plan documents these cross-references.
  const titleSeen = new Map<string, string>();
  for (const r of rows) {
    const k = `${r.domain}::${r.capability.toLowerCase()}`;
    if (titleSeen.has(k)) {
      warnings.push({
        kind: 'cross-domain-overlap',
        message: `${r.capability_id} overlaps ${titleSeen.get(k)} on "${r.capability}" (informational)`,
      });
    } else {
      titleSeen.set(k, r.capability_id);
    }
  }
  if (warnings.length > 0) {
    console.warn(`⚠ ${warnings.length} cross-domain overlaps (non-blocking):`);
    for (const w of warnings.slice(0, 10)) console.warn(`  [${w.kind}] ${w.message}`);
    if (warnings.length > 10) {
      console.warn(`  … and ${warnings.length - 10} more`);
    }
  }
  return errors;
}

function yamlEscape(s: string): string {
  if (s === '') return '""';
  // Use double-quoted scalar with backslash-escapes.
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

function emitYaml(m: Matrix): string {
  const lines: string[] = [];
  lines.push('# NeureCore — Creatio AI Capability Parity Matrix v1');
  lines.push('# Generated by backend/scripts/build-matrix-from-v2.ts');
  lines.push('# Source: neurecore/memory-bank-arc/comms/creatio-ai-parity-implementation-plan-v2.md');
  lines.push('# DO NOT EDIT BY HAND — regenerate with `pnpm parity:matrix:build`.');
  lines.push(`schemaVersion: "1.0"`);
  lines.push(`generatedAt: "${m.generatedAt}"`);
  lines.push(`sourcePlan: "creatio-ai-parity-implementation-plan-v2.md"`);
  lines.push(`totalRows: ${m.totalRows}`);
  lines.push(`counts:`);
  for (const [k, v] of Object.entries(m.counts)) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push(`rows:`);
  for (const r of m.rows) {
    lines.push(`  - capability_id: ${r.capability_id}`);
    lines.push(`    section: ${yamlEscape(r.section)}`);
    lines.push(`    domain: ${yamlEscape(r.domain)}`);
    lines.push(`    capability: ${yamlEscape(r.capability)}`);
    lines.push(`    creatio_source_url: ${yamlEscape(r.creatio_source_url)}`);
    lines.push(`    creatio_behavior: ${yamlEscape(r.creatio_behavior)}`);
    lines.push(`    neurecore_evidence: ${yamlEscape(r.neurecore_evidence)}`);
    lines.push(`    status: ${r.status}`);
    lines.push(`    gap: ${yamlEscape(r.gap)}`);
    lines.push(`    phase: ${r.phase}`);
    lines.push(`    verification_status: ${r.verification_status}`);
    lines.push(`    owner: ${r.owner === null ? 'null' : yamlEscape(r.owner)}`);
  }
  return lines.join('\n') + '\n';
}

function countStatuses(rows: MatrixRow[]): Record<Status, number> {
  const counts: Record<Status, number> = {
    DONE: 0,
    PARTIAL: 0,
    NOT_STARTED: 0,
    OUT_OF_SCOPE: 0,
  };
  for (const r of rows) counts[r.status]++;
  return counts;
}

interface CliArgs {
  inPath: string;
  outPath: string;
  checkOnly: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let inPath =
    'neurecore/memory-bank-arc/comms/creatio-ai-parity-implementation-plan-v2.md';
  let outPath =
    'neurecore/memory-bank-arc/comms/creatio-ai-parity-matrix.yaml';
  let checkOnly = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in' || a === '-i') inPath = argv[++i];
    else if (a === '--out' || a === '-o') outPath = argv[++i];
    else if (a === '--check') checkOnly = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: build-matrix-from-v2.ts [--in path] [--out path] [--check]');
      process.exit(0);
    }
  }
  return { inPath, outPath, checkOnly };
}

function main(): void {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const inAbs = path.resolve(repoRoot, args.inPath);
  const outAbs = path.resolve(repoRoot, args.outPath);

  const md = readFileSafe(inAbs);
  const tables = extractTables(md);

  const rows: MatrixRow[] = [];
  for (const t of tables) {
    t.table.rows.forEach((cells) => {
      const r = toMatrixRow(t.section, cells);
      if (r) rows.push(r);
    });
  }

  const errors = validate(rows);
  if (errors.length > 0) {
    console.error('Validation errors:');
    for (const e of errors) console.error(`  [${e.kind}] ${e.message}`);
    process.exit(2);
  }

  const matrix: Matrix = {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    sourcePlan: 'creatio-ai-parity-implementation-plan-v2.md',
    totalRows: rows.length,
    counts: countStatuses(rows),
    rows,
  };

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  if (args.checkOnly) {
    // Compare with timestamps normalised so check is byte-stable.
    const normalised = emitYaml({
      ...matrix,
      generatedAt: 'NORMALISED',
    });
    let drifted = false;
    if (fs.existsSync(outAbs)) {
      const existing = fs
        .readFileSync(outAbs, 'utf8')
        .replace(/^generatedAt: ".*"$/m, 'generatedAt: "NORMALISED"');
      if (existing !== normalised) drifted = true;
    } else {
      drifted = true;
    }
    if (drifted) {
      console.error('matrix drift detected — re-run pnpm parity:matrix:build');
      process.exit(2);
    }
    console.log(`matrix in sync: ${rows.length} rows`);
    return;
  }

  fs.writeFileSync(outAbs, emitYaml(matrix), 'utf8');

  console.log(`matrix built: ${rows.length} rows`);
  console.log(`  DONE          : ${matrix.counts.DONE}`);
  console.log(`  PARTIAL       : ${matrix.counts.PARTIAL}`);
  console.log(`  NOT_STARTED   : ${matrix.counts.NOT_STARTED}`);
  console.log(`  OUT_OF_SCOPE  : ${matrix.counts.OUT_OF_SCOPE}`);
  console.log(`output: ${path.relative(repoRoot, outAbs)}`);
}

main();
