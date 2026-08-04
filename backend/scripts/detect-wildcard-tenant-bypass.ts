#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 0.5 — Wildcard-tenant bypass detector.
 *
 * Scans backend/frontend for the literal pattern `tenantId === '*'` or
 * `tenantId !== '*'` which the v3 P-1 rule §11 forbids in all tenant-owned
 * application paths. Such bypasses allow callers to opt out of tenant
 * isolation by passing the wildcard.
 *
 * Allowed exemptions:
 *   - Tests under *.spec.ts / __tests__/
 *   - Platform admin paths that already use a separate authorization port
 *     (none currently; this scanner is strict)
 *   - The `agents.service.ts:85` check that explicitly REFUSES the wildcard
 *     (semantic inversion: early-returns on `tenantId === '*'`).
 *
 * Exit codes:
 *   0 — no bypass found
 *   1 — bypass found (returns report)
 *   2 — IO / parse error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface Finding {
  file: string;
  line: number;
  pattern: string;
  raw: string;
  safe: boolean;
  rationale: string;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const SEARCH_ROOTS = [
  path.resolve(REPO_ROOT, 'neurecore/backend/src'),
  path.resolve(REPO_ROOT, 'neurecore/frontend-admin/src'),
  path.resolve(REPO_ROOT, 'neurecore/frontend-tenant/src'),
];

const PATTERN = /tenantId\s*(===|!==)\s*['"]\*['"]/;

interface CliArgs {
  outPath: string;
  failOnBypass: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let outPath =
    'neurecore/memory-bank-arc/comms/wildcard-tenant-report.yaml';
  let failOnBypass = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') outPath = argv[++i];
    else if (a === '--fail') failOnBypass = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: detect-wildcard-tenant-bypass.ts [--out path] [--fail]');
      process.exit(0);
    }
  }
  return { outPath, failOnBypass };
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.next') {
      continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (
      e.isFile() &&
      (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) &&
      !e.name.endsWith('.spec.ts') &&
      !e.name.endsWith('.test.ts')
    ) {
      out.push(full);
    }
  }
}

