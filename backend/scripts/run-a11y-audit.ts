#!/usr/bin/env npx ts-node --project tsconfig.json

/**
 * Phase 29 — WCAG 2.2 AA audit scanner (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Runs the `A11yAuditRunner` over both frontend applications and
 * writes a machine-readable report. Mirrors `routes:scan` and
 * `tenancy:scan`: informational by default, blocking with `--fail`.
 *
 * Exit codes:
 *   0 — no critical/serious violation (or informational mode)
 *   1 — blocking violations found and `--fail` was passed
 *   2 — IO error
 */

import * as path from 'node:path';
import { A11yRuleRegistry } from '../src/modules/accessibility/a11y-rule.registry';
import { A11yAuditRunner } from '../src/modules/accessibility/a11y-audit.runner';
import { JsxSourceParser } from '../src/modules/accessibility/parser/jsx-source.parser';
import { SourceTreeLoader } from '../src/modules/accessibility/loaders/source-tree.loader';
import { JsonA11yReportSink } from '../src/modules/accessibility/sinks/json-a11y-report.sink';
import { A11Y_RULE_CLASSES } from '../src/modules/accessibility/accessibility.module';
import type { A11yFinding } from '../src/modules/accessibility/interfaces/IA11yRule';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const AUDIT_ROOTS: ReadonlyArray<string> = [
  path.resolve(REPO_ROOT, 'neurecore/frontend-tenant/src'),
  path.resolve(REPO_ROOT, 'neurecore/frontend-admin/src'),
];

const DEFAULT_OUT = path.resolve(
  REPO_ROOT,
  'neurecore/backend/src/test/certification/reports/g29-a11y-audit.json',
);

interface Args {
  readonly failOnViolation: boolean;
  readonly outPath: string;
}

function parseArgs(argv: ReadonlyArray<string>): Args {
  const outIndex = argv.indexOf('--out');
  return {
    failOnViolation: argv.includes('--fail'),
    outPath:
      outIndex >= 0 && argv[outIndex + 1]
        ? path.resolve(REPO_ROOT, argv[outIndex + 1] as string)
        : DEFAULT_OUT,
  };
}

function buildRunner(outPath: string): A11yAuditRunner {
  const parser = new JsxSourceParser();
  const registry = new A11yRuleRegistry(
    A11Y_RULE_CLASSES.map((Rule) => new Rule()),
  );
  registry.onModuleInit();
  return new A11yAuditRunner(
    new SourceTreeLoader(parser),
    registry,
    new JsonA11yReportSink(outPath),
  );
}

function print(findings: ReadonlyArray<A11yFinding>): void {
  for (const finding of findings) {
    console.log(
      `  ${path.relative(REPO_ROOT, finding.path)}:${finding.line} [${finding.severity}] ${finding.ruleId} (WCAG ${finding.criterion})`,
    );
    console.log(`    ${finding.message}`);
    console.log(`    -> ${finding.remediation}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const runner = buildRunner(args.outPath);
  const report = await runner.audit({ roots: AUDIT_ROOTS });

  console.log(`documents scanned     : ${report.documentsScanned}`);
  console.log(`rules applied         : ${report.rulesApplied.length}`);
  console.log(`findings              : ${report.findings.length}`);
  console.log(`  blocking (crit/ser) : ${report.blockingCount}`);
  console.log(`verdict               : ${report.verdict}`);

  const blocking = report.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'serious',
  );
  if (blocking.length > 0) {
    console.log('');
    console.log('BLOCKING accessibility violations:');
    print(blocking);
  }
  const advisory = report.findings.filter(
    (f) => f.severity === 'moderate' || f.severity === 'minor',
  );
  if (advisory.length > 0) {
    console.log('');
    console.log('Advisory accessibility findings:');
    print(advisory);
  }

  console.log('');
  console.log(`report: ${path.relative(REPO_ROOT, args.outPath)}`);
  if (args.failOnViolation && report.blockingCount > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(2);
});
