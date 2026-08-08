/**
 * Phase 29 — WCAG 1.1.1 Non-text Content (CR-AI-1304).
 *
 * Every `<img>` must carry an `alt` attribute. A decorative image
 * declares `alt=""` explicitly; a missing attribute is always a
 * violation because assistive technology falls back to announcing
 * the file name.
 *
 * SOLID
 *   SRP — owns ONLY criterion 1.1.1.
 *   LSP — substitutes `IA11yRule` like every other rule.
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
import { hasAttribute, isHtmlTag } from '../parser/element-query';

@Injectable()
export class ImageAltRule implements IA11yRule {
  readonly id = 'a11y/image-alt';
  readonly criterion: WcagCriterion = '1.1.1';
  readonly level: WcagLevel = 'A';
  readonly severity: A11ySeverity = 'critical';

  evaluate(doc: A11ySourceDocument): ReadonlyArray<A11yFinding> {
    const findings: A11yFinding[] = [];
    for (const element of doc.elements) {
      if (!isHtmlTag(element) || element.tag !== 'img') continue;
      if (hasAttribute(element, 'alt')) continue;
      if (hasAttribute(element, 'aria-hidden')) continue;
      findings.push({
        ruleId: this.id,
        criterion: this.criterion,
        level: this.level,
        severity: this.severity,
        path: doc.path,
        line: element.line,
        message: '<img> has no alt attribute',
        remediation:
          'Add a descriptive alt="…", or alt="" when the image is purely decorative.',
      });
    }
    return findings;
  }
}
