/**
 * Phase 29 — WCAG 2.4.3 Focus Order (CR-AI-1304).
 *
 * A positive `tabIndex` removes the element from the document order
 * and forces it to the front of the tab sequence, which breaks focus
 * order for every keyboard and screen-reader user on the page. Only
 * `0` (focusable, in document order) and `-1` (programmatic focus)
 * are permitted.
 *
 * SOLID
 *   SRP — owns ONLY criterion 2.4.3.
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
import { attributeOf } from '../parser/element-query';

@Injectable()
export class FocusOrderRule implements IA11yRule {
  readonly id = 'a11y/focus-order';
  readonly criterion: WcagCriterion = '2.4.3';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'serious';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    for (const element of doc.elements) {
      const attr =
        attributeOf(element, 'tabIndex') ?? attributeOf(element, 'tabindex');
      if (!attr || attr.value === null) continue;
      const parsed = Number(attr.value.trim());
      if (!Number.isFinite(parsed) || parsed <= 0) continue;

      findings.push({
        ruleId: this.id,
        criterion: this.criterion,
        level: this.level,
        severity: this.severity,
        path: doc.path,
        line: element.line,
        message: `<${element.tag}> uses a positive tabIndex (${parsed})`,
        remediation:
          'Use tabIndex={0} to keep document order, or tabIndex={-1} for programmatic focus only.',
      });
    }
    return findings;
  }
}
