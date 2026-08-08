/**
 * Phase 29 — A11y audit runner (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Composes: loader → every registered rule → report → sink.
 * The runner contains no WCAG knowledge whatsoever; it only orders
 * the pipeline and computes the blocking verdict. That is what makes
 * "adding a criterion check = one audit rule, no runner edits" true.
 *
 * SOLID
 *   SRP — owns ONLY orchestration + verdict computation.
 *   OCP — new criteria arrive through the registry; new destinations
 *         arrive through the sink; the runner body never changes.
 *   ISP — depends on two one-method contracts, not on a fat facade.
 *   DIP — every collaborator is injected through a token.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  A11Y_REPORT_SINK,
  A11Y_RULE_REGISTRY,
  BLOCKING_SEVERITIES,
  type A11yAuditReport,
  type A11yFinding,
} from './interfaces/IA11yRule';
import type { IA11yReportSink } from './interfaces/IA11yReportSink';
import type { IA11ySourceLoader } from './interfaces/IA11ySourceLoader';
import { A11Y_SOURCE_LOADER } from './interfaces/IA11yRule';
import type { A11yRuleRegistry } from './a11y-rule.registry';

export interface A11yAuditRequest {
  readonly roots: ReadonlyArray<string>;
  /** Publish the report through the injected sink. Default: true. */
  readonly publish?: boolean;
}

@Injectable()
export class A11yAuditRunner {
  private readonly logger = new Logger(A11yAuditRunner.name);

  constructor(
    @Inject(A11Y_SOURCE_LOADER) private readonly loader: IA11ySourceLoader,
    @Inject(A11Y_RULE_REGISTRY) private readonly registry: A11yRuleRegistry,
    @Inject(A11Y_REPORT_SINK) private readonly sink: IA11yReportSink,
  ) {}

  async audit(request: A11yAuditRequest): Promise<A11yAuditReport> {
    const documents = await this.loader.load(request.roots);
    const rules = this.registry.ordered();
    const findings: A11yFinding[] = [];

    for (const document of documents) {
      for (const rule of rules) {
        findings.push(...rule.evaluate(document));
      }
    }

    const ordered = [...findings].sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      if (a.line !== b.line) return a.line - b.line;
      return a.ruleId.localeCompare(b.ruleId);
    });
    const blocking = ordered.filter((f) =>
      BLOCKING_SEVERITIES.includes(f.severity),
    );

    const report: A11yAuditReport = {
      generatedAt: new Date().toISOString(),
      roots: [...request.roots],
      documentsScanned: documents.length,
      rulesApplied: rules.map((r) => r.id),
      findings: ordered,
      blockingCount: blocking.length,
      verdict: blocking.length === 0 ? 'PASS' : 'FAIL',
    };

    if (request.publish !== false) await this.sink.publish(report);
    this.logger.log(
      `a11y audit: ${documents.length} document(s), ${ordered.length} finding(s), ${blocking.length} blocking — ${report.verdict}`,
    );
    return report;
  }
}