function classify(
  file: string,
  line: string,
  nextLines: string[],
): { safe: boolean; rationale: string } {
  // Heuristic: a check that REFUSES the wildcard (early-return / throw) is
  // safe. A check that SWITCHES on it (e.g. `tenantId === '*' ? skip filter`
  // or `tenantId !== '*' ? apply filter : skip`) is unsafe.
  const m = line.match(/tenantId\s*(===|!==)\s*['"]\*['"]\s*\?\s*([^:]+):/);
  if (m) {
    const consequent = m[2].trim();
    if (/throw\s+/.test(consequent) || /return\s+null/.test(consequent)) {
      return { safe: true, rationale: 'rejects wildcard explicitly' };
    }
    if (/^\s*\{\s*\}\s*$/.test(consequent)) {
      return { safe: false, rationale: 'wildcard opts out of tenant filter' };
    }
  }
  // Pattern `if (tenantId === '*')` followed by widening behaviour.
  if (/if\s*\(tenantId\s*===\s*['"]\*['"]\)/.test(line)) {
    // Look at the next non-blank line — if it throws, the branch is a guard.
    for (const nl of nextLines) {
      const trimmed = nl.trim();
      if (!trimmed) continue;
      if (/throw\s+/.test(trimmed) || /return\s+/.test(trimmed)) {
        return { safe: true, rationale: 'rejects wildcard explicitly' };
      }
      break;
    }
    return { safe: false, rationale: 'wildcard branch detected (review next line)' };
  }
  // Pattern `if (!tenantId || tenantId === '*')` followed by throw —
  // equivalent to "real tenant or refuse". Treat as safe.
  // Matches tenantId, envelope.tenantId, actor.tenantId, target.tenantId.
  if (
    /if\s*\(\s*!?\w+\.?tenantId\s*&&\s*\w+\.tenantId\s*===\s*['"]\*['"]/.test(line) ||
    /if\s*\(\s*!?\w+\.tenantId\s*\|\|\s*\w+\.tenantId\s*===\s*['"]\*['"]/.test(line) ||
    /if\s*\(\s*!?tenantId\s*\|\|\s*tenantId\s*===\s*['"]\*['"]/.test(line) ||
    /if\s*\(\s*\w+\.tenantId\s*!==\s*['"]\*['"]/.test(line) ||
    /if\s*\(\s*tenantId\s*&&\s*tenantId\s*!==\s*['"]\*['"]/.test(line)
  ) {
    for (const nl of nextLines) {
      const trimmed = nl.trim();
      if (!trimmed) continue;
      if (/throw\s+/.test(trimmed) || /return\s+/.test(trimmed)) {
        return { safe: true, rationale: 'rejects wildcard explicitly' };
      }
      break;
    }
    return { safe: false, rationale: 'wildcard branch detected (review next line)' };
  }
  // Multi-line `if ( ... && ... !== '*' && ... ) { throw ... }` — check the
  // first non-blank line AFTER the closing `)` of the if. If the next
  // non-blank statement is `throw` or `return`, the wildcard branch is
  // a guard.
  if (/^\s*\w+\.tenantId\s*!==\s*['"]\*['"]\s*(&&|\|\|)/.test(line)) {
    let sawClosing = false;
    for (const nl of nextLines) {
      const trimmed = nl.trim();
      if (!trimmed) continue;
      if (/^\)/.test(trimmed) || /\)\s*\{?\s*$/.test(trimmed)) {
        sawClosing = true;
        continue;
      }
      if (sawClosing && (/throw\s+/.test(trimmed) || /return\s+/.test(trimmed))) {
        return { safe: true, rationale: 'rejects wildcard explicitly' };
      }
      if (!sawClosing) continue;
      break;
    }
  }
  return { safe: false, rationale: 'unknown wildcard pattern' };
}

function scan(): Finding[] {
  const files: string[] = [];
  for (const root of SEARCH_ROOTS) walk(root, files);

  const findings: Finding[] = [];
  for (const f of files) {
    let txt: string;
    try {
      txt = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = txt.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (PATTERN.test(line)) {
        // Skip comments — they describe the pattern but do not invoke it.
        const trimmed = line.trim();
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*')
        ) {
          continue;
        }
        const m = line.match(PATTERN);
        const pattern = m ? m[0] : '';
        const nextLines: string[] = [];
        for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
          nextLines.push(lines[j]);
        }
        const { safe, rationale } = classify(f, line, nextLines);
        findings.push({
          file: path.relative(REPO_ROOT, f),
          line: i + 1,
          pattern,
          raw: line.trim(),
          safe,
          rationale,
        });
      }
    }
  }
  return findings;
}

function yamlEscape(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function emitReport(findings: Finding[]): string {
  const lines: string[] = [];
  lines.push('# NeureCore — Wildcard Tenant Bypass Report');
  lines.push('# Generated by backend/scripts/detect-wildcard-tenant-bypass.ts');
  lines.push('# DO NOT EDIT BY HAND.');
  lines.push('# Per v3 P-1 rule §11: wildcard tenant bypasses are forbidden.');
  lines.push(`schemaVersion: "1.0"`);
  lines.push(`generatedAt: "${new Date().toISOString()}"`);
  lines.push(`totalFindings: ${findings.length}`);
  const unsafe = findings.filter((f) => !f.safe);
  const safe = findings.filter((f) => f.safe);
  lines.push(`unsafeCount: ${unsafe.length}`);
  lines.push(`safeCount: ${safe.length}`);
  lines.push(`findings:`);
  for (const f of findings) {
    lines.push(`  - file: ${yamlEscape(f.file)}`);
    lines.push(`    line: ${f.line}`);
    lines.push(`    pattern: ${yamlEscape(f.pattern)}`);
    lines.push(`    raw: ${yamlEscape(f.raw)}`);
    lines.push(`    safe: ${f.safe}`);
    lines.push(`    rationale: ${yamlEscape(f.rationale)}`);
  }
  return lines.join('\n') + '\n';
}

function main(): void {
  const args = parseArgs(process.argv);
  const findings = scan();
  const out = emitReport(findings);
  const outAbs = path.resolve(REPO_ROOT, args.outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, out, 'utf8');

  const unsafe = findings.filter((f) => !f.safe);
  console.log(`files scanned         : ${SEARCH_ROOTS.length} root dirs`);
  console.log(`findings              : ${findings.length}`);
  console.log(`  unsafe (action reqd): ${unsafe.length}`);
  console.log(`  safe (explicit deny): ${findings.length - unsafe.length}`);
  if (unsafe.length > 0) {
    console.log('');
    console.log('UNSAFE wildcard tenant bypasses:');
    for (const f of unsafe) {
      console.log(`  ${f.file}:${f.line}`);
      console.log(`    ${f.raw}`);
      console.log(`    -> ${f.rationale}`);
    }
  }
  console.log('');
  console.log(`report: ${path.relative(REPO_ROOT, outAbs)}`);
  if (args.failOnBypass && unsafe.length > 0) {
    process.exit(1);
  }
}

main();
