/**
 * Phase 29 — WCAG 1.3.1 Info and Relationships (CR-AI-1304).
 *
 * Heading levels convey document structure to screen-reader users,
 * who navigate by heading. Skipping a level (h2 → h4) breaks the
 * outline, so each heading may only descend one level at a time.
 * Ascending back up any number of levels is always valid.
 *
 * SOLID
 *   SRP — owns ONLY criterion 1.3.1 (heading structure).
 */

import { Injectable } from '@nestjs/common';
import {
  type A11yFinding,
  type A11ySeverity,
  type A11ySourceDocument,
  type IA11yRule,
  type WcagCriterion,
  type WcagLevel,
} from '../interfaces/IA11yRule';
import { isHtmlTag } from '../parser/element-query';

const HEADING = /^h([1-6])$/;

@Injectable()
export class HeadingOrderRule implements IA11yRule {
  readonly id = 'a11y/heading-order';
  readonly criterion: WcagCriterion = '1.3.1';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'moderate';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    let previous: number | null = null;

    for (const element of doc.elements) {
      if (!isHtmlTag(element)) continue;
      const match = HEADING.exec(element.tag);
      if (!match) continue;
      const level = Number(match[1]);

      if (previous !== null && level > previous + 1) {
        findings.push({
          ruleId: this.id,
          criterion: this.criterion,
          level: this.level,
          severity: this.severity,
          path: doc.path,
          line: element.line,
          message: `heading level skipped: h${previous} is followed by h${level}`,
          remediation: `Use h${previous + 1} here, or restructure the section outline.`,
        });
      }
      previous = level;
    }
    return findings;
  }
}
